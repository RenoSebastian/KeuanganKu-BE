import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service'; // <--- IMPORT AUDIT SERVICE
import { HealthStatus } from '@prisma/client';
import { 
  DashboardStatsDto, 
  RiskyEmployeeDto, 
  UnitRankingDto,
  EmployeeAuditDetailDto 
} from './dto/director-dashboard.dto';

@Injectable()
export class DirectorService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService // <--- INJECT AUDIT SERVICE
  ) {}

  // ===========================================================================
  // 1. DASHBOARD STATS (Agregat Data)
  // ===========================================================================
  async getDashboardStats(): Promise<DashboardStatsDto> {
    // Mengambil user dan HANYA checkup terakhirnya (Optimization)
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

    const riskyList = users
      .map((u) => {
        const lastCheck = u.financialChecks[0];
        // Filter Logic: Hanya ambil yang punya data DAN statusnya BUKAN Sehat
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

    // Sorting: Tampilkan yang paling "Sakit" (Score terendah) dulu
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

    // Sorting: Unit dengan performa terbaik di atas
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
          // Nested Relation Filter (Mencari berdasarkan nama unit kerja)
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
      take: 20, // Limit hasil pencarian
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
        return null; // Atau throw exception jika ingin strict
    }

    // C. AUDIT TRAIL TRIGGER (FIRE-AND-FORGET)
    // Mencatat bahwa Direksi sedang melihat data detail ini
    this.auditService.logAccess({
      actorId: actorId,
      targetUserId: targetUserId,
      action: 'VIEW_EMPLOYEE_DETAIL',
      metadata: { 
        employeeName: user.fullName,
        healthScore: c.healthScore
      }
    });

    // D. Mapping Response (Manual Mapping untuk Typescript Safety)
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
        ratios: c.ratiosDetails as any // Passing JSON raw ke FE
      },

      record: {
        userProfile: {
          name: user.fullName,
          dob: user.dateOfBirth ? user.dateOfBirth.toISOString() : undefined,
          ...c.userProfile as any // Spread sisa data profil json
        },

        // --- MAPPING FIELD DATABASE KE DTO FRONTEND ---
        
        // 1. Aset Likuid
        assetCash: Number(c.assetCash),

        // 2. Aset Personal
        assetHome: Number(c.assetHome),
        assetVehicle: Number(c.assetVehicle),
        assetJewelry: Number(c.assetJewelry),
        assetAntique: Number(c.assetAntique),
        assetPersonalOther: Number(c.assetPersonalOther),

        // 3. Aset Investasi
        assetInvHome: Number(c.assetInvHome),
        assetInvVehicle: Number(c.assetInvVehicle),
        assetGold: Number(c.assetGold),
        assetInvAntique: Number(c.assetInvAntique),
        assetStocks: Number(c.assetStocks),
        assetMutualFund: Number(c.assetMutualFund),
        assetBonds: Number(c.assetBonds),
        assetDeposit: Number(c.assetDeposit),
        assetInvOther: Number(c.assetInvOther),

        // 4. Utang Konsumtif
        debtKPR: Number(c.debtKPR),
        debtKPM: Number(c.debtKPM),
        debtCC: Number(c.debtCC),
        debtCoop: Number(c.debtCoop),
        debtConsumptiveOther: Number(c.debtConsumptiveOther),

        // 5. Utang Usaha
        debtBusiness: Number(c.debtBusiness),

        // 6. Penghasilan
        incomeFixed: Number(c.incomeFixed),
        incomeVariable: Number(c.incomeVariable),

        // 7. Cicilan Utang
        installmentKPR: Number(c.installmentKPR),
        installmentKPM: Number(c.installmentKPM),
        installmentCC: Number(c.installmentCC),
        installmentCoop: Number(c.installmentCoop),
        installmentConsumptiveOther: Number(c.installmentConsumptiveOther),
        installmentBusiness: Number(c.installmentBusiness),

        // 8. Asuransi
        insuranceLife: Number(c.insuranceLife),
        insuranceHealth: Number(c.insuranceHealth),
        insuranceHome: Number(c.insuranceHome),
        insuranceVehicle: Number(c.insuranceVehicle),
        insuranceBPJS: Number(c.insuranceBPJS),
        insuranceOther: Number(c.insuranceOther),

        // 9. Tabungan
        savingEducation: Number(c.savingEducation),
        savingRetirement: Number(c.savingRetirement),
        savingPilgrimage: Number(c.savingPilgrimage),
        savingHoliday: Number(c.savingHoliday),
        savingEmergency: Number(c.savingEmergency),
        savingOther: Number(c.savingOther),

        // 10. Pengeluaran Rutin
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