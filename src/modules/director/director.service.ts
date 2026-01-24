import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HealthStatus } from '@prisma/client';

// 1. Import DTO untuk Dashboard (Stats & Risky List)
import { 
  DashboardStatsDto, 
  RiskyEmployeeDto, 
  UnitRankingDto 
} from './dto/director-dashboard.dto';

// 2. Import DTO untuk Detail Employee (Gunakan file yang BARU dibuat di Step 4)
//    Ini mengatasi error "ratios does not exist"
import { EmployeeAuditDetailDto } from './dto/employee-detail-response.dto';

@Injectable()
export class DirectorService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  // ===========================================================================
  // 1. DASHBOARD STATS (Agregat Data)
  // ===========================================================================
  async getDashboardStats(): Promise<DashboardStatsDto> {
    const users = await this.prisma.user.findMany({
      where: { role: 'USER' },
      select: {
        id: true,
        financialChecks: {
          orderBy: { checkDate: 'desc' },
          take: 1,
          select: {
            status: true,
            healthScore: true,
            totalNetWorth: true,
          },
        },
      },
    });

    let totalEmployees = users.length;
    let totalScore = 0;
    let totalAssets = 0;
    let countSehat = 0;
    let countWaspada = 0;
    let countBahaya = 0;
    let activeDataCount = 0;

    for (const user of users) {
      const latestCheckup = user.financialChecks[0];

      if (latestCheckup) {
        activeDataCount++;
        totalScore += latestCheckup.healthScore;
        totalAssets += Number(latestCheckup.totalNetWorth);

        if (latestCheckup.status === HealthStatus.SEHAT) countSehat++;
        else if (latestCheckup.status === HealthStatus.WASPADA) countWaspada++;
        else if (latestCheckup.status === HealthStatus.BAHAYA) countBahaya++;
      }
    }

    const avgHealthScore = activeDataCount > 0 ? Math.round(totalScore / activeDataCount) : 0;

    return {
      totalEmployees,
      avgHealthScore,
      riskyEmployeesCount: countBahaya,
      totalAssetsManaged: totalAssets,
      statusCounts: {
        SEHAT: countSehat,
        WASPADA: countWaspada,
        BAHAYA: countBahaya,
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

    // [FIX] Tambahkan return type explicit pada map: "RiskyEmployeeDto | null"
    // Ini membantu TS memvalidasi objek di dalam return
    const riskyList = users
      .map((u): RiskyEmployeeDto | null => {
        const lastCheck = u.financialChecks[0];
        
        // Filter: Skip jika tidak ada data atau status SEHAT
        if (!lastCheck) return null;
        if (lastCheck.status === HealthStatus.SEHAT) return null;

        return {
          id: u.id,
          fullName: u.fullName,
          unitName: u.unitKerja?.namaUnit || 'Tidak Ada Unit',
          // [FIX] Pastikan status compatible dengan DTO
          status: lastCheck.status, 
          healthScore: lastCheck.healthScore,
          lastCheckDate: lastCheck.checkDate,
        };
      })
      // [FIX] Type Predicate: "item is RiskyEmployeeDto"
      // Ini memberitahu TS bahwa hasil filter pasti BUKAN null
      .filter((item): item is RiskyEmployeeDto => item !== null);

    // Sorting: Aman karena TS sudah tahu item tidak mungkin null
    return riskyList.sort((a, b) => a.healthScore - b.healthScore);
  }

  // ===========================================================================
  // 3. UNIT RANKING (Analisa Per Divisi)
  // ===========================================================================
  async getUnitRankings(): Promise<UnitRankingDto[]> {
    const units = await this.prisma.unitKerja.findMany({
      include: {
        users: {
          where: { role: 'USER' },
          select: {
            financialChecks: {
              orderBy: { checkDate: 'desc' },
              take: 1,
              select: { healthScore: true },
            },
          },
        },
      },
    });

    const rankings = units.map((unit) => {
      let totalScore = 0;
      let count = 0;

      unit.users.forEach((u) => {
        if (u.financialChecks.length > 0) {
          totalScore += u.financialChecks[0].healthScore;
          count++;
        }
      });

      const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
      
      let status: HealthStatus = HealthStatus.BAHAYA;
      if (avgScore >= 80) status = HealthStatus.SEHAT;
      else if (avgScore >= 60) status = HealthStatus.WASPADA;

      return {
        id: unit.id,
        unitName: unit.namaUnit,
        employeeCount: unit.users.length,
        avgScore,
        status,
      };
    });

    return rankings.sort((a, b) => b.avgScore - a.avgScore);
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
    // A. Validasi User
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { unitKerja: true }
    });

    if (!user) throw new NotFoundException('Karyawan tidak ditemukan');

    // B. Ambil Data Checkup Terakhir
    const c = await this.prisma.financialCheckup.findFirst({
      where: { userId: targetUserId },
      orderBy: { checkDate: 'desc' }
    });

    if (!c) {
        return null; 
    }

    // C. AUDIT TRAIL TRIGGER
    this.auditService.logAccess({
      actorId: actorId,
      targetUserId: targetUserId,
      action: 'VIEW_EMPLOYEE_DETAIL',
      metadata: { 
        employeeName: user.fullName,
        healthScore: c.healthScore
      }
    });

    // D. Mapping Response
    // Menggunakan DTO dari 'employee-detail-response.dto.ts' yang memiliki properti 'ratios'
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
        // [FIXED] Property 'ratios' sekarang dikenali karena import DTO sudah benar
        ratios: c.ratiosDetails as any 
      },

      record: {
        userProfile: {
          name: user.fullName,
          dob: user.dateOfBirth ? user.dateOfBirth.toISOString() : undefined,
          ...c.userProfile as any 
        },

        // Mapping Data Mentah
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