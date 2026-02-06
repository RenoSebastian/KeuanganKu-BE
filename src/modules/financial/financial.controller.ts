import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
  // Get, Param, Res, Req, NotFoundException // [LEGACY IMPORTS - Keep for reference if needed]
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
// import * as express from 'express'; // [LEGACY]
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

// --- SERVICES ---
import { BudgetService } from './services/budget.service';
import { InsuranceService } from './services/insurance.service'; // [NEW] Stateless Service
import { PdfGeneratorService } from './services/pdf-generator.service';
// import { FinancialService } from './financial.service'; // [LEGACY]
// import { PrismaService } from '../../../prisma/prisma.service'; // [REMOVED]

// --- DTOs ---
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateInsuranceDto } from './dto/create-insurance.dto'; // [NEW] Uncommented
// import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
// import { CreatePensionDto } from './dto/create-pension.dto';
// import { CreateGoalDto, SimulateGoalDto } from './dto/create-goal.dto';
// import { CreateEducationPlanDto } from './dto/create-education.dto';

@ApiTags('Financial Engine')
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FinancialController {
  private readonly logger = new Logger(FinancialController.name);

  constructor(
    private readonly budgetService: BudgetService,
    private readonly insuranceService: InsuranceService, // [NEW] Inject Insurance Service
    private readonly pdfService: PdfGeneratorService,
  ) { }

  // ===========================================================================
  // MODULE: BUDGETING ENGINE (STATELESS)
  // ===========================================================================

  @Post('budget/calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kalkulator Budgeting (Stateless)',
    description: 'Menghitung skor kesehatan dan rasio keuangan. Output JSON digunakan Frontend untuk membuat file .mgc.',
  })
  @ApiResponse({ status: 200, description: 'Perhitungan berhasil.' })
  calculateBudget(@Body() dto: CreateBudgetDto) {
    this.logger.log('Executing Stateless Budget Calculation');
    return this.budgetService.calculateBudget(dto);
  }

  // ===========================================================================
  // MODULE: INSURANCE ENGINE (STATELESS) - [NEW PHASE]
  // ===========================================================================

  @Post('insurance/calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kalkulator Asuransi (Stateless)',
    description: 'Menghitung kebutuhan Uang Pertanggungan (Jiwa, Kritis, Kesehatan) tanpa menyimpan data sensitif ke DB.',
  })
  @ApiResponse({ status: 200, description: 'Perhitungan gap asuransi berhasil.' })
  calculateInsurance(@Body() dto: CreateInsuranceDto) {
    this.logger.log('Executing Stateless Insurance Calculation');
    // Memanggil Pure Function di service
    return this.insuranceService.calculateInsurance(dto);
  }

  // ===========================================================================
  // [LEGACY / OFF-LIMITS AREA]
  // Endpoint lama dikomentari karena Tabel Database sudah dihapus.
  // ===========================================================================

  /*
  @Post('checkup')
  async createCheckup(@Req() req, @Body() dto: CreateFinancialRecordDto) {
    // Legacy implementation
  }

  // ... (Sisa endpoint legacy lainnya tetap dikomentari)
  */
}