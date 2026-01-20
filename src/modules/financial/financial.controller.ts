import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { FinancialService } from './financial.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard'; // Opsional jika ada role

@ApiTags('Financial Engine')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

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

  // ===========================================================================
  // MODULE 2: BUDGET PLAN (MONTHLY BUDGETING)
  // ===========================================================================

  @Post('budget')
  @ApiOperation({ summary: 'Simpan Anggaran Bulanan' })
  async createBudget(@Req() req, @Body() dto: CreateBudgetDto) {
    const userId = req.user.id;
    return this.financialService.createBudget(userId, dto);
  }

  @Get('budget/history') // Endpoint existing, kita pertahankan
  @ApiOperation({ summary: 'Lihat riwayat anggaran user' })
  async getBudgets(@Req() req) {
    const userId = req.user.id;
    return this.financialService.getMyBudgets(userId);
  }
}