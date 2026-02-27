import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';
import { PdfGeneratorService } from './services/pdf-generator.service';

// Core Services
import { FinancialQuotaService } from './services/core/financial-quota.service';
import { SimulationTokenService } from './services/core/simulation-token.service';

// Calculator Services
import { PensionCalculatorService } from './services/calculators/pension-calculator.service';
import { InsuranceCalculatorService } from './services/calculators/insurance-calculator.service';
import { EducationCalculatorService } from './services/calculators/education-calculator.service';
import { GoalCalculatorService } from './services/calculators/goal-calculator.service';
import { CheckupCalculatorService } from './services/calculators/checkup-calculator.service';
import { RiskProfileCalculatorService } from './services/calculators/risk-profile-calculator.service';

// External Modules
import { MasterDataModule } from '../master-data/master-data.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MasterDataModule, // Menyediakan MarketSettingsService
    NotificationModule, // Menyediakan NotificationService
  ],
  controllers: [FinancialController],
  providers: [
    FinancialService, // Facade
    PdfGeneratorService,

    // Core Infrastructure
    FinancialQuotaService,
    SimulationTokenService,

    // Domain Calculators
    PensionCalculatorService,
    InsuranceCalculatorService,
    EducationCalculatorService,
    GoalCalculatorService,
    CheckupCalculatorService,
    RiskProfileCalculatorService,
  ],
  exports: [
    FinancialService,
    FinancialQuotaService,
    SimulationTokenService,
  ],
})
export class FinancialModule { }