import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { FinancialService } from './financial.service';
import { CreateBudgetDto } from './dto/create-budget.dto';

@ApiTags('Financial Engine')
@UseGuards(AuthGuard('jwt')) // Wajib Login
@ApiBearerAuth()
@Controller('financial')
export class FinancialController {
  constructor(private financialService: FinancialService) {}

  @Post('budget')
  @ApiOperation({ summary: 'Simpan Anggaran & Jalankan Analisa Otomatis' })
  createBudget(@GetUser('id') userId: string, @Body() dto: CreateBudgetDto) {
    return this.financialService.createBudget(userId, dto);
  }

  @Get('budget/history')
  @ApiOperation({ summary: 'Lihat riwayat anggaran user' })
  getBudgets(@GetUser('id') userId: string) {
    return this.financialService.getMyBudgets(userId);
  }

  @Get('checkup/latest')
  @ApiOperation({ summary: 'Ambil skor kesehatan terakhir untuk Dashboard' })
  getLatestCheckup(@GetUser('id') userId: string) {
    return this.financialService.getLatestCheckup(userId);
  }
}