import { Injectable } from '@nestjs/common';

// DTOs
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { CreatePensionDto } from './dto/create-pension.dto';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { CreateGoalDto, SimulateGoalDto } from './dto/create-goal.dto';
import { CreateEducationPlanDto } from './dto/create-education.dto';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CalculateRiskProfileDto } from './dto/calculate-risk-profile.dto';
import { ImportSimulationDto } from './dto/import-simulation.dto';

// Simulation DTOs
import { CreateBudgetSimulationDto } from './dto/create-budget-simulation.dto';
import { CreateInsuranceSimulationDto } from './dto/create-insurance-simulation.dto';
import { CreatePensionSimulationDto } from './dto/create-pension-simulation.dto';
import { CreateGoalSimulationDto } from './dto/create-goal-simulation.dto';
import { CreateCheckupSimulationDto } from './dto/create-checkup-simulation.dto';
import { CreateRiskProfileSimulationDto } from './dto/create-risk-profile-simulation.dto';
import { CreateEducationSimulationDto } from './dto/create-education-simulation.dto';

// Specialized Services
import { FinancialQuotaService } from './services/core/financial-quota.service';
import { SimulationTokenService } from './services/core/simulation-token.service';
import { PensionCalculatorService } from './services/calculators/pension-calculator.service';
import { InsuranceCalculatorService } from './services/calculators/insurance-calculator.service';
import { EducationCalculatorService } from './services/calculators/education-calculator.service';
import { GoalCalculatorService } from './services/calculators/goal-calculator.service';
import { CheckupCalculatorService } from './services/calculators/checkup-calculator.service';
import { RiskProfileCalculatorService } from './services/calculators/risk-profile-calculator.service';

@Injectable()
export class FinancialService {
  constructor(
    private readonly quotaService: FinancialQuotaService,
    private readonly tokenService: SimulationTokenService,
    private readonly pensionService: PensionCalculatorService,
    private readonly insuranceService: InsuranceCalculatorService,
    private readonly educationService: EducationCalculatorService,
    private readonly goalService: GoalCalculatorService,
    private readonly checkupService: CheckupCalculatorService,
    private readonly riskProfileService: RiskProfileCalculatorService,
  ) { }

  // ===========================================================================
  // MODULE: FINANCIAL CHECKUP & BUDGETING
  // ===========================================================================

  createCheckup(userId: string, dto: CreateFinancialRecordDto) {
    return this.checkupService.createCheckup(userId, dto);
  }

  getLatestCheckup(userId: string) {
    return this.checkupService.getLatestCheckup(userId);
  }

  getCheckupHistory(userId: string) {
    return this.checkupService.getCheckupHistory(userId);
  }

  getCheckupDetail(userId: string, checkupId: string) {
    return this.checkupService.getCheckupDetail(userId, checkupId);
  }

  createBudget(userId: string, dto: CreateBudgetDto) {
    return this.checkupService.createBudget(userId, dto);
  }

  getMyBudgets(userId: string) {
    return this.checkupService.getMyBudgets(userId);
  }

  simulateAgentCheckup(user: any, dto: CreateCheckupSimulationDto) {
    return this.checkupService.simulateAgentCheckup(user, dto);
  }

  simulateAgentBudget(user: any, dto: CreateBudgetSimulationDto) {
    return this.checkupService.simulateAgentBudget(user, dto);
  }

  // ===========================================================================
  // MODULE: PENSION PLAN
  // ===========================================================================

  calculateAndSavePension(userId: string, dto: CreatePensionDto) {
    return this.pensionService.calculateAndSavePension(userId, dto);
  }

  simulateAgentPension(user: any, dto: CreatePensionSimulationDto) {
    return this.pensionService.simulateAgentPension(user, dto);
  }

  // ===========================================================================
  // MODULE: INSURANCE PLAN
  // ===========================================================================

  calculateAndSaveInsurance(userId: string, dto: CreateInsuranceDto) {
    return this.insuranceService.calculateAndSaveInsurance(userId, dto);
  }

  simulateAgentInsurance(user: any, dto: CreateInsuranceSimulationDto) {
    return this.insuranceService.simulateAgentInsurance(user, dto);
  }

  // ===========================================================================
  // MODULE: GOAL PLAN
  // ===========================================================================

  simulateGoal(userId: string, dto: SimulateGoalDto) {
    return this.goalService.simulateGoal(dto);
  }

  calculateAndSaveGoal(userId: string, dto: CreateGoalDto) {
    return this.goalService.calculateAndSaveGoal(userId, dto);
  }

  simulateAgentGoal(user: any, dto: CreateGoalSimulationDto) {
    return this.goalService.simulateAgentGoal(user, dto);
  }

  // ===========================================================================
  // MODULE: EDUCATION PLAN
  // ===========================================================================

  calculateAndSaveEducation(userId: string, dto: CreateEducationPlanDto) {
    return this.educationService.calculateAndSaveEducation(userId, dto);
  }

  getEducationPlans(userId: string) {
    return this.educationService.getEducationPlans(userId);
  }

  deleteEducationPlan(userId: string, planId: string) {
    return this.educationService.deleteEducationPlan(userId, planId);
  }

  simulateAgentEducation(user: any, dto: CreateEducationSimulationDto) {
    return this.educationService.simulateAgentEducation(user, dto);
  }

  async downloadEducationPdfById(simulationId: string, user: any) {
    // PASTIKAN memanggil method download, BUKAN delete
    return this.educationService.downloadEducationPdfById(simulationId, user);
  }

  // ===========================================================================
  // MODULE: RISK PROFILE
  // ===========================================================================

  calculateRiskProfile(dto: CalculateRiskProfileDto) {
    return this.riskProfileService.calculateRiskProfile(dto);
  }

  simulateAgentRiskProfile(user: any, dto: CreateRiskProfileSimulationDto) {
    return this.riskProfileService.simulateAgentRiskProfile(user, dto);
  }

  // ===========================================================================
  // UTILITIES & TOKENS
  // ===========================================================================

  verifyAndDecodeSimulationToken(dto: ImportSimulationDto) {
    return this.tokenService.verifyAndDecodeToken(dto.simulationToken);
  }
}