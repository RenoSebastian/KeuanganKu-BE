import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { FinancialService } from './financial.service';

// --- IMPORT DTOs ---
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { CreatePensionDto } from './dto/create-pension.dto';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { CreateGoalDto, SimulateGoalDto } from './dto/create-goal.dto'; // [UPDATED] Import SimulateGoalDto
import { CreateEducationPlanDto } from './dto/create-education.dto';

// --- GUARDS ---
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@ApiTags('Financial Engine')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) { }

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
}