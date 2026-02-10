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
  Header,
  StreamableFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import * as express from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

// Services
import { FinancialService } from './financial.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service'; // [FIX] Import AuditService

// DTOs
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { CreatePensionDto } from './dto/create-pension.dto';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { CreateGoalDto, SimulateGoalDto } from './dto/create-goal.dto';
import { CreateEducationPlanDto } from './dto/create-education.dto';

// DTOs for Risk Profile
import { CalculateRiskProfileDto } from './dto/calculate-risk-profile.dto';
import { RiskProfileResponseDto } from './dto/risk-profile-response.dto';

// [NEW] DTOs - Agent Simulation (Phase 2 & 5)
import { CreateBudgetSimulationDto } from './dto/create-budget-simulation.dto';
import { ImportSimulationDto } from './dto/import-simulation.dto';
import { CreateInsuranceSimulationDto } from './dto/create-insurance-simulation.dto';

// Guards
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import * as client from '@prisma/client'; // Import User type for type-safety

@ApiTags('Financial Engine')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('financial')
export class FinancialController {
  constructor(
    private readonly financialService: FinancialService,
    private readonly pdfGeneratorService: PdfGeneratorService, // [FIX] Renamed from pdfservice to match usage
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService, // [FIX] Injected AuditService properly
  ) { }

  // ===========================================================================
  // MODULE 1: FINANCIAL CHECKUP (MEDICAL CHECK)
  // ===========================================================================

  @Post('checkup')
  @ApiOperation({ summary: 'Simpan Data Checkup & Jalankan Analisa' })
  async createCheckup(@GetUser('id') userId: string, @Body() dto: CreateFinancialRecordDto) {
    const result = await this.financialService.createCheckup(userId, dto);
    return result;
  }

  @Get('checkup/latest')
  @ApiOperation({ summary: 'Ambil data checkup terakhir' })
  async getLatestCheckup(@GetUser('id') userId: string) {
    return this.financialService.getLatestCheckup(userId);
  }

  @Get('checkup/history')
  @ApiOperation({ summary: 'Ambil riwayat checkup user' })
  async getCheckupHistory(@GetUser('id') userId: string) {
    return this.financialService.getCheckupHistory(userId);
  }

  // [NEW] Endpoint Detail Checkup (Roadmap Part 1)
  @Get('checkup/detail/:id')
  @ApiOperation({ summary: 'Ambil detail checkup spesifik berdasarkan ID' })
  async getCheckupDetail(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.financialService.getCheckupDetail(userId, id);
  }

  @Get('checkup/pdf/:id')
  @ApiOperation({ summary: 'Download PDF Report (Server-Side Generated)' })
  async downloadCheckupPdf(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Res() res: express.Response
  ) {
    // 1. Ambil Data (Reuse logic getCheckupDetail)
    const checkupData = await this.financialService.getLatestCheckup(userId);
    // *Atau getCheckupDetail(userId, id) jika ingin spesifik history*

    if (!checkupData) throw new NotFoundException('Data not found');

    // 2. Generate PDF
    // [FIX] Updated to use pdfGeneratorService
    const buffer = await this.pdfGeneratorService.generateCheckupPdf(checkupData);

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
    const budgetData = await this.prisma.budgetPlan.findUnique({
      where: { id },
      include: {
        user: true
      }
    });

    if (!budgetData) throw new NotFoundException('Data budget tidak ditemukan');

    // 2. Generate PDF
    // [FIX] Updated to use pdfGeneratorService
    const buffer = await this.pdfGeneratorService.generateBudgetPdf(budgetData);

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
    // [FIX] Updated to use pdfGeneratorService
    const buffer = await this.pdfGeneratorService.generatePensionPdf(pensionData);

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

    // [FIX] Updated to use pdfGeneratorService
    const buffer = await this.pdfGeneratorService.generateInsurancePdf(insuranceData);

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
  async getBudgets(@GetUser('id') userId: string) {
    return this.financialService.getMyBudgets(userId);
  }

  // ===========================================================================
  // MODULE 3: CALCULATOR - PENSION PLAN
  // ===========================================================================

  @Post('calculator/pension')
  @ApiOperation({ summary: 'Hitung & Simpan Rencana Pensiun' })
  async calculatePension(@GetUser('id') userId: string, @Body() dto: CreatePensionDto) {
    return this.financialService.calculateAndSavePension(userId, dto);
  }

  // ===========================================================================
  // MODULE 4: CALCULATOR - INSURANCE PLAN
  // ===========================================================================

  @Post('calculator/insurance')
  @ApiOperation({ summary: 'Hitung & Simpan Kebutuhan Asuransi' })
  async calculateInsurance(@GetUser('id') userId: string, @Body() dto: CreateInsuranceDto) {
    return this.financialService.calculateAndSaveInsurance(userId, dto);
  }

  // ===========================================================================
  // MODULE 5: CALCULATOR - GOALS PLAN
  // ===========================================================================

  @Post('goals/simulate')
  @ApiOperation({ summary: 'Simulasi Cepat Tujuan Keuangan (FV & PMT) - Tidak Simpan DB' })
  simulateGoal(@GetUser('id') userId: string, @Body() dto: SimulateGoalDto) {
    return this.financialService.simulateGoal(userId, dto);
  }

  @Post('calculator/goals')
  @ApiOperation({ summary: 'Hitung & Simpan Tujuan Keuangan' })
  async calculateGoal(@GetUser('id') userId: string, @Body() dto: CreateGoalDto) {
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
    // [FIX] Updated to use pdfGeneratorService
    const buffer = await this.pdfGeneratorService.generateGoalPdf(goalData);

    // 3. Stream Response
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Goal-Plan-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ===========================================================================
  // MODULE 6: CALCULATOR - EDUCATION PLAN
  // ===========================================================================

  @Post('calculator/education')
  @ApiOperation({ summary: 'Hitung & Simpan Rencana Pendidikan Anak' })
  async calculateEducation(@GetUser('id') userId: string, @Body() dto: CreateEducationPlanDto) {
    // Method ini mengembalikan { plan, calculation: { total, monthly, stagesBreakdown } }
    return this.financialService.calculateAndSaveEducation(userId, dto);
  }

  @Get('calculator/education')
  @ApiOperation({ summary: 'Ambil daftar rencana pendidikan user' })
  async getEducationPlans(@GetUser('id') userId: string) {
    return this.financialService.getEducationPlans(userId);
  }

  @Delete('calculator/education/:id')
  @ApiOperation({ summary: 'Hapus rencana pendidikan' })
  async deleteEducationPlan(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.financialService.deleteEducationPlan(userId, id);
  }

  // [UPDATED] Endpoint Download Education PDF (Family Report)
  @Get('education/pdf')
  @ApiOperation({ summary: 'Download Education Plan PDF (All Children)' })
  async downloadEducationPdf(@GetUser('id') userId: string, @Res() res: express.Response) {
    const educationPlans = await this.prisma.educationPlan.findMany({
      where: { userId },
      include: {
        stages: {
          orderBy: { yearsToStart: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!educationPlans || educationPlans.length === 0) {
      throw new NotFoundException('Belum ada rencana pendidikan yang dibuat.');
    }

    // 2. Transform Data Structure
    const formattedData = educationPlans.map(p => {
      const totalFutureCost = p.stages.reduce((sum, stage) => sum + Number(stage.futureCost), 0);
      const totalMonthlySaving = p.stages.reduce((sum, stage) => sum + Number(stage.monthlySaving), 0);

      return {
        plan: p,
        calculation: {
          totalFutureCost: totalFutureCost,
          monthlySaving: totalMonthlySaving,
          stagesBreakdown: p.stages
        }
      };
    });

    // 3. Generate PDF
    // [FIX] Updated to use pdfGeneratorService
    const buffer = await this.pdfGeneratorService.generateEducationPdf(formattedData);

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
  async downloadHistoryPdf(@Param('id') id: string, @GetUser('id') userId: string, @Res() res: express.Response) {
    // 1. Ambil Data Detail (Gabungan Raw + Analisa)
    const checkupDetail = await this.financialService.getCheckupDetail(userId, id);

    if (!checkupDetail) throw new NotFoundException('Data riwayat tidak ditemukan');

    // 2. Generate PDF dengan Template History
    // [FIX] Updated to use pdfGeneratorService
    const buffer = await this.pdfGeneratorService.generateHistoryCheckupPdf(checkupDetail);

    // 3. Stream Response
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Checkup-Report-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ===========================================================================
  // MODULE 7: RISK PROFILE (STATELESS SIMULATION)
  // ===========================================================================

  @Post('simulation/risk-profile')
  @ApiOperation({
    summary: 'Kalkulasi Profil Risiko (Stateless)',
    description:
      'Menerima jawaban kuesioner, mengembalikan skor, tipe profil, dan rekomendasi alokasi aset. Data tidak disimpan ke database.',
  })
  @ApiResponse({ status: 200, type: RiskProfileResponseDto })
  calculateRiskProfile(@Body() dto: CalculateRiskProfileDto): RiskProfileResponseDto {
    return this.financialService.calculateRiskProfile(dto);
  }

  @Post('export/risk-profile-pdf')
  @ApiOperation({
    summary: 'Generate PDF Laporan Profil Risiko',
    description:
      'Menerima Object Hasil Kalkulasi (RiskProfileResponseDto) dan menghasilkan file PDF untuk diunduh.',
  })
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="Risk_Profile_Report.pdf"')
  async exportRiskProfilePdf(
    @GetUser('id') userId: string,
    @Body() data: RiskProfileResponseDto,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<StreamableFile> {

    // 1. Generate PDF Buffer
    // [FIX] Menggunakan this.pdfGeneratorService yang sudah benar
    const pdfBuffer = await this.pdfGeneratorService.generateRiskProfilePdf(data);

    // 2. Setup Filename yang deskriptif
    const cleanName = data.clientName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `RiskProfile_${cleanName}_${new Date().getTime()}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    // 3. Audit Log
    // [FIX] Menggunakan this.auditService yang sudah di-inject
    await this.auditService.logActivity({
      userId,
      action: 'EXPORT_PDF',
      entity: 'RiskProfileSimulation', // Virtual Entity
      entityId: 'STATELESS',
      details: `Agent generated Risk Profile PDF for client: ${data.clientName} (Profile: ${data.riskProfile})`,
    });

    // 4. Return Stream
    return new StreamableFile(pdfBuffer);
  }

  // ===========================================================================
  // MODULE 8: AGENT BUDGET SIMULATION (STATELESS STREAMING)
  // ===========================================================================

  @Post('simulation/budget')
  @ApiOperation({ summary: 'Simulasi Budget & Download PDF Langsung (Stateless)' })
  async createBudgetSimulation(
    @GetUser() user: client.User,
    @Body() dto: CreateBudgetSimulationDto,
    @Res() res: express.Response,
  ) {
    // 1. Eksekusi Service -> Dapat Buffer PDF & Token
    const result = await this.financialService.simulateAgentBudget(user, dto);

    // 2. Audit Log
    await this.auditService.logActivity({
      userId: user.id,
      action: 'SIMULATE_BUDGET',
      entity: 'SimulationLog',
      entityId: 'ANONYMOUS',
      details: `Agent ${user.fullName} generated stateless simulation for client ${dto.clientName}`,
      ip: '0.0.0.0', // [FIXED] Changed 'ipAddress' to 'ip'
      userAgent: 'AgentSystem'
    });

    // 3. SET HTTP HEADERS (CRITICAL STEP)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.pdfBuffer.length,

      // [SECURITY HEADER] Kirim Token .mgc via Header agar FE bisa menangkapnya
      // tanpa harus mengotori body file PDF
      'X-MGC-Token': result.mgcToken,

      // Mengizinkan Browser/Frontend membaca header custom ini
      'Access-Control-Expose-Headers': 'X-MGC-Token, Content-Disposition',
    });

    // 4. STREAM DATA LANGSUNG KE CLIENT
    res.end(result.pdfBuffer);
  }

  @Post('simulation/decode')
  @ApiOperation({ summary: 'Decode Token Simulasi (.mgc) untuk Import Data' })
  async decodeSimulation(@GetUser('id') userId: string, @Body() dto: ImportSimulationDto) {
    // Audit Log untuk Import Action
    await this.auditService.logActivity({
      userId,
      action: 'IMPORT_SIMULATION',
      entity: 'SimulationToken',
      entityId: 'STATELESS',
      details: 'Agent successfully imported a .mgc simulation file'
    });

    return this.financialService.verifyAndDecodeSimulationToken(dto);
  }

  // ===========================================================================
  // MODULE 9: AGENT INSURANCE SIMULATION (STATELESS STREAMING)
  // ===========================================================================

  @Post('simulation/insurance')
  @ApiOperation({
    summary: 'Simulasi Asuransi & Download PDF Langsung (Stateless)',
    description: 'Menghitung kebutuhan proteksi, membuat log analitik, dan mengembalikan PDF + Token .mgc tanpa menyimpan data detail ke database.'
  })
  async createInsuranceSimulation(
    @GetUser() user: client.User,
    @Body() dto: CreateInsuranceSimulationDto,
    @Res() res: express.Response,
  ) {
    // 1. Eksekusi Service -> Dapat Buffer PDF & Token
    const result = await this.financialService.simulateAgentInsurance(user, dto);

    // 2. Audit Log (Tetap catat aktivitas)
    await this.auditService.logActivity({
      userId: user.id,
      action: 'SIMULATE_INSURANCE',
      entity: 'SimulationLog',
      entityId: 'ANONYMOUS',
      details: `Agent ${user.fullName} generated insurance simulation for client ${dto.clientName}`,
      ip: '0.0.0.0', // Atau ambil dari @Req() jika perlu
      userAgent: 'AgentSystem'
    });

    // 3. SET HTTP HEADERS (CRITICAL STEP)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.pdfBuffer.length,

      // [SECURITY HEADER] Kirim Token .mgc via Header agar FE bisa menangkapnya
      // tanpa harus mengotori body file PDF
      'X-MGC-Token': result.mgcToken,

      // Mengizinkan Browser/Frontend membaca header custom ini
      'Access-Control-Expose-Headers': 'X-MGC-Token, Content-Disposition',
    });

    // 4. STREAM DATA LANGSUNG KE CLIENT
    res.end(result.pdfBuffer);
  }
}