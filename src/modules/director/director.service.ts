import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HealthStatus } from '@prisma/client';

// 1. Import DTO
import { 
  DashboardStatsDto, 
  RiskyEmployeeDto, 
  UnitRankingDto 
} from './dto/director-dashboard.dto';

// 2. Import DTO Detail Employee
import { EmployeeAuditDetailDto } from './dto/employee-detail-response.dto';

@Injectable()
export class DirectorService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  // ===========================================================================
  // 1. DASHBOARD STATS (OPTIMIZED - DATABASE AGGREGATION)
  // ===========================================================================
  async getDashboardStats(): Promise<DashboardStatsDto> {
    const totalEmployees = await this.prisma.user.count({
      where: { role: 'USER' },
    });

    const rawStats: any[] = await this.prisma.$queryRaw`
      SELECT
        COALESCE(AVG(fc.health_score), 0)::float as "avgScore",
        COALESCE(SUM(fc.total_net_worth), 0)::float as "totalAssets",
        COUNT(CASE WHEN fc.status = 'SEHAT' THEN 1 END)::int as "countSehat",
        COUNT(CASE WHEN fc.status = 'WASPADA' THEN 1 END)::int as "countWaspada",
        COUNT(CASE WHEN fc.status = 'BAHAYA' THEN 1 END)::int as "countBahaya"
      FROM (
        SELECT DISTINCT ON (user_id) *
        FROM financial_checkups
        ORDER BY user_id, check_date DESC
      ) fc
      JOIN users u ON u.id = fc.user_id
      WHERE u.role = 'USER';
    `;

    const stats = rawStats[0] || {};

    return {
      totalEmployees,
      avgHealthScore: Math.round(stats.avgScore || 0),
      riskyEmployeesCount: stats.countBahaya || 0,
      totalAssetsManaged: stats.totalAssets || 0,
      statusCounts: {
        SEHAT: stats.countSehat || 0,
        WASPADA: stats.countWaspada || 0,
        BAHAYA: stats.countBahaya || 0,
      },
    };
  }

  // ===========================================================================
  // 2. RISK MONITOR (Daftar Karyawan Berisiko)
  // ===========================================================================
  async getRiskyEmployees(): Promise<RiskyEmployeeDto[]> {
    const users = await this.prisma.user.findMany({
      where: { role: 'USER' },
      select: {
        id: true,
        fullName: true,
        unitKerja: { select: { namaUnit: true } },
        financialChecks: {
          orderBy: { checkDate: 'desc' },
          take: 1, 
          select: {
            status: true,
            healthScore: true,
            checkDate: true,
          },
        },
      },
    });

    const riskyList = users
      .map((u): RiskyEmployeeDto | null => {
        const lastCheck = u.financialChecks[0];
        
        if (!lastCheck) return null;
        if (lastCheck.status === HealthStatus.SEHAT) return null;

        return {
          id: u.id,
          fullName: u.fullName,
          unitName: u.unitKerja?.namaUnit || 'Tidak Ada Unit',
          status: lastCheck.status, 
          healthScore: lastCheck.healthScore,
          lastCheckDate: lastCheck.checkDate,
        };
      })
      .filter((item): item is RiskyEmployeeDto => item !== null);

    return riskyList.sort((a, b) => a.healthScore - b.healthScore);
  }

  // ===========================================================================
  // 3. UNIT RANKING (OPTIMIZED - DATABASE AGGREGATION)
  // ===========================================================================
  async getUnitRankings(): Promise<UnitRankingDto[]> {
    // Logic:
    // 1. LEFT JOIN 'unit_kerja' ke 'users' -> Menghitung jumlah karyawan per unit
    // 2. LEFT JOIN ke Subquery 'financial_checkups' (Latest) -> Menghitung Avg Health Score
    // 3. GROUP BY unit_kerja.id
    // 4. ORDER BY avgScore DESC (Langsung dari DB)

    const rawRankings: any[] = await this.prisma.$queryRaw`
      SELECT
        uk.id,
        uk.nama_unit as "unitName",
        COUNT(u.id)::int as "employeeCount",
        COALESCE(AVG(fc.health_score), 0)::float as "avgScore"
      FROM unit_kerja uk
      LEFT JOIN users u ON u.unit_kerja_id = uk.id AND u.role = 'USER'
      LEFT JOIN (
        SELECT DISTINCT ON (user_id) user_id, health_score
        FROM financial_checkups
        ORDER BY user_id, check_date DESC
      ) fc ON fc.user_id = u.id
      GROUP BY uk.id
      ORDER BY "avgScore" DESC;
    `;

    // Mapping Raw Result ke DTO (+ Logic Status Labeling)
    return rawRankings.map((row) => {
      const score = Math.round(row.avgScore);
      let status: HealthStatus = HealthStatus.BAHAYA;
      
      if (score >= 80) status = HealthStatus.SEHAT;
      else if (score >= 60) status = HealthStatus.WASPADA;

      return {
        id: row.id,
        unitName: row.unitName,
        employeeCount: row.employeeCount,
        avgScore: score,
        status, // Status dikalkulasi saat mapping, datanya valid
      };
    });
  }

  // ===========================================================================
  // 4. SEARCH EMPLOYEES (Pencarian Global)
  // ===========================================================================
  async searchEmployees(keyword: string) {
    if (!keyword) return [];

    return this.prisma.user.findMany({
      where: {
        role: 'USER',
        OR: [
          { fullName: { contains: keyword, mode: 'insensitive' } },
          { email: { contains: keyword, mode: 'insensitive' } },
          { unitKerja: { namaUnit: { contains: keyword, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        unitKerja: { select: { namaUnit: true } },
        financialChecks: {
          orderBy: { checkDate: 'desc' },
          take: 1,
          select: { status: true, healthScore: true },
        },
      },
      take: 20,
    });
  }

  // ===========================================================================
  // 5. EMPLOYEE DETAIL (Deep Dive + Automatic Audit)
  // ===========================================================================
  async getEmployeeDetail(actorId: string, targetUserId: string): Promise<EmployeeAuditDetailDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { unitKerja: true }
    });

    if (!user) throw new NotFoundException('Karyawan tidak ditemukan');

    const c = await this.prisma.financialCheckup.findFirst({
      where: { userId: targetUserId },
      orderBy: { checkDate: 'desc' }
    });

    if (!c) {
        return null; 
    }

    // AUDIT TRAIL
    this.auditService.logAccess({
      actorId: actorId,
      targetUserId: targetUserId,
      action: 'VIEW_EMPLOYEE_DETAIL',
      metadata: { 
        employeeName: user.fullName,
        healthScore: c.healthScore
      }
    });

    // MAPPING RESPONSE
    return {
      profile: {
        id: user.id,
        fullName: user.fullName,
        unitName: user.unitKerja?.namaUnit || '-',
        email: user.email,
        status: c.status,
        healthScore: c.healthScore,
        lastCheckDate: c.checkDate,
      },

      analysis: {
        score: c.healthScore,
        globalStatus: c.status,
        netWorth: Number(c.totalNetWorth),
        surplusDeficit: Number(c.surplusDeficit), 
        generatedAt: c.checkDate,
        ratios: c.ratiosDetails as any 
      },

      record: {
        userProfile: {
          name: user.fullName,
          dob: user.dateOfBirth ? user.dateOfBirth.toISOString() : undefined,
          ...c.userProfile as any 
        },
        assetCash: Number(c.assetCash),
        assetHome: Number(c.assetHome),
        assetVehicle: Number(c.assetVehicle),
        assetJewelry: Number(c.assetJewelry),
        assetAntique: Number(c.assetAntique),
        assetPersonalOther: Number(c.assetPersonalOther),
        assetInvHome: Number(c.assetInvHome),
        assetInvVehicle: Number(c.assetInvVehicle),
        assetGold: Number(c.assetGold),
        assetInvAntique: Number(c.assetInvAntique),
        assetStocks: Number(c.assetStocks),
        assetMutualFund: Number(c.assetMutualFund),
        assetBonds: Number(c.assetBonds),
        assetDeposit: Number(c.assetDeposit),
        assetInvOther: Number(c.assetInvOther),
        debtKPR: Number(c.debtKPR),
        debtKPM: Number(c.debtKPM),
        debtCC: Number(c.debtCC),
        debtCoop: Number(c.debtCoop),
        debtConsumptiveOther: Number(c.debtConsumptiveOther),
        debtBusiness: Number(c.debtBusiness),
        incomeFixed: Number(c.incomeFixed),
        incomeVariable: Number(c.incomeVariable),
        installmentKPR: Number(c.installmentKPR),
        installmentKPM: Number(c.installmentKPM),
        installmentCC: Number(c.installmentCC),
        installmentCoop: Number(c.installmentCoop),
        installmentConsumptiveOther: Number(c.installmentConsumptiveOther),
        installmentBusiness: Number(c.installmentBusiness),
        insuranceLife: Number(c.insuranceLife),
        insuranceHealth: Number(c.insuranceHealth),
        insuranceHome: Number(c.insuranceHome),
        insuranceVehicle: Number(c.insuranceVehicle),
        insuranceBPJS: Number(c.insuranceBPJS),
        insuranceOther: Number(c.insuranceOther),
        savingEducation: Number(c.savingEducation),
        savingRetirement: Number(c.savingRetirement),
        savingPilgrimage: Number(c.savingPilgrimage),
        savingHoliday: Number(c.savingHoliday),
        savingEmergency: Number(c.savingEmergency),
        savingOther: Number(c.savingOther),
        expenseFood: Number(c.expenseFood),
        expenseSchool: Number(c.expenseSchool),
        expenseTransport: Number(c.expenseTransport),
        expenseCommunication: Number(c.expenseCommunication),
        expenseHelpers: Number(c.expenseHelpers),
        expenseTax: Number(c.expenseTax),
        expenseLifestyle: Number(c.expenseLifestyle),
      }
    };
  }
}