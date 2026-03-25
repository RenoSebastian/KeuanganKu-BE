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
import { Throttle } from '@nestjs/throttler';

// Services
import { FinancialService } from './financial.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

// DTOs - Existing Modules
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { CreatePensionDto } from './dto/create-pension.dto';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { CreateGoalDto, SimulateGoalDto } from './dto/create-goal.dto';
import { CreateEducationPlanDto } from './dto/create-education.dto';

// DTOs for Risk Profile
import { CalculateRiskProfileDto } from './dto/calculate-risk-profile.dto';
import { RiskProfileResponseDto } from './dto/risk-profile-response.dto';

// DTOs - Agent Simulation
import { CreateBudgetSimulationDto } from './dto/create-budget-simulation.dto';
import { ImportSimulationDto } from './dto/import-simulation.dto';
import { CreateInsuranceSimulationDto } from './dto/create-insurance-simulation.dto';
import { CreatePensionSimulationDto } from './dto/create-pension-simulation.dto';
import { CreateGoalSimulationDto } from './dto/create-goal-simulation.dto';
import { CreateCheckupSimulationDto } from './dto/create-checkup-simulation.dto';
import { CreateRiskProfileSimulationDto } from './dto/create-risk-profile-simulation.dto';
import { CreateEducationSimulationDto } from './dto/create-education-simulation.dto';

// Guards
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import * as client from '@prisma/client';

@ApiTags('Financial Engine')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('financial')
export class FinancialController {
  constructor(
    private readonly financialService: FinancialService,
    private readonly pdfGeneratorService: PdfGeneratorService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) { }

  // ===========================================================================
  // MODULE 1: FINANCIAL CHECKUP (MEDICAL CHECK)
  // ===========================================================================

  @Post('checkup')
  @ApiOperation({ summary: 'Simpan Data Checkup & Jalankan Analisa' })
  async createCheckup(@GetUser('id') userId: string, @Body() dto: CreateFinancialRecordDto) {
    return this.financialService.createCheckup(userId, dto);
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

  @Get('checkup/detail/:id')
  @ApiOperation({ summary: 'Ambil detail checkup spesifik berdasarkan ID' })
  async getCheckupDetail(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.financialService.getCheckupDetail(userId, id);
  }

  @Get('checkup/pdf/:id')
  @ApiOperation({ summary: 'Download PDF Report (Server-Side Generated)' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async downloadCheckupPdf(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Res() res: express.Response
  ) {
    const checkupData = await this.financialService.getLatestCheckup(userId);

    if (!checkupData) throw new NotFoundException('Data not found');

    const buffer = await this.pdfGeneratorService.generateCheckupPdf(checkupData);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Financial-Checkup-${id}.pdf`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get('budget/pdf/:id')
  @ApiOperation({ summary: 'Download Budget PDF Report' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async downloadBudgetPdf(@Param('id') id: string, @Res() res: express.Response) {
    const budgetData = await this.prisma.budgetPlan.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!budgetData) throw new NotFoundException('Data budget tidak ditemukan');

    const buffer = await this.pdfGeneratorService.generateBudgetPdf(budgetData);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Budget-Report-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('pension/pdf/:id')
  @ApiOperation({ summary: 'Download Pension Plan PDF Report' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async downloadPensionPdf(@Param('id') id: string, @Res() res: express.Response) {
    const pensionData = await this.prisma.pensionPlan.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!pensionData) throw new NotFoundException('Data rencana pensiun tidak ditemukan');

    const buffer = await this.pdfGeneratorService.generatePensionPdf(pensionData);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Pension-Plan-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('insurance/pdf/:id')
  @ApiOperation({ summary: 'Download Insurance Plan PDF Report' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async downloadInsurancePdf(@Param('id') id: string, @Res() res: express.Response) {
    const insuranceData = await this.prisma.insurancePlan.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!insuranceData) throw new NotFoundException('Data rencana asuransi tidak ditemukan');

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
  @ApiOperation({ summary: 'Simpan rencana anggaran bulanan' })
  async createBudget(@GetUser('id') userId: string, @Body() dto: CreateBudgetDto) {
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
  @ApiOperation({ summary: 'Simulasi Cepat Tujuan Keuangan (Stateless)' })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  simulateGoal(@GetUser('id') userId: string, @Body() dto: SimulateGoalDto) {
    return this.financialService.simulateGoal(userId, dto);
  }

  @Post('calculator/goals')
  @ApiOperation({ summary: 'Hitung & Simpan Tujuan Keuangan' })
  async calculateGoal(@GetUser('id') userId: string, @Body() dto: CreateGoalDto) {
    return this.financialService.calculateAndSaveGoal(userId, dto);
  }

  @Get('goals/pdf/:id')
  @ApiOperation({ summary: 'Download Financial Goal PDF Report' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async downloadGoalPdf(@Param('id') id: string, @Res() res: express.Response) {
    const goalData = await this.prisma.goalPlan.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!goalData) throw new NotFoundException('Data tujuan keuangan tidak ditemukan');

    const buffer = await this.pdfGeneratorService.generateGoalPdf(goalData);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Goal-Plan-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ===========================================================================
  // MODULE 6: CALCULATOR - EDUCATION PLAN (EXISTING)
  // ===========================================================================

  @Post('calculator/education')
  @ApiOperation({ summary: 'Hitung & Simpan Rencana Pendidikan Anak' })
  async calculateEducation(@GetUser('id') userId: string, @Body() dto: CreateEducationPlanDto) {
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

  @Get('education/pdf')
  @ApiOperation({ summary: 'Download Education Plan PDF (All Children)' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async downloadEducationPdf(@GetUser('id') userId: string, @Res() res: express.Response) {
    const educationPlans = await this.prisma.educationPlan.findMany({
      where: { userId },
      include: {
        stages: { orderBy: { yearsToStart: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!educationPlans || educationPlans.length === 0) {
      throw new NotFoundException('Belum ada rencana pendidikan yang dibuat.');
    }

    const formattedData = educationPlans.map(p => {
      const totalFutureCost = p.stages.reduce((sum, stage) => sum + Number(stage.futureCost), 0);
      const totalMonthlySaving = p.stages.reduce((sum, stage) => sum + Number(stage.monthlySaving), 0);

      return {
        plan: p,
        calculation: {
          totalFutureCost,
          monthlySaving: totalMonthlySaving,
          stagesBreakdown: p.stages
        }
      };
    });

    const buffer = await this.pdfGeneratorService.generateEducationPdf(formattedData);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Education-Family-Plan.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('checkup/history/pdf/:id')
  @ApiOperation({ summary: 'Download History PDF Report' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async downloadHistoryPdf(@Param('id') id: string, @GetUser('id') userId: string, @Res() res: express.Response) {
    const checkupDetail = await this.financialService.getCheckupDetail(userId, id);

    if (!checkupDetail) throw new NotFoundException('Data riwayat tidak ditemukan');

    const buffer = await this.pdfGeneratorService.generateHistoryCheckupPdf(checkupDetail);

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
  @ApiOperation({ summary: 'Kalkulasi Profil Risiko (Stateless)' })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiResponse({ status: 200, type: RiskProfileResponseDto })
  calculateRiskProfile(@Body() dto: CalculateRiskProfileDto): RiskProfileResponseDto {
    return this.financialService.calculateRiskProfile(dto);
  }

  @Post('simulation/risk-profile-pdf')
  @ApiOperation({ summary: 'Simulasi Risk Profile & Download PDF Langsung' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createRiskProfileSimulation(
    @GetUser() user: client.User,
    @Body() dto: CreateRiskProfileSimulationDto,
    @Res() res: express.Response,
  ) {
    const result = await this.financialService.simulateAgentRiskProfile(user, dto);

    await this.auditService.logActivity({
      userId: user.id,
      action: 'SIMULATE_RISK_PROFILE',
      entity: 'SimulationLog',
      entityId: 'ANONYMOUS',
      details: `Agent ${user.fullName} generated risk profile simulation for client ${dto.clientName}`,
      ip: '0.0.0.0',
      userAgent: 'AgentSystem',
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.pdfBuffer.length,
      'X-MGC-Token': result.mgcToken,
      'Access-Control-Expose-Headers': 'X-MGC-Token, Content-Disposition',
    });

    res.end(result.pdfBuffer);
  }

  @Post('export/risk-profile-pdf')
  @ApiOperation({ summary: 'Generate PDF Laporan Profil Risiko (Legacy)' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="Risk_Profile_Report.pdf"')
  async exportRiskProfilePdf(
    @GetUser('id') userId: string,
    @Body() data: RiskProfileResponseDto,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<StreamableFile> {
    const pdfBuffer = await this.pdfGeneratorService.generateRiskProfilePdf(data);

    const cleanName = data.clientName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `RiskProfile_${cleanName}_${new Date().getTime()}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    await this.auditService.logActivity({
      userId,
      action: 'EXPORT_PDF',
      entity: 'RiskProfileSimulation',
      entityId: 'STATELESS',
      details: `Agent generated Risk Profile PDF for client: ${data.clientName}`,
    });

    return new StreamableFile(pdfBuffer);
  }

  // ===========================================================================
  // MODULE 8: AGENT BUDGET SIMULATION (STATELESS STREAMING)
  // ===========================================================================

  @Post('simulation/budget')
  @ApiOperation({ summary: 'Simulasi Budget & Download PDF Langsung' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createBudgetSimulation(
    @GetUser() user: client.User,
    @Body() dto: CreateBudgetSimulationDto,
    @Res() res: express.Response,
  ) {
    const result = await this.financialService.simulateAgentBudget(user, dto);

    await this.auditService.logActivity({
      userId: user.id,
      action: 'SIMULATE_BUDGET',
      entity: 'SimulationLog',
      entityId: 'ANONYMOUS',
      details: `Agent ${user.fullName} generated stateless simulation for client ${dto.clientName}`,
      ip: '0.0.0.0',
      userAgent: 'AgentSystem'
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.pdfBuffer.length,
      'X-MGC-Token': result.mgcToken,
      'Access-Control-Expose-Headers': 'X-MGC-Token, Content-Disposition',
    });

    res.end(result.pdfBuffer);
  }

  @Post('simulation/decode')
  @ApiOperation({ summary: 'Decode Token Simulasi (.mgc)' })
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  async decodeSimulation(@GetUser('id') userId: string, @Body() dto: ImportSimulationDto) {
    await this.auditService.logActivity({
      userId,
      action: 'IMPORT_SIMULATION',
      entity: 'SimulationToken',
      entityId: 'STATELESS',
      details: 'Agent imported a .mgc simulation file'
    });

    return this.financialService.verifyAndDecodeSimulationToken(dto);
  }

  // ===========================================================================
  // MODULE 9: AGENT INSURANCE SIMULATION (STATELESS STREAMING)
  // ===========================================================================

  @Post('simulation/insurance')
  @ApiOperation({ summary: 'Simulasi Asuransi & Download PDF Langsung' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createInsuranceSimulation(
    @GetUser() user: client.User,
    @Body() dto: CreateInsuranceSimulationDto,
    @Res() res: express.Response,
  ) {
    const result = await this.financialService.simulateAgentInsurance(user, dto);

    await this.auditService.logActivity({
      userId: user.id,
      action: 'SIMULATE_INSURANCE',
      entity: 'SimulationLog',
      entityId: 'ANONYMOUS',
      details: `Agent ${user.fullName} generated insurance simulation for client ${dto.clientName}`,
      ip: '0.0.0.0',
      userAgent: 'AgentSystem'
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.pdfBuffer.length,
      'X-MGC-Token': result.mgcToken,
      'Access-Control-Expose-Headers': 'X-MGC-Token, Content-Disposition',
    });

    res.end(result.pdfBuffer);
  }

  // ===========================================================================
  // MODULE 10: AGENT PENSION SIMULATION (STATELESS STREAMING)
  // ===========================================================================

  @Post('simulation/pension')
  @ApiOperation({ summary: 'Simulasi Pensiun & Download PDF Langsung' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createPensionSimulation(
    @GetUser() user: client.User,
    @Body() dto: CreatePensionSimulationDto,
    @Res() res: express.Response,
  ) {
    const result = await this.financialService.simulateAgentPension(user, dto);

    await this.auditService.logActivity({
      userId: user.id,
      action: 'SIMULATE_PENSION',
      entity: 'SimulationLog',
      entityId: 'ANONYMOUS',
      details: `Agent ${user.fullName} generated pension simulation for client ${dto.clientName}`,
      ip: '0.0.0.0',
      userAgent: 'AgentSystem'
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.pdfBuffer.length,
      'X-MGC-Token': result.mgcToken,
      'Access-Control-Expose-Headers': 'X-MGC-Token, Content-Disposition',
    });

    res.end(result.pdfBuffer);
  }

  // ===========================================================================
  // MODULE 11: AGENT GOAL SIMULATION (STATELESS STREAMING)
  // ===========================================================================

  @Post('simulation/goals')
  @ApiOperation({ summary: 'Simulasi Tujuan Keuangan & Download PDF Langsung' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createGoalSimulation(
    @GetUser() user: client.User,
    @Body() dto: CreateGoalSimulationDto,
    @Res() res: express.Response,
  ) {
    const result = await this.financialService.simulateAgentGoal(user, dto);

    await this.auditService.logActivity({
      userId: user.id,
      action: 'SIMULATE_GOAL',
      entity: 'SimulationLog',
      entityId: 'ANONYMOUS',
      details: `Agent ${user.fullName} generated goal simulation for client ${dto.clientName}`,
      ip: '0.0.0.0',
      userAgent: 'AgentSystem'
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.pdfBuffer.length,
      'X-MGC-Token': result.mgcToken,
      'Access-Control-Expose-Headers': 'X-MGC-Token, Content-Disposition',
    });

    res.end(result.pdfBuffer);
  }

  // ===========================================================================
  // MODULE 12: AGENT FINANCIAL CHECKUP SIMULATION (DECOUPLED)
  // ===========================================================================

  @Post('simulation/checkup/calculate')
  @ApiOperation({ summary: 'Kalkulasi Financial Checkup (JSON State Return)' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async calculateCheckupSimulation(
    @GetUser() user: client.User,
    @Body() dto: CreateCheckupSimulationDto,
  ) {
    const result = await this.financialService.calculateCheckupSimulation(user, dto);

    await this.auditService.logActivity({
      userId: user.id,
      action: 'CALCULATE_CHECKUP',
      entity: 'SimulationLog',
      entityId: result.meta?.simulationId || 'UNKNOWN', // [FIXED] Penyesuaian akses ke properti meta
      details: `Agent ${user.fullName} calculated checkup simulation for client ${dto.client.name}`,
      ip: '0.0.0.0',
      userAgent: 'AgentSystem'
    });

    return result;
  }

  @Get('simulation/checkup/:id/pdf')
  @ApiOperation({ summary: 'Download PDF Simulasi Checkup (On-Demand)' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async downloadCheckupPdfById(
    @Param('id') id: string,
    @GetUser() user: client.User,
    @Res() res: express.Response,
  ) {
    // 1. Service Call (Generate PDF from persisted state)
    const pdfBuffer = await this.financialService.downloadCheckupPdfById(id, user);

    // 2. Audit Log (Download Event)
    await this.auditService.logActivity({
      userId: user.id,
      action: 'DOWNLOAD_SIMULATION_PDF',
      entity: 'SimulationLog',
      entityId: id,
      details: `Agent ${user.fullName} downloaded checkup PDF ${id}`,
    });

    // 3. Return Stream
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Checkup_Simulation_${id}.pdf"`,
      'Content-Length': (pdfBuffer as Buffer).length,
    });

    res.end(pdfBuffer);
  }

  // ===========================================================================
  // MODULE 13: AGENT EDUCATION SIMULATION (SCENARIO B: SPLIT ENDPOINTS)
  // ===========================================================================

  @Post('simulation/education/calculate')
  @ApiOperation({ summary: 'Simulasi Pendidikan - Hitung (JSON Only)' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async calculateEducationSimulation(
    @GetUser() user: client.User,
    @Body() dto: CreateEducationSimulationDto,
  ) {
    const result = await this.financialService.simulateAgentEducation(user, dto);

    await this.auditService.logActivity({
      userId: user.id,
      action: 'SIMULATE_EDUCATION',
      entity: 'SimulationLog',
      // Jika Education juga menggunakan pattern 'meta', maka ubah ke result.meta?.simulationId
      // Jika tidak, tetap biarkan result.simulationId
      entityId: result.simulationId || 'UNKNOWN',
      details: `Agent ${user.fullName} calculated education plan for client ${dto.clientName}`,
      ip: '0.0.0.0',
      userAgent: 'AgentSystem'
    });

    return result;
  }

  @Get('simulation/education/:id/pdf')
  @ApiOperation({ summary: 'Simulasi Pendidikan - Download PDF (Stream)' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async downloadEducationPdfById(
    @Param('id') id: string,
    @GetUser() user: client.User,
    @Res() res: express.Response,
  ) {
    // 1. Service Call (Generate PDF on-demand)
    const pdfBuffer = await this.financialService.downloadEducationPdfById(id, user);

    // 2. Audit Log (Download Event)
    await this.auditService.logActivity({
      userId: user.id,
      action: 'DOWNLOAD_SIMULATION_PDF',
      entity: 'SimulationLog',
      entityId: id,
      details: `Agent ${user.fullName} downloaded education PDF ${id}`,
    });

    // 3. Return Stream
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Education_Plan_${id}.pdf"`,
      'Content-Length': (pdfBuffer as Buffer).length,
    });

    res.end(pdfBuffer);
  }
}