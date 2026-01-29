import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  UseGuards,
  Req,
  Res,
  NotFoundException,
} from '@nestjs/common';
import * as express from 'express'; // [FIXED] Import express secara eksplisit
import { PdfGeneratorService } from './services/pdf-generator.service';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { FinancialService } from './financial.service';
import { PrismaService } from '../../../prisma/prisma.service';

// --- IMPORT DTOs ---
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { CreatePensionDto } from './dto/create-pension.dto';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { CreateGoalDto, SimulateGoalDto } from './dto/create-goal.dto';
import { CreateEducationPlanDto } from './dto/create-education.dto';

// --- GUARDS ---
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@ApiTags('Financial Engine')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('financial')
export class FinancialController {
  constructor(
    private readonly financialService: FinancialService,
    private readonly pdfservice: PdfGeneratorService,
    private readonly prisma: PrismaService
  ) { }

  // ===========================================================================
  // MODULE 1: FINANCIAL CHECKUP (MEDICAL CHECK)
  // ===========================================================================

  @Post('checkup')
  @ApiOperation({ summary: 'Simpan Data Checkup & Jalankan Analisa' })
  async createCheckup(@Req() req, @Body() dto: CreateFinancialRecordDto) {
    const userId = req.user.id;
    return this.financialService.createCheckup(userId, dto);
  }

  @Get('checkup/latest')
  @ApiOperation({ summary: 'Ambil data checkup terakhir' })
  async getLatestCheckup(@Req() req) {
    const userId = req.user.id;
    return this.financialService.getLatestCheckup(userId);
  }

  @Get('checkup/history')
  @ApiOperation({ summary: 'Ambil riwayat checkup user' })
  async getCheckupHistory(@Req() req) {
    const userId = req.user.id;
    return this.financialService.getCheckupHistory(userId);
  }

  // [NEW] Endpoint Detail Checkup (Roadmap Part 1)
  @Get('checkup/detail/:id')
  @ApiOperation({ summary: 'Ambil detail checkup spesifik berdasarkan ID' })
  async getCheckupDetail(@Req() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.financialService.getCheckupDetail(userId, id);
  }

  @Get('checkup/pdf/:id')
  @ApiOperation({ summary: 'Download PDF Report (Server-Side Generated)' })
  async downloadCheckupPdf(@Param('id') id: string, @Req() req, @Res() res: express.Response) {
    const userId = req.user.id;

    // 1. Ambil Data (Reuse logic getCheckupDetail)
    const checkupData = await this.financialService.getLatestCheckup(userId);
    // *Atau getCheckupDetail(userId, id) jika ingin spesifik history*

    if (!checkupData) throw new NotFoundException('Data not found');

    // 2. Generate PDF
    const buffer = await this.pdfservice.generateCheckupPdf(checkupData);

    // 3. Stream Response
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Financial-Checkup-${id}.pdf`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  // [UPDATED] Endpoint Download Budget PDF
  @Get('budget/pdf/:id')
  @ApiOperation({ summary: 'Download Budget PDF Report' })
  async downloadBudgetPdf(@Param('id') id: string, @Res() res: express.Response) {
    // 1. Ambil Data Budget + User Profile
    // [FIX] Hapus include 'userProfile', cukup include 'user' karena fullName & dateOfBirth ada di tabel User
    const budgetData = await this.prisma.budgetPlan.findUnique({
      where: { id },
      include: {
        user: true
      }
    });

    if (!budgetData) throw new NotFoundException('Data budget tidak ditemukan');

    // 2. Generate PDF
    const buffer = await this.pdfservice.generateBudgetPdf(budgetData);

    // 3. Return Stream
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Budget-Report-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // [NEW] Endpoint Download Pension PDF
  @Get('pension/pdf/:id')
  @ApiOperation({ summary: 'Download Pension Plan PDF Report' })
  async downloadPensionPdf(@Param('id') id: string, @Res() res: express.Response) {
    // 1. Ambil Data Pension berdasarkan ID, include User
    const pensionData = await this.prisma.pensionPlan.findUnique({
      where: { id },
      include: {
        user: true // Include data user untuk ambil nama
      }
    });

    if (!pensionData) throw new NotFoundException('Data rencana pensiun tidak ditemukan');

    // 2. Generate PDF
    const buffer = await this.pdfservice.generatePensionPdf(pensionData);

    // 3. Return Stream
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Pension-Plan-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // [NEW] Endpoint Download Insurance PDF
  @Get('insurance/pdf/:id')
  @ApiOperation({ summary: 'Download Insurance Plan PDF Report' })
  async downloadInsurancePdf(@Param('id') id: string, @Res() res: express.Response) {
    const insuranceData = await this.prisma.insurancePlan.findUnique({
      where: { id },
      include: {
        user: true
      }
    });

    if (!insuranceData) throw new NotFoundException('Data rencana asuransi tidak ditemukan');

    const buffer = await this.pdfservice.generateInsurancePdf(insuranceData);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Insurance-Plan-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ===========================================================================
  // MODULE 2: BUDGET PLAN (MONTHLY BUDGETING)
  // ===========================================================================

  @Post('budget')
  @ApiOperation({ summary: 'Simpan rencana anggaran bulanan (Auto-Calculate supported)' })
  async createBudget(@GetUser('id') userId: string, @Body() dto: CreateBudgetDto) {
    // Controller akan mengembalikan objek { budget, analysis } 
    // yang sudah berisi angka hasil kalkulasi otomatis dari Service
    return this.financialService.createBudget(userId, dto);
  }

  @Get('budget/history')
  @ApiOperation({ summary: 'Lihat riwayat anggaran user' })
  async getBudgets(@Req() req) {
    const userId = req.user.id;
    return this.financialService.getMyBudgets(userId);
  }

  // ===========================================================================
  // MODULE 3: CALCULATOR - PENSION PLAN (NEW)
  // ===========================================================================

  @Post('calculator/pension')
  @ApiOperation({ summary: 'Hitung & Simpan Rencana Pensiun' })
  async calculatePension(@Req() req, @Body() dto: CreatePensionDto) {
    const userId = req.user.id;
    return this.financialService.calculateAndSavePension(userId, dto);
  }

  // ===========================================================================
  // MODULE 4: CALCULATOR - INSURANCE PLAN (NEW)
  // ===========================================================================

  @Post('calculator/insurance')
  @ApiOperation({ summary: 'Hitung & Simpan Kebutuhan Asuransi' })
  async calculateInsurance(@Req() req, @Body() dto: CreateInsuranceDto) {
    const userId = req.user.id;
    return this.financialService.calculateAndSaveInsurance(userId, dto);
  }

  // ===========================================================================
  // MODULE 5: CALCULATOR - GOALS PLAN (NEW)
  // ===========================================================================

  // [NEW] Endpoint Simulasi Goals (Calculator Only)
  // Frontend harus hit: POST /financial/goals/simulate
  @Post('goals/simulate')
  @ApiOperation({ summary: 'Simulasi Cepat Tujuan Keuangan (FV & PMT) - Tidak Simpan DB' })
  async simulateGoal(@Req() req, @Body() dto: SimulateGoalDto) {
    const userId = req.user.id;
    return this.financialService.simulateGoal(userId, dto);
  }

  @Post('calculator/goals')
  @ApiOperation({ summary: 'Hitung & Simpan Tujuan Keuangan' })
  async calculateGoal(@Req() req, @Body() dto: CreateGoalDto) {
    const userId = req.user.id;
    return this.financialService.calculateAndSaveGoal(userId, dto);
  }

  // [NEW] Endpoint Download Goal PDF
  @Get('goals/pdf/:id')
  @ApiOperation({ summary: 'Download Financial Goal PDF Report' })
  async downloadGoalPdf(@Param('id') id: string, @Res() res: express.Response) {
    // 1. Ambil Data Goal
    const goalData = await this.prisma.goalPlan.findUnique({
      where: { id },
      include: {
        user: true
      }
    });

    if (!goalData) throw new NotFoundException('Data tujuan keuangan tidak ditemukan');

    // 2. Generate PDF
    const buffer = await this.pdfservice.generateGoalPdf(goalData);

    // 3. Stream Response
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Goal-Plan-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ===========================================================================
  // MODULE 6: CALCULATOR - EDUCATION PLAN (NEW)
  // ===========================================================================

  @Post('calculator/education')
  @ApiOperation({ summary: 'Hitung & Simpan Rencana Pendidikan Anak' })
  async calculateEducation(@Req() req, @Body() dto: CreateEducationPlanDto) {
    const userId = req.user.id;
    // Method ini mengembalikan { plan, calculation: { total, monthly, stagesBreakdown } }
    // Frontend akan menerima JSON lengkap ini untuk ditampilkan.
    return this.financialService.calculateAndSaveEducation(userId, dto);
  }

  @Get('calculator/education')
  @ApiOperation({ summary: 'Ambil daftar rencana pendidikan user' })
  async getEducationPlans(@Req() req) {
    const userId = req.user.id;
    return this.financialService.getEducationPlans(userId);
  }

  @Delete('calculator/education/:id')
  @ApiOperation({ summary: 'Hapus rencana pendidikan' })
  async deleteEducationPlan(@Req() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.financialService.deleteEducationPlan(userId, id);
  }

  // [UPDATED] Endpoint Download Education PDF (Family Report)
  // Perbaikan: Menggunakan relation 'stages' dan hitung total manual
  @Get('education/pdf')
  @ApiOperation({ summary: 'Download Education Plan PDF (All Children)' })
  async downloadEducationPdf(@Req() req, @Res() res: express.Response) {
    const userId = req.user.id;

    // 1. Ambil Data (Stages included)
    const educationPlans = await this.prisma.educationPlan.findMany({
      where: { userId },
      include: {
        stages: { // [FIX] Gunakan 'stages', bukan 'calculation'
          orderBy: { yearsToStart: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!educationPlans || educationPlans.length === 0) {
      throw new NotFoundException('Belum ada rencana pendidikan yang dibuat.');
    }

    // 2. Transform Data Structure (Manual Calculation)
    // PDF service butuh struktur: { plan: ..., calculation: { totalFutureCost, monthlySaving, stagesBreakdown } }
    const formattedData = educationPlans.map(p => {
      // Hitung total manual dari stages
      const totalFutureCost = p.stages.reduce((sum, stage) => sum + Number(stage.futureCost), 0);
      const totalMonthlySaving = p.stages.reduce((sum, stage) => sum + Number(stage.monthlySaving), 0);

      return {
        plan: p,
        calculation: {
          totalFutureCost: totalFutureCost,
          monthlySaving: totalMonthlySaving,
          stagesBreakdown: p.stages // Mapping stages DB ke stagesBreakdown PDF
        }
      };
    });

    // 3. Generate PDF
    const buffer = await this.pdfservice.generateEducationPdf(formattedData);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Education-Family-Plan.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // [NEW] Endpoint Download PDF from History Detail
  @Get('checkup/history/pdf/:id')
  @ApiOperation({ summary: 'Download History PDF Report' })
  async downloadHistoryPdf(@Param('id') id: string, @Req() req, @Res() res: express.Response) {
    const userId = req.user.id;

    // 1. Ambil Data Detail (Gabungan Raw + Analisa)
    // Reuse logic getCheckupDetail yang sudah ada di service
    const checkupDetail = await this.financialService.getCheckupDetail(userId, id);

    if (!checkupDetail) throw new NotFoundException('Data riwayat tidak ditemukan');

    // 2. Generate PDF dengan Template History
    const buffer = await this.pdfservice.generateHistoryCheckupPdf(checkupDetail);

    // 3. Stream Response
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Checkup-Report-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}