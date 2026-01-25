import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FinancialService } from '../financial/financial.service'; // Ensure this is imported
import { HealthStatus } from '@prisma/client';

// Utility Import (Step 1 Integration)
import { calculateFinancialHealth } from '../financial/utils/financial-math.util';
import { CreateFinancialRecordDto } from '../financial/dto/create-financial-record.dto';

// 1. Import DTO Dashboard & Summary
import { 
  DashboardStatsDto, 
  RiskyEmployeeDto, 
  UnitRankingDto,
  DashboardSummaryDto
} from './dto/director-dashboard.dto';

// 2. Import DTO Detail Employee
import { EmployeeAuditDetailDto } from './dto/employee-detail-response.dto';

@Injectable()
export class DirectorService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private financialService: FinancialService
  ) {}

  // ===========================================================================
  // PHASE 5: ORCHESTRATOR (PARALLEL EXECUTION)
  // ===========================================================================
  async getDashboardSummary(): Promise<DashboardSummaryDto> {
    const [stats, riskyAll, rankingsAll] = await Promise.all([
      this.getDashboardStats(),
      this.getRiskMonitor(), 
      this.getUnitRankings(),
    ]);

    return {
      stats,
      topRiskyEmployees: riskyAll.slice(0, 5), // Preview Top 5
      unitRankings: rankingsAll.slice(0, 5),   // Preview Top 5
      meta: {
        generatedAt: new Date(),
      },
    };
  }

  // ===========================================================================
  // 1. DASHBOARD STATS (OPTIMIZED)
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
  // 2. RISK MONITOR (DATABASE FILTERING)
  // ===========================================================================
  async getRiskMonitor(): Promise<RiskyEmployeeDto[]> {
    const users = await this.prisma.user.findMany({
      where: { 
        role: 'USER',
        financialChecks: { 
          some: {
            status: { in: [HealthStatus.BAHAYA, HealthStatus.WASPADA] }
          }
        }
      },
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
            userProfile: true 
          },
        },
      },
    });

    const riskyList = users
      .map((u): RiskyEmployeeDto | null => {
        const lastCheck = u.financialChecks[0];
        
        if (!lastCheck) return null;
        if (lastCheck.status === HealthStatus.SEHAT) return null;

        const debtRatio = (lastCheck.userProfile as any)?.debtServiceRatio || 0;

        return {
          id: u.id,
          fullName: u.fullName,
          unitName: u.unitKerja?.namaUnit || 'Tidak Ada Unit',
          status: lastCheck.status, 
          healthScore: lastCheck.healthScore,
          debtToIncomeRatio: debtRatio, // [FIXED ERROR 1] Property now exists in DTO
          lastCheckDate: lastCheck.checkDate,
        };
      })
      .filter((item): item is RiskyEmployeeDto => item !== null);

    return riskyList.sort((a, b) => a.healthScore - b.healthScore);
  }

  // ===========================================================================
  // 3. UNIT RANKING (OPTIMIZED)
  // ===========================================================================
  async getUnitRankings(): Promise<UnitRankingDto[]> {
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
      GROUP BY uk.id, uk.nama_unit
      ORDER BY "avgScore" DESC;
    `;

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
        status, 
      };
    });
  }

  // ===========================================================================
  // 4. SEARCH EMPLOYEES (FUZZY SEARCH)
  // ===========================================================================
  async searchEmployees(keyword: string) {
    if (!keyword) return [];

    const safeKeyword = keyword.trim();
    
    const results: any[] = await this.prisma.$queryRaw`
      SELECT
        u.id,
        u.full_name as "fullName",
        u.email,
        uk.nama_unit as "unitName",
        fc.status,
        fc.health_score as "healthScore"
      FROM users u
      LEFT JOIN unit_kerja uk ON u.unit_kerja_id = uk.id
      LEFT JOIN (
        SELECT DISTINCT ON (user_id) user_id, status, health_score
        FROM financial_checkups
        ORDER BY user_id, check_date DESC
      ) fc ON fc.user_id = u.id
      WHERE 
        u.role = 'USER' AND 
        (
          u.full_name ILIKE ${'%' + safeKeyword + '%'}
          OR 
          uk.nama_unit ILIKE ${'%' + safeKeyword + '%'}
        )
      LIMIT 20;
    `;

    return results.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      unitKerja: { 
        name: row.unitName || 'Tidak Ada Unit' 
      },
      financialChecks: row.status ? [{
        status: row.status as HealthStatus,
        healthScore: row.healthScore
      }] : []
    }));
  }

  // ===========================================================================
  // 5. EMPLOYEE DETAIL (DEEP DIVE + AUDIT)
  // ===========================================================================
  async getEmployeeAuditDetail(actorId: string, targetUserId: string): Promise<EmployeeAuditDetailDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { unitKerja: true }
    });

    if (!user) throw new NotFoundException('Karyawan tidak ditemukan');

    const c = await this.financialService.getLatestCheckup(targetUserId);

    if (!c) {
        return null; 
    }

    // [FIX ERROR 2] Audit Trail Call needs to be a single DTO object
    await this.auditService.logAccess({
      actorId: actorId,
      targetUserId: targetUserId,
      action: 'VIEW_EMPLOYEE_DETAIL',
      metadata: { 
        employeeName: user.fullName,
        healthScore: c.healthScore
      }
    });

    // [FIX ERROR 3] Type mismatch: 'RatioDetail[]' not assignable to 'JsonValue'
    // We explicitly cast analysisRatios to 'any' to satisfy type checks during the logic flow
    let analysisRatios: any = c.ratiosDetails;

    // Jika belum ada (null), hitung secara on-the-fly menggunakan Utility
    if (!analysisRatios) {
        // Casting raw DB data ke DTO input untuk kalkulator
        const rawDataForCalc: CreateFinancialRecordDto = {
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
            userProfile: c.userProfile as any,
        };

        const result = calculateFinancialHealth(rawDataForCalc);
        analysisRatios = result.ratios;
    }

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
        ratios: analysisRatios as any 
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