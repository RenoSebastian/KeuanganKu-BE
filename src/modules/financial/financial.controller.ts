import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

// --- SERVICES ---
import { BudgetService } from './services/budget.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
// import { FinancialService } from './financial.service'; // [LEGACY] Commented out
// import { PrismaService } from '../../../prisma/prisma.service'; // [REMOVED] Controller should not access DB directly

// --- DTOs ---
import { CreateBudgetDto } from './dto/create-budget.dto';
// import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
// import { CreatePensionDto } from './dto/create-pension.dto';
// import { CreateInsuranceDto } from './dto/create-insurance.dto';
// import { CreateGoalDto, SimulateGoalDto } from './dto/create-goal.dto';
// import { CreateEducationPlanDto } from './dto/create-education.dto';

@ApiTags('Financial Engine')
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard) // Guard tetap ada untuk memastikan hanya Agen aktif yang bisa akses kalkulator
@ApiBearerAuth()
export class FinancialController {
  private readonly logger = new Logger(FinancialController.name);

  constructor(
    private readonly budgetService: BudgetService, // [NEW] Stateless Engine
    private readonly pdfService: PdfGeneratorService,
    // private readonly financialService: FinancialService, // [LEGACY]
    // private readonly prisma: PrismaService // [LEGACY]
  ) { }

  // ===========================================================================
  // [PHASE 4] MODULE: BUDGETING ENGINE (STATELESS)
  // ===========================================================================

  @Post('budget/calculate')
  @HttpCode(HttpStatus.OK) // 200 OK (Stateless Calculation, no DB Create)
  @ApiOperation({
    summary: 'Kalkulator Budgeting (Stateless)',
    description: 'Menghitung skor kesehatan dan rasio keuangan tanpa menyimpan data ke database. Output JSON digunakan Frontend untuk membuat file .mgc.'
  })
  @ApiResponse({ status: 200, description: 'Perhitungan berhasil.' })
  calculateBudget(@Body() dto: CreateBudgetDto) {
    this.logger.log('Executing Stateless Budget Calculation');
    // Tidak butuh req.user.id karena tidak ada penyimpanan ke DB user
    return this.budgetService.calculateBudget(dto);
  }

  // ===========================================================================
  // [LEGACY / TO-BE-REFACTORED]
  // Endpoint di bawah ini dikomentari karena Tabel Database (BudgetPlan, dll) 
  // sudah dihapus atau sedang dalam proses refactor ke Stateless.
  // Aktifkan kembali satu per satu setelah membuat Service Stateless-nya.
  // ===========================================================================

  /*
  // --- MODULE 1: FINANCIAL CHECKUP ---

  @Post('checkup')
  @ApiOperation({ summary: '[LEGACY] Simpan Data Checkup' })
  async createCheckup(@Req() req, @Body() dto: CreateFinancialRecordDto) {
    // return this.financialService.createCheckup(req.user.id, dto);
    throw new Error("Endpoint ini sedang dalam maintenance refactor.");
  }

  @Get('checkup/latest')
  async getLatestCheckup(@Req() req) {
    // return this.financialService.getLatestCheckup(req.user.id);
  }

  @Get('checkup/pdf/:id')
  async downloadCheckupPdf(@Param('id') id: string, @Res() res: express.Response) {
    // Logic lama butuh fetch DB by ID. Nanti diganti POST /checkup/pdf (Generate from JSON)
  }

  // --- MODULE 2: BUDGET PLAN (Moved to calculateBudget above) ---

  @Post('budget')
  async createBudget(@Req() req, @Body() dto: CreateBudgetDto) {
     // Deprecated. Use /budget/calculate
  }

  @Get('budget/pdf/:id')
  async downloadBudgetPdf(@Param('id') id: string, @Res() res: express.Response) {
     // Legacy PDF logic requires DB access
  }

  // --- MODULE 3: PENSION PLAN ---

  @Post('calculator/pension')
  async calculatePension(@Req() req, @Body() dto: CreatePensionDto) {
    // return this.financialService.calculateAndSavePension(req.user.id, dto);
  }

  // --- MODULE 4: INSURANCE PLAN ---

  @Post('calculator/insurance')
  async calculateInsurance(@Req() req, @Body() dto: CreateInsuranceDto) {
    // return this.financialService.calculateAndSaveInsurance(req.user.id, dto);
  }

  // --- MODULE 5: GOALS PLAN ---

  @Post('goals/simulate')
  async simulateGoal(@Req() req, @Body() dto: SimulateGoalDto) {
    // return this.financialService.simulateGoal(req.user.id, dto);
  }

  @Post('calculator/goals')
  async calculateGoal(@Req() req, @Body() dto: CreateGoalDto) {
    // return this.financialService.calculateAndSaveGoal(req.user.id, dto);
  }

  // --- MODULE 6: EDUCATION PLAN ---

  @Post('calculator/education')
  async calculateEducation(@Req() req, @Body() dto: CreateEducationPlanDto) {
    // return this.financialService.calculateAndSaveEducation(req.user.id, dto);
  }
  */
}