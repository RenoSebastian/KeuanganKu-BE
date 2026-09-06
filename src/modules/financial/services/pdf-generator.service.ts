import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

// Existing Templates
import { checkupReportTemplate } from '../templates/checkup-report.template';
import { budgetReportTemplate } from '../templates/budget-report.template';
import { pensionReportTemplate } from '../templates/pension-report.template';
import { generateInsuranceReportHtml } from '../templates/insurance-report.template';
import { goalReportTemplate } from '../templates/goals-report.template';
import { educationReportTemplate } from '../templates/education-report.template';
import { historyCheckupReportTemplate } from '../templates/history-checkup-report.template';

// Template untuk Risk Profile & Agent Budget
import { riskProfileReportTemplate } from '../templates/risk-profile-report.template';
import { agentBudgetReportTemplate } from '../templates/agent-budget-report.template';

// Utils
import { calculateInsurancePlan } from '../utils/financial-math.util';
import { AgentBudgetSimulationResult, HealthAnalysisResult } from '../utils/financial-math.util';

// DTOs
import { CreateBudgetSimulationDto } from '../dto/create-budget-simulation.dto';
import { CreateInsuranceSimulationDto } from '../dto/create-insurance-simulation.dto';
import { CreatePensionSimulationDto } from '../dto/create-pension-simulation.dto';
import { CreateGoalSimulationDto } from '../dto/create-goal-simulation.dto';
import { CreateCheckupSimulationDto } from '../dto/create-checkup-simulation.dto';
import { CreateRiskProfileSimulationDto } from '../dto/create-risk-profile-simulation.dto';
import { RiskProfileResponseDto } from '../dto/risk-profile-response.dto';
import { CreateEducationSimulationDto } from '../dto/create-education-simulation.dto';

import { User } from '@prisma/client';

function formatSmartDecimal(value: any, maxDecimals: number = 2): string {
    const num = Number(value);
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxDecimals,
        useGrouping: false,
    }).format(num);
}

@Injectable()
export class PdfGeneratorService implements OnModuleInit, OnModuleDestroy {
    private browser: puppeteer.Browser | null = null;
    private readonly logger = new Logger(PdfGeneratorService.name);
    private readonly uploadDir = path.join(process.cwd(), 'uploads');

    async onModuleInit() {
        await this.initBrowser();
        this.registerHandlebarsHelpers();
    }

    async onModuleDestroy() {
        await this.closeBrowser();
    }

    private registerHandlebarsHelpers() {
        handlebars.registerHelper('inc', function (value) {
            return parseInt(value) + 1;
        });

        handlebars.registerHelper('formatRupiah', function (value) {
            return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0
            }).format(Number(value) || 0);
        });

        handlebars.registerHelper('eq', function (a, b) {
            return a === b;
        });
    }

    private async initBrowser() {
        if (this.browser) return;

        this.logger.log('Initializing Puppeteer Browser...');
        try {
            const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

            this.browser = await puppeteer.launch({
                executablePath: executablePath,
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-extensions',
                    '--disable-features=site-per-process',
                ],
            });
            this.logger.log(`Puppeteer Browser Ready. Using path: ${executablePath || 'Bundled Chromium'}`);
        } catch (error: any) {
            this.logger.error(`Failed to launch Puppeteer: ${error.message}`, error.stack);
        }
    }

    private async closeBrowser() {
        if (this.browser) {
            try {
                await this.browser.close();
            } catch (e) { }
            this.browser = null;
            this.logger.log('Puppeteer Browser Closed/Reset.');
        }
    }

    private async getBrowser() {
        if (!this.browser || !this.browser.isConnected()) {
            this.logger.warn('Browser disconnected. Restarting instance...');
            await this.closeBrowser();
            await this.initBrowser();
        }
        return this.browser;
    }

    private async generatePdfCore(templateHtml: string, data?: any, attempt = 1): Promise<Buffer> {
        const MAX_RETRIES = 2;
        let page: puppeteer.Page | null = null;

        try {
            const browser = await this.getBrowser();
            if (!browser) throw new Error("Browser failed to initialize");

            page = await browser.newPage();

            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const type = req.resourceType();
                if (['font', 'stylesheet', 'media', 'image'].includes(type)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            await page.setContent(templateHtml, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' },
            });

            return Buffer.from(pdfBuffer);

        } catch (error: any) {
            this.logger.error(`Error generating PDF (Attempt ${attempt}): ${error.message}`);

            const isCrash = error.message.includes('TargetCloseError') ||
                error.message.includes('Protocol error') ||
                error.message.includes('Session closed') ||
                error.message.includes('Connection closed');

            if (isCrash && attempt <= MAX_RETRIES) {
                this.logger.warn(`Browser crashed. Resetting and retrying... (Attempt ${attempt}/${MAX_RETRIES})`);
                await this.closeBrowser();
                return this.generatePdfCore(templateHtml, data, attempt + 1);
            }

            throw error;
        } finally {
            if (page) {
                try {
                    await page.close();
                } catch (e) { }
            }
        }
    }

    // --- PUBLIC METHODS (LEGACY / DB BASED) ---

    async generateCheckupPdf(data: any): Promise<Buffer> {
        const template = handlebars.compile(checkupReportTemplate);
        const context = this.mapCheckupData(data);
        const html = template(context);
        return this.generatePdfCore(html, context);
    }

    async generateBudgetPdf(data: any): Promise<Buffer> {
        const template = handlebars.compile(budgetReportTemplate);
        const context = this.mapBudgetData(data);
        const html = template(context);
        return this.generatePdfCore(html, context);
    }

    async generatePensionPdf(data: any): Promise<Buffer> {
        const template = handlebars.compile(pensionReportTemplate);
        const context = this.mapPensionData(data);
        const html = template(context);
        return this.generatePdfCore(html, context);
    }

    async generateInsurancePdf(data: any): Promise<Buffer> {
        const template = handlebars.compile(generateInsuranceReportHtml);
        const context = this.mapInsuranceData(data);
        const html = template(context);
        return this.generatePdfCore(html, context);
    }

    async generateGoalPdf(data: any): Promise<Buffer> {
        const template = handlebars.compile(goalReportTemplate);
        const context = this.mapGoalData(data);
        const html = template(context);
        return this.generatePdfCore(html, context);
    }

    async generateEducationPdf(dataArray: any[]): Promise<Buffer> {
        const template = handlebars.compile(educationReportTemplate);
        const context = this.mapEducationData(dataArray);
        const html = template(context);
        return this.generatePdfCore(html, context);
    }

    async generateHistoryCheckupPdf(data: any): Promise<Buffer> {
        const template = handlebars.compile(historyCheckupReportTemplate);
        const context = this.mapHistoryCheckupData(data);
        const html = template(context);
        return this.generatePdfCore(html, context);
    }

    async generateRiskProfilePdf(data: RiskProfileResponseDto): Promise<Buffer> {
        this.logger.debug(`Generating Risk Profile PDF for: ${data?.clientName}`);

        const template = handlebars.compile(riskProfileReportTemplate);
        const context = this.mapRiskProfileData(data);
        const html = template(context);
        return this.generatePdfCore(html, context);
    }

    // --- DATA MAPPERS ---

    private mapCheckupData(data: any) {
        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        const assetCash = num(data.assetCash);
        const assetPersonal = num(data.assetHome) + num(data.assetVehicle) + num(data.assetJewelry) + num(data.assetAntique) + num(data.assetPersonalOther);
        const assetInvest = num(data.assetInvHome) + num(data.assetInvVehicle) + num(data.assetGold) + num(data.assetInvAntique) + num(data.assetStocks) + num(data.assetMutualFund) + num(data.assetBonds) + num(data.assetDeposit) + num(data.assetInvOther);
        const totalAsset = assetCash + assetPersonal + assetInvest;

        const debtKPR = num(data.debtKPR);
        const debtKPM = num(data.debtKPM);
        const debtOther = num(data.debtCC) + num(data.debtCoop) + num(data.debtConsumptiveOther);
        const debtProductive = num(data.debtBusiness);
        const totalDebt = debtKPR + debtKPM + debtOther + debtProductive;

        const incomeFixed = num(data.incomeFixed);
        const incomeVariable = num(data.incomeVariable);
        const totalIncome = incomeFixed + incomeVariable;

        const expenseDebt = num(data.installmentKPR) + num(data.installmentKPM) + num(data.installmentCC) + num(data.installmentCoop) + num(data.installmentConsumptiveOther) + num(data.installmentBusiness);
        const expenseInsurance = num(data.insuranceLife) + num(data.insuranceHealth) + num(data.insuranceHome) + num(data.insuranceVehicle) + num(data.insuranceBPJS) + num(data.insuranceOther);
        const expenseSaving = num(data.savingEducation) + num(data.savingRetirement) + num(data.savingPilgrimage) + num(data.savingHoliday) + num(data.savingEmergency) + num(data.savingOther);
        const expenseLiving = num(data.expenseFood) + num(data.expenseSchool) + num(data.expenseTransport) + num(data.expenseCommunication) + num(data.expenseHelpers) + num(data.expenseTax) + num(data.expenseLifestyle);
        const totalExpense = expenseDebt + expenseInsurance + expenseSaving + expenseLiving;

        const dob = data.userProfile?.dob ? new Date(data.userProfile.dob) : new Date();
        const age = new Date().getFullYear() - dob.getFullYear();

        return {
            checkDate: new Date(data.checkDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
            user: {
                name: data.userProfile?.name || '-',
                age: age,
                job: data.userProfile?.occupation || '-',
                domicile: data.userProfile?.city || '-',
                dependents: data.userProfile?.childrenCount || 0,
                maritalStatus: data.userProfile?.maritalStatus === 'MARRIED' ? 'Menikah' : 'Lajang'
            },
            spouse: data.spouseProfile ? {
                name: data.spouseProfile.name,
                age: data.spouseProfile.dob ? new Date().getFullYear() - new Date(data.spouseProfile.dob).getFullYear() : '-',
                job: data.spouseProfile.occupation || '-'
            } : null,

            fin: {
                assetCash: fmt(assetCash),
                assetPersonal: fmt(assetPersonal),
                assetInvest: fmt(assetInvest),
                totalAsset: fmt(totalAsset),
                debtKPR: fmt(debtKPR),
                debtKPM: fmt(debtKPM),
                debtOther: fmt(debtOther),
                debtProductive: fmt(debtProductive),
                totalDebt: fmt(totalDebt),
                netWorth: fmt(num(data.totalNetWorth)),
                netWorthColor: num(data.totalNetWorth) >= 0 ? 'val-green' : 'val-red',
                incomeFixed: fmt(incomeFixed),
                incomeVariable: fmt(incomeVariable),
                totalIncome: fmt(totalIncome),
                expenseDebt: fmt(expenseDebt),
                expenseInsurance: fmt(expenseInsurance),
                expenseSaving: fmt(expenseSaving),
                expenseLiving: fmt(expenseLiving),
                totalExpense: fmt(totalExpense),
                surplusDeficit: fmt(num(data.surplusDeficit)),
                surplusColor: num(data.surplusDeficit) >= 0 ? 'val-green' : 'val-red',
            },
            score: data.healthScore,
            globalStatus: data.status,
            scoreColor: data.healthScore >= 80 ? '#22c55e' : data.healthScore >= 50 ? '#eab308' : '#ef4444',
            healthyCount: (data.ratiosDetails || []).filter((r: any) => r.statusColor.includes('GREEN')).length,
            warningCount: (data.ratiosDetails || []).filter((r: any) => !r.statusColor.includes('GREEN')).length,
            ratios: (data.ratiosDetails || []).map((r: any) => ({
                ...r,
                benchmark: r.benchmark || r.idealCondition || '-',
                valueDisplay: r.id === 'emergency_fund' ? `${formatSmartDecimal(r.value)}x` : `${formatSmartDecimal(r.value)}%`,
                statusLabel: r.statusColor?.includes('GREEN') ? 'Sehat' : r.statusColor === 'YELLOW' ? 'Waspada' : 'Bahaya',
                cssClass: r.statusColor?.includes('GREEN') ? 'bg-green' : r.statusColor === 'YELLOW' ? 'bg-yellow' : 'bg-red'
            }))
        };
    }

    private mapBudgetData(data: any) {
        const source = data.budget ? data.budget : data;

        const fmt = (n: any) => {
            const val = Number(n);
            if (isNaN(val)) return 'Rp 0';
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
        };
        const num = (n: any) => Number(n) || 0;

        const user = source.user || data.user || {};
        const dob = user.dateOfBirth ? new Date(user.dateOfBirth) : null;
        const age = dob ? new Date().getFullYear() - dob.getFullYear() : '-';

        const fixedIncome = num(source.fixedIncome);
        const variableIncome = num(source.variableIncome);
        const totalIncome = fixedIncome + variableIncome;

        const allocProductiveDebt = source.productiveDebt !== undefined ? num(source.productiveDebt) : (fixedIncome * 0.20);
        const allocConsumptiveDebt = source.consumptiveDebt !== undefined ? num(source.consumptiveDebt) : (fixedIncome * 0.15);
        const allocInsurance = source.insurance !== undefined ? num(source.insurance) : (fixedIncome * 0.10);
        const allocSaving = source.saving !== undefined ? num(source.saving) : (fixedIncome * 0.10);
        const allocLiving = source.livingCost !== undefined ? num(source.livingCost) : (fixedIncome * 0.45);

        const totalBudget = num(source.totalExpense) || (allocProductiveDebt + allocConsumptiveDebt + allocInsurance + allocSaving + allocLiving);
        const totalSurplus = variableIncome;

        return {
            period: `${source.month}/${source.year}`,
            createdAt: new Date(source.createdAt || new Date()).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
            user: { name: user.fullName || 'User', age: age },
            income: { fixed: fmt(fixedIncome), variable: fmt(variableIncome), total: fmt(totalIncome) },
            allocations: {
                productive: { label: 'Utang Produktif (20%)', value: fmt(allocProductiveDebt) },
                consumptive: { label: 'Utang Konsumtif (15%)', value: fmt(allocConsumptiveDebt) },
                insurance: { label: 'Premi Asuransi (10%)', value: fmt(allocInsurance) },
                saving: { label: 'Tabungan & Investasi (10%)', value: fmt(allocSaving) },
                living: { label: 'Biaya Hidup (45%)', value: fmt(allocLiving) },
            },
            summary: { totalBudget: fmt(totalBudget), totalSurplus: fmt(totalSurplus) }
        };
    }

    private mapPensionData(data: any) {
        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        const currentAge = num(data.currentAge);
        const retirementAge = num(data.retirementAge);
        const lifeExpectancy = num(data.lifeExpectancy);
        const currentExpense = num(data.currentExpense);
        const currentSaving = num(data.currentSaving);

        const inflationRate = num(data.inflationRate) / 100;
        const returnRate = num(data.returnRate) / 100;
        const nettRate = returnRate - inflationRate;

        const yearsToRetire = retirementAge - currentAge;
        const retirementDuration = lifeExpectancy - retirementAge;

        const futureMonthlyExpense = currentExpense;
        const fvExistingFund = currentSaving * Math.pow(1 + nettRate, yearsToRetire);

        let totalFundNeeded = num(data.totalFundNeeded);

        if (totalFundNeeded <= 0) {
            if (nettRate === 0) {
                totalFundNeeded = futureMonthlyExpense * 12 * retirementDuration;
            } else {
                const pvadFactor = (1 - Math.pow(1 + nettRate, -retirementDuration)) / nettRate;
                totalFundNeeded = futureMonthlyExpense * 12 * pvadFactor * (1 + nettRate);
            }
        }

        const shortfall = Math.max(0, totalFundNeeded - fvExistingFund);
        const userProfile = data.user || {};

        return {
            createdAt: new Date(data.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
            user: { name: userProfile.fullName || 'User' },
            plan: {
                currentAge: currentAge,
                retirementAge: retirementAge,
                lifeExpectancy: lifeExpectancy,
                currentExpense: fmt(currentExpense),
                currentSaving: fmt(currentSaving),
                inflationRate: (inflationRate * 100).toFixed(1),
                returnRate: (returnRate * 100).toFixed(1),
                monthlySaving: fmt(data.monthlySaving)
            },
            calc: {
                yearsToRetire: yearsToRetire,
                retirementDuration: retirementDuration,
                futureMonthlyExpense: fmt(futureMonthlyExpense),
                fvExistingFund: fmt(fvExistingFund),
                totalFundNeeded: fmt(totalFundNeeded),
                shortfall: fmt(shortfall)
            }
        };
    }

    private mapInsuranceData(data: any) {
        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        const finalExpenseVal = num(data.finalExpense);
        const existingDebtVal = num(data.existingDebt);

        const calculationResult = calculateInsurancePlan({
            type: data.type,
            dependentCount: num(data.dependentCount),
            monthlyExpense: num(data.monthlyExpense),
            existingDebt: existingDebtVal,
            existingCoverage: num(data.existingCoverage),
            protectionDuration: num(data.protectionDuration),
            inflationRate: num(data.inflationRate),
            returnRate: num(data.returnRate),
            finalExpense: finalExpenseVal,
        });

        const incomeReplacement = calculationResult.incomeReplacementValue;
        const totalNeeded = calculationResult.totalNeeded;
        const gap = calculationResult.coverageGap;
        const calculatedNettRate = calculationResult.nettRatePercentage;

        const monthlyExpense = num(data.monthlyExpense);
        const annualExpense = monthlyExpense * 12;
        const duration = num(data.protectionDuration);
        const existingCov = num(data.existingCoverage);

        const typeMap = { 'LIFE': 'Asuransi Jiwa (Life)', 'HEALTH': 'Asuransi Kesehatan', 'CRITICAL_ILLNESS': 'Sakit Kritis' };

        return {
            createdAt: new Date(data.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
            user: { name: data.user?.fullName || 'User' },
            plan: {
                typeLabel: typeMap[data.type] || data.type,
                dependentCount: data.dependentCount,
                monthlyExpense: fmt(monthlyExpense),
                protectionDuration: duration,
                existingDebt: fmt(existingDebtVal),
                existingCoverage: fmt(existingCov),
                recommendation: data.recommendation || '-',
            },
            calc: {
                annualExpense: fmt(annualExpense),
                nettRate: calculatedNettRate,
                incomeReplacementValue: fmt(incomeReplacement),
                debtClearanceValue: fmt(existingDebtVal + finalExpenseVal),
                finalExpenseValue: fmt(finalExpenseVal),
                totalNeeded: fmt(totalNeeded),
                coverageGap: fmt(gap)
            }
        };
    }

    private mapGoalData(data: any) {
        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        const targetAmount = num(data.targetAmount);
        const inflationRate = num(data.inflationRate) / 100;
        const returnRate = num(data.returnRate) / 100;

        const startDate = data.createdAt ? new Date(data.createdAt) : new Date();
        const endDate = data.targetDate ? new Date(data.targetDate) : new Date();

        let years = endDate.getFullYear() - startDate.getFullYear();
        if (endDate.getMonth() < startDate.getMonth()) years--;
        years = Math.max(1, years);

        const currentCost = targetAmount / Math.pow(1 + inflationRate, years);
        const futureValue = targetAmount;

        let monthlySaving = num(data.monthlySaving);
        if (monthlySaving === 0) {
            const r = returnRate / 12;
            const n = years * 12;
            if (r === 0) { monthlySaving = futureValue / n; }
            else { monthlySaving = (futureValue * r) / (Math.pow(1 + r, n) - 1); }
        }

        const inflationEffect = futureValue - currentCost;
        const userProfile = data.user || {};

        return {
            createdAt: new Date(data.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
            user: { name: userProfile.fullName || 'User' },
            goal: {
                name: data.goalName || 'Tujuan Keuangan',
                currentCost: fmt(currentCost),
                years: years,
                inflationRate: (inflationRate * 100).toFixed(1),
                returnRate: (returnRate * 100).toFixed(1),
                inflationEffect: fmt(inflationEffect)
            },
            calc: {
                futureValue: fmt(futureValue),
                monthlySaving: fmt(monthlySaving),
                months: years * 12
            }
        };
    }

    private mapEducationData(dataArray: any[]) {
        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        const levelOrder = ['TK', 'SD', 'SMP', 'SMA', 'S1', 'S2'];

        const plans = dataArray.map(item => {
            const plan = item.plan;
            const calc = item.calculation;

            const dob = new Date(plan.childDob);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
                age--;
            }

            const stagesMap = new Map<string, any[]>();

            (calc.stagesBreakdown || []).forEach((stage: any) => {
                const level = stage.level;
                if (!stagesMap.has(level)) { stagesMap.set(level, []); }
                stagesMap.get(level)?.push({
                    costType: stage.costType === 'ENTRY' ? 'Uang Pangkal' : 'SPP Tahunan',
                    yearsToStart: stage.yearsToStart,
                    currentCost: fmt(stage.currentCost),
                    futureCost: fmt(stage.futureCost),
                    monthlySaving: fmt(stage.monthlySaving),
                    rawFutureCost: Number(stage.futureCost) || 0
                });
            });

            const groupedStages = Array.from(stagesMap.entries())
                .map(([levelName, items]) => {
                    const subTotalRaw = items.reduce((sum, i) => sum + i.rawFutureCost, 0);
                    // [CRITICAL FIX] Cek array kosong untuk minYears
                    const minYears = items.length > 0 ? Math.min(...items.map(i => i.yearsToStart || 0)) : 0;
                    return { levelName, items, subTotalCost: fmt(subTotalRaw), startIn: minYears };
                })
                .sort((a, b) => levelOrder.indexOf(a.levelName) - levelOrder.indexOf(b.levelName));

            return {
                childName: plan.childName || '-',
                childAge: isNaN(age) ? '-' : age,
                uniYear: isNaN(dob.getFullYear()) ? '-' : dob.getFullYear() + 18,
                inflationRate: plan.inflationRate || 0,
                returnRate: plan.returnRate || 0,
                method: plan.method === 'GEOMETRIC' ? 'Geometrik (Bertahap)' : 'Statik',
                totalFutureCost: fmt(calc.totalFutureCost),
                monthlySaving: fmt(calc.monthlySaving),
                groupedStages: groupedStages
            };
        });

        return { plans: plans };
    }

    private mapHistoryCheckupData(fullData: any) {
        const data = fullData.record || {};
        const analysis = fullData;

        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        const assetCash = num(data.assetCash);
        const assetPersonal = num(data.assetHome) + num(data.assetVehicle) + num(data.assetJewelry) + num(data.assetAntique) + num(data.assetPersonalOther);
        const assetInvest = num(data.assetInvHome) + num(data.assetInvVehicle) + num(data.assetGold) + num(data.assetInvAntique) + num(data.assetStocks) + num(data.assetMutualFund) + num(data.assetBonds) + num(data.assetDeposit) + num(data.assetInvOther);
        const totalAsset = assetCash + assetPersonal + assetInvest;

        const debtKPR = num(data.debtKPR);
        const debtKPM = num(data.debtKPM);
        const debtOther = num(data.debtCC) + num(data.debtCoop) + num(data.debtConsumptiveOther);
        const debtProductive = num(data.debtBusiness);
        const totalDebt = debtKPR + debtKPM + debtOther + debtProductive;

        const incomeFixed = num(data.incomeFixed);
        const incomeVariable = num(data.incomeVariable);
        const totalIncome = incomeFixed + incomeVariable;

        const expenseDebt = num(data.installmentKPR) + num(data.installmentKPM) + num(data.installmentCC) + num(data.installmentCoop) + num(data.installmentConsumptiveOther) + num(data.installmentBusiness);
        const expenseInsurance = num(data.insuranceLife) + num(data.insuranceHealth) + num(data.insuranceHome) + num(data.insuranceVehicle) + num(data.insuranceBPJS) + num(data.insuranceOther);
        const expenseSaving = num(data.savingEducation) + num(data.savingRetirement) + num(data.savingPilgrimage) + num(data.savingHoliday) + num(data.savingEmergency) + num(data.savingOther);
        const expenseLiving = num(data.expenseFood) + num(data.expenseSchool) + num(data.expenseTransport) + num(data.expenseCommunication) + num(data.expenseHelpers) + num(data.expenseTax) + num(data.expenseLifestyle);
        const totalExpense = expenseDebt + expenseInsurance + expenseSaving + expenseLiving;

        const allRatios = (analysis.ratios || []).map((r: any) => ({
            ...r,
            benchmark: r.benchmark || r.idealCondition || '-',
            valueDisplay: r.id === 'emergency_fund' ? `${formatSmartDecimal(r.value)}x` : `${formatSmartDecimal(r.value)}%`,
            statusLabel: r.statusColor?.includes('GREEN') ? 'Sehat' : r.statusColor === 'YELLOW' ? 'Waspada' : 'Bahaya',
            cssClass: r.statusColor?.includes('GREEN') ? 'bg-green' : r.statusColor === 'YELLOW' ? 'bg-yellow' : 'bg-red'
        }));

        const ratioPages: any[] = [];
        const remainingRatios = [...allRatios];
        const FIRST_RATIO_PAGE_CAPACITY = 8;
        const NEXT_RATIO_PAGE_CAPACITY = 10;

        if (remainingRatios.length > 0) {
            const page2Items = remainingRatios.splice(0, FIRST_RATIO_PAGE_CAPACITY);
            ratioPages.push({ isFirstPage: true, pageNumber: 2, items: page2Items });
        }

        let pageCounter = 3;
        while (remainingRatios.length > 0) {
            const chunk = remainingRatios.splice(0, NEXT_RATIO_PAGE_CAPACITY);
            ratioPages.push({ isFirstPage: false, pageNumber: pageCounter++, items: chunk });
        }

        const dob = data.userProfile?.dob ? new Date(data.userProfile.dob) : new Date();
        const age = new Date().getFullYear() - dob.getFullYear();

        return {
            checkDate: new Date(data.checkDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
            user: {
                name: data.userProfile?.name || '-',
                age: age,
                job: data.userProfile?.occupation || '-',
                domicile: data.userProfile?.city || '-',
                dependents: data.userProfile?.childrenCount || 0,
                maritalStatus: data.userProfile?.maritalStatus === 'MARRIED' ? 'Menikah' : 'Lajang'
            },
            spouse: data.spouseProfile ? {
                name: data.spouseProfile.name,
                age: data.spouseProfile.dob ? new Date().getFullYear() - new Date(data.spouseProfile.dob).getFullYear() : '-',
                job: data.spouseProfile.occupation || '-'
            } : null,

            fin: {
                assetCash: fmt(assetCash),
                assetPersonal: fmt(assetPersonal),
                assetInvest: fmt(assetInvest),
                totalAsset: fmt(totalAsset),
                debtKPR: fmt(debtKPR),
                debtKPM: fmt(debtKPM),
                debtOther: fmt(debtOther),
                debtProductive: fmt(debtProductive),
                totalDebt: fmt(totalDebt),
                netWorth: fmt(num(data.totalNetWorth)),
                netWorthColor: num(data.totalNetWorth) >= 0 ? 'val-green' : 'val-red',
                incomeFixed: fmt(incomeFixed),
                incomeVariable: fmt(incomeVariable),
                totalIncome: fmt(totalIncome),
                expenseDebt: fmt(expenseDebt),
                expenseInsurance: fmt(expenseInsurance),
                expenseSaving: fmt(expenseSaving),
                expenseLiving: fmt(expenseLiving),
                totalExpense: fmt(totalExpense),
                surplusDeficit: fmt(num(data.surplusDeficit)),
                surplusColor: num(data.surplusDeficit) >= 0 ? 'val-green' : 'val-red',
            },

            score: analysis.score,
            globalStatus: analysis.globalStatus,
            scoreColor: analysis.score >= 80 ? '#22c55e' : analysis.score >= 50 ? '#eab308' : '#ef4444',
            healthyCount: (analysis.ratios || []).filter((r: any) => r.statusColor.includes('GREEN')).length,
            warningCount: (analysis.ratios || []).filter((r: any) => !r.statusColor.includes('GREEN')).length,

            ratioPages: ratioPages
        };
    }

    private mapRiskProfileData(data: RiskProfileResponseDto) {
        const safeData = data || {};
        const safeAllocation = safeData.allocation || { lowRisk: 0, mediumRisk: 0, highRisk: 0 };

        let themeColor = '#eab308';
        if (safeData.riskProfile === 'Konservatif') themeColor = '#22c55e';
        if (safeData.riskProfile === 'Agresif') themeColor = '#ef4444';

        return {
            generatedAt: safeData.calculatedAt
                ? new Date(safeData.calculatedAt).toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
                : '-',
            clientName: safeData.clientName || 'Tanpa Nama',
            score: safeData.totalScore || 0,
            profile: safeData.riskProfile || 'Unknown',
            description: safeData.riskDescription || 'Tidak ada deskripsi tersedia.',
            themeColor: themeColor,
            allocation: {
                low: safeAllocation.lowRisk || 0,
                medium: safeAllocation.mediumRisk || 0,
                high: safeAllocation.highRisk || 0
            }
        };
    }

    async generateSimulationPdfBuffer(
        clientData: CreateBudgetSimulationDto,
        simulationResult: AgentBudgetSimulationResult,
        agent: User,
    ): Promise<Buffer> {
        const fmt = (n: number) =>
            new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0
            }).format(n);

        const fmtRaw = (n: number) =>
            new Intl.NumberFormat('id-ID').format(n);

        const context = {
            generatedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
            documentId: `SIM-${Math.random().toString(36).substring(7).toUpperCase()}`,

            agent: {
                name: agent.fullName,
                parentCompany: agent.companyName || 'KeuanganKu Pratama',
                groupAgency: agent.companyName || 'MaxiPro Group',
                level: agent.agentLevel || 'Financial Advisor'
            },

            client: {
                name: clientData.clientName,
                city: clientData.clientCity,
                job: clientData.clientJob
            },

            financial: {
                fixedMonthly: fmt(simulationResult.meta.fixedIncome),
                fixedAnnual: fmt(simulationResult.meta.fixedIncome * 12),
                variableMonthly: fmt(simulationResult.meta.variableIncome),
                variableAnnual: fmt(simulationResult.meta.variableIncome * 12),
                totalMonthly: fmt(simulationResult.meta.totalIncome),
                totalAnnual: fmt(simulationResult.meta.totalIncome * 12)
            },

            allocation: {
                livingMonthly: fmt(simulationResult.allocation.livingCost),
                livingAnnual: fmtRaw(simulationResult.allocation.livingCost * 12),

                productiveMonthly: fmt(simulationResult.allocation.debtProductive),
                productiveAnnual: fmt(simulationResult.allocation.debtProductive * 12),

                consumptiveMonthly: fmt(simulationResult.allocation.debtConsumptive),
                consumptiveAnnual: fmt(simulationResult.allocation.debtConsumptive * 12),

                savingMonthly: fmt(simulationResult.allocation.saving),
                savingAnnual: fmt(simulationResult.allocation.saving * 12),

                insuranceMonthly: fmt(simulationResult.allocation.insurance),
                insuranceAnnual: fmt(simulationResult.allocation.insurance * 12),
            },
            recommendationText: simulationResult.analysis.variableIncomeRecommendation
        };

        try {
            const template = handlebars.compile(agentBudgetReportTemplate);
            const html = template(context);

            const pdfBuffer = await this.generatePdfCore(html, context);

            this.logger.log(`Stateless PDF Buffer generated for client: ${clientData.clientName}`);

            return pdfBuffer;

        } catch (error: any) {
            this.logger.error(`Failed to generate Stateless PDF: ${error.message}`);
            throw new Error('Gagal memproses laporan PDF (Buffer Generation Failed).');
        }
    }

    async generateInsurancePdfBuffer(
        clientData: CreateInsuranceSimulationDto,
        calculationResult: any,
        agent: User,
    ): Promise<Buffer> {
        const fmt = (n: number) =>
            new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0
            }).format(n);

        const debtClearanceTotal = Number(clientData.existingDebt) + Number(clientData.finalExpense || 0);

        const context = {
            meta: {
                generatedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
                documentId: `INS-${Math.random().toString(36).substring(7).toUpperCase()}`,
            },

            agent: {
                name: agent.fullName,
                companyName: agent.companyName || 'KeuanganKu Pratama',
                level: agent.agentLevel || 'Financial Advisor'
            },

            client: {
                name: clientData.clientName,
                city: clientData.clientCity,
                job: clientData.clientJob,
                dob: clientData.clientDob ? new Date(clientData.clientDob).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-',
                maritalStatus: 'MARRIED'
            },

            input: {
                typeLabel: clientData.type === 'LIFE' ? 'Jiwa (Life)' : clientData.type === 'HEALTH' ? 'Kesehatan' : 'Sakit Kritis',
                dependents: clientData.dependents || 0,
                monthlyExpense: fmt(clientData.monthlyExpense),
                existingDebt: fmt(clientData.existingDebt),
                existingCoverage: fmt(clientData.existingCoverage),
                existingCoverageRaw: clientData.existingCoverage,
                finalExpense: fmt(clientData.finalExpense || 0),
                protectionDuration: clientData.protectionDuration,
                inflationRate: clientData.inflationRate || 5,
                returnRate: clientData.returnRate || 6
            },

            result: {
                totalNeededRaw: calculationResult.totalNeeded,
                incomeReplacement: fmt(calculationResult.incomeReplacementValue),
                annualExpense: fmt(clientData.monthlyExpense * 12),
                debtClearance: fmt(debtClearanceTotal),
                totalNeeded: fmt(calculationResult.totalNeeded),
                existing: fmt(clientData.existingCoverage),
                gap: fmt(calculationResult.coverageGap),
                recommendation: calculationResult.recommendation
            }
        };

        try {
            const htmlContent = generateInsuranceReportHtml(context);
            const pdfBuffer = await this.generatePdfCore(htmlContent);

            this.logger.log(`Stateless Insurance PDF generated for: ${clientData.clientName}`);
            return pdfBuffer;

        } catch (error: any) {
            this.logger.error(`Failed to generate Insurance PDF: ${error.message}`);
            throw new Error('Gagal memproses laporan PDF Asuransi.');
        }
    }

    async generatePensionPdfBuffer(
        clientData: CreatePensionSimulationDto,
        calculationResult: any,
        agent: User,
    ): Promise<Buffer> {
        const fmt = (n: number) =>
            new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0
            }).format(n);

        const totalTimeline = calculationResult.yearsToRetire + calculationResult.retirementDuration;
        const safeTotal = totalTimeline > 0 ? totalTimeline : 1;

        const workWidth = (calculationResult.yearsToRetire / safeTotal) * 100;
        const retireWidth = (calculationResult.retirementDuration / safeTotal) * 100;

        const context = {
            generatedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
            documentId: `PEN-${Math.random().toString(36).substring(7).toUpperCase()}`,

            agent: {
                name: agent.fullName,
                parentCompany: agent.companyName || 'KeuanganKu Pratama',
                groupAgency: agent.companyName || 'MaxiPro Group',
                level: agent.agentLevel || 'Financial Advisor'
            },

            user: {
                name: clientData.clientName,
                city: clientData.clientCity,
                job: clientData.clientJob,
                dob: clientData.clientDob ? new Date(clientData.clientDob).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-',
            },

            plan: {
                currentAge: clientData.currentAge,
                retirementAge: clientData.retirementAge,
                lifeExpectancy: clientData.lifeExpectancy,
                currentExpense: fmt(clientData.currentExpense),
                currentSaving: fmt(clientData.currentSaving || 0),
                monthlySaving: fmt(calculationResult.monthlySaving),
                inflationRate: clientData.inflationRate,
                returnRate: clientData.returnRate
            },

            calc: {
                yearsToRetire: calculationResult.yearsToRetire,
                retirementDuration: calculationResult.retirementDuration,
                futureMonthlyExpense: fmt(calculationResult.futureMonthlyExpense),
                totalFundNeeded: fmt(calculationResult.totalFundNeeded),
                fvExistingFund: fmt(calculationResult.fvExistingFund),
                shortfall: fmt(calculationResult.shortfall),
                workingPercentage: workWidth.toFixed(1),
                retirementPercentage: retireWidth.toFixed(1)
            }
        };

        try {
            const template = handlebars.compile(pensionReportTemplate);
            const html = template(context);

            const pdfBuffer = await this.generatePdfCore(html, context);

            this.logger.log(`Stateless Pension PDF generated for: ${clientData.clientName}`);

            return pdfBuffer;

        } catch (error: any) {
            this.logger.error(`Failed to generate Pension PDF: ${error.message}`);
            throw new Error('Gagal memproses laporan PDF Pensiun.');
        }
    }

    async generateGoalSimulationPdfBuffer(
        clientData: CreateGoalSimulationDto,
        calculationResult: any,
        agent: User,
    ): Promise<Buffer> {
        const fmt = (n: number) =>
            new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0
            }).format(n);

        const years = calculationResult.yearsDuration || 0;
        const months = Math.round(years * 12);

        const target = calculationResult.futureTargetAmount || 1;
        const existing = calculationResult.futureExistingFund || 0;
        const existingPercentage = Math.min(100, Math.round((existing / target) * 100));

        const context = {
            generatedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
            documentId: `GOAL-${Math.random().toString(36).substring(7).toUpperCase()}`,

            agent: {
                name: agent.fullName,
                parentCompany: agent.companyName || 'KeuanganKu Pratama',
                groupAgency: agent.companyName || 'MaxiPro Group',
                level: agent.agentLevel || 'Financial Advisor'
            },

            client: {
                name: clientData.clientName,
                city: clientData.clientCity,
                job: clientData.clientJob || '-',
                phone: clientData.clientPhone || '-'
            },

            goal: {
                name: clientData.goalName,
                targetAmount: fmt(clientData.targetAmount),
                targetDate: new Date(clientData.targetDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
                currentSaving: fmt(clientData.currentSaving || 0),
                inflationRate: clientData.inflationRate,
                returnRate: clientData.returnRate,
                years: years.toFixed(1),
                inflationEffect: fmt(calculationResult.futureTargetAmount - clientData.targetAmount),
                currentCost: fmt(clientData.targetAmount)
            },

            calc: {
                yearsDuration: years.toFixed(1),
                monthsDuration: months,
                futureTargetAmount: fmt(calculationResult.futureTargetAmount),
                futureValue: fmt(calculationResult.futureTargetAmount),
                futureExistingFund: fmt(calculationResult.futureExistingFund),
                existingPercentage: existingPercentage,
                netTarget: fmt(calculationResult.netTarget),
                monthlySaving: fmt(calculationResult.monthlySaving)
            }
        };

        try {
            const template = handlebars.compile(goalReportTemplate);
            const html = template(context);

            const pdfBuffer = await this.generatePdfCore(html, context);

            this.logger.log(`Stateless Goal PDF generated for: ${clientData.clientName}`);
            return pdfBuffer;

        } catch (error: any) {
            this.logger.error(`Failed to generate Goal PDF: ${error.message}`);
            throw new Error('Gagal memproses laporan PDF Tujuan Keuangan.');
        }
    }

    async generateCheckupSimulationPdfBuffer(
        clientData: CreateCheckupSimulationDto,
        analysisResult: HealthAnalysisResult,
        agent: User,
    ): Promise<Buffer> {
        const fmt = (n: number) =>
            new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0
            }).format(n);

        const num = (n: any) => Number(n) || 0;

        const logoPath = path.join(process.cwd(), 'src/assets/images', 'logokeuanganku.png');
        let logoUrl = '';
        try {
            if (fs.existsSync(logoPath)) {
                const bitmap = fs.readFileSync(logoPath);
                logoUrl = `data:image/png;base64,${bitmap.toString('base64')}`;
            }
        } catch (e) {
            this.logger.warn('Failed to load logo for PDF', e);
        }

        const calcAge = (dob?: string) => {
            if (!dob) return '-';
            const birthDate = new Date(dob);
            if (isNaN(birthDate.getTime())) return '-';
            const ageDifMs = Date.now() - birthDate.getTime();
            const ageDate = new Date(ageDifMs);
            return Math.abs(ageDate.getUTCFullYear() - 1970);
        };

        const d = clientData;

        const assetLiquid = num(d.assetCash);
        const assetPersonal = num(d.assetHome) + num(d.assetVehicle) + num(d.assetJewelry) + num(d.assetAntique) + num(d.assetPersonalOther);
        const assetInvest = num(d.assetInvHome) + num(d.assetInvVehicle) + num(d.assetGold) + num(d.assetInvAntique) + num(d.assetStocks) + num(d.assetMutualFund) + num(d.assetBonds) + num(d.assetDeposit) + num(d.assetInvOther);
        const totalAsset = assetLiquid + assetPersonal + assetInvest;

        const debtShort = num(d.debtCC) + num(d.debtCoop) + num(d.debtConsumptiveOther);
        const debtLong = num(d.debtKPR) + num(d.debtKPM) + num(d.debtBusiness);
        const totalDebt = debtShort + debtLong;

        const incomeFixed = num(d.incomeFixed);
        const incomeVariable = num(d.incomeVariable);
        const totalIncome = incomeFixed + incomeVariable;

        const expenseDebt = num(d.installmentKPR) + num(d.installmentKPM) + num(d.installmentCC) + num(d.installmentCoop) + num(d.installmentConsumptiveOther) + num(d.installmentBusiness);
        const expenseInsurance = num(d.insuranceLife) + num(d.insuranceHealth) + num(d.insuranceHome) + num(d.insuranceVehicle) + num(d.insuranceBPJS) + num(d.insuranceOther);
        const expenseSaving = num(d.savingEducation) + num(d.savingRetirement) + num(d.savingPilgrimage) + num(d.savingHoliday) + num(d.savingEmergency) + num(d.savingOther);
        const expenseLiving = num(d.expenseFood) + num(d.expenseSchool) + num(d.expenseTransport) + num(d.expenseCommunication) + num(d.expenseHelpers) + num(d.expenseTax) + num(d.expenseLifestyle);
        const totalExpense = expenseDebt + expenseInsurance + expenseSaving + expenseLiving;

        const context = {
            checkDate: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
            logoUrl: logoUrl,

            agent: {
                name: agent.fullName || 'Agen Finansial',
                level: agent.agentLevel || 'Financial Advisor',
                company: agent.companyName || 'KeuanganKu Pratama',
                agency: agent.companyName || 'MaxiPro Group',
            },

            client: {
                name: d.client?.name || 'Tanpa Nama',
                age: calcAge(d.client?.dob),
                dob: d.client?.dob || '-',
                religion: d.client?.religion || '-',
                job: d.client?.occupation || '-',
                city: d.client?.city || '-',
                phone: d.client?.phone || '-',
                maritalStatus: d.client?.maritalStatus === 'MARRIED' ? 'Menikah' : d.client?.maritalStatus === 'SINGLE' ? 'Lajang' : 'Cerai',
                childrenCount: d.client?.childrenCount || 0,
                dependentParents: d.client?.dependentParents || 0,
            },

            spouse: {
                hasSpouse: !!d.spouse,
                name: d.spouse?.name || '-',
                age: d.spouse?.dob ? calcAge(d.spouse.dob) : '-',
                job: d.spouse?.occupation || '-',
            },

            fin: {
                assetCash: fmt(assetLiquid),
                assetPersonal: fmt(assetPersonal),
                assetInvest: fmt(assetInvest),
                totalAsset: fmt(totalAsset),

                debtShort: fmt(debtShort),
                debtLong: fmt(debtLong),
                totalDebt: fmt(totalDebt),

                netWorth: fmt(analysisResult?.netWorth || 0),
                netWorthColor: (analysisResult?.netWorth || 0) >= 0 ? 'val-green' : 'val-red',

                incomeFixed: fmt(incomeFixed),
                incomeVariable: fmt(incomeVariable),
                totalIncome: fmt(totalIncome),

                expenseDebt: fmt(expenseDebt),
                expenseInsurance: fmt(expenseInsurance),
                expenseSaving: fmt(expenseSaving),
                expenseLiving: fmt(expenseLiving),
                totalExpense: fmt(totalExpense),

                surplusDeficit: fmt(analysisResult?.surplusDeficit || 0),
                surplusColor: (analysisResult?.surplusDeficit || 0) >= 0 ? 'val-green' : 'val-red',
            },

            globalStatus: analysisResult?.globalStatus || 'BAHAYA',
            score: analysisResult?.score || 0,
            scoreColor: (analysisResult?.score || 0) >= 80 ? '#22c55e' : (analysisResult?.score || 0) >= 50 ? '#eab308' : '#ef4444',

            healthyCount: (analysisResult?.ratios || []).filter(r => r.statusColor?.includes('GREEN')).length,
            warningCount: (analysisResult?.ratios || []).filter(r => !r.statusColor?.includes('GREEN')).length,

            ratios: (analysisResult?.ratios || []).map(r => ({
                label: r.label || '-',
                statusLabel: r.statusColor?.includes('GREEN') ? 'Sehat' : r.statusColor === 'YELLOW' ? 'Waspada' : 'Bahaya',
                cssClass: r.statusColor?.includes('GREEN') ? 'bg-green' : r.statusColor === 'YELLOW' ? 'bg-yellow' : 'bg-red',
                valueDisplay: r.id === 'emergency_fund' ? `${formatSmartDecimal(r.value)}x` : `${formatSmartDecimal(r.value)}%`,
                benchmark: r.benchmark || r.idealCondition || '-',
                recommendation: r.recommendation || '-'
            }))
        };

        try {
            const template = handlebars.compile(checkupReportTemplate);
            const html = template(context);

            const pdfBuffer = await this.generatePdfCore(html, context);
            this.logger.log(`Stateless Checkup PDF generated for: ${context.client.name}`);

            return pdfBuffer;

        } catch (error: any) {
            this.logger.error(`Failed to generate Checkup PDF: ${error.message}`);
            throw new Error('Gagal memproses laporan PDF Financial Checkup.');
        }
    }

    async generateRiskProfileSimulationPdfBuffer(
        clientData: CreateRiskProfileSimulationDto,
        result: RiskProfileResponseDto,
        agent: User
    ): Promise<Buffer> {

        const context = {
            clientName: clientData.clientName,
            generatedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
            score: result.totalScore,
            profile: result.riskProfile,
            description: result.riskDescription,

            themeColor: result.riskProfile === 'Konservatif' ? '#10b981'
                : result.riskProfile === 'Moderat' ? '#f59e0b'
                    : '#ef4444',

            allocation: {
                low: result.allocation.lowRisk,
                medium: result.allocation.mediumRisk,
                high: result.allocation.highRisk
            },

            documentId: `RISK-${Math.random().toString(36).substring(7).toUpperCase()}`,
            agent: {
                name: agent.fullName,
                level: agent.agentLevel || 'Financial Advisor',
                company: agent.companyName || 'KeuanganKu Pratama',
                agency: agent.companyName || 'MaxiPro Group',
            },
            client: {
                age: clientData.clientDob
                    ? new Date().getFullYear() - new Date(clientData.clientDob).getFullYear()
                    : '-',
                dob: clientData.clientDob,
                job: clientData.clientJob || '-',
                city: clientData.clientCity || '-',
                phone: clientData.clientPhone || '-'
            }
        };

        try {
            const template = handlebars.compile(riskProfileReportTemplate);
            const html = template(context);

            const pdfBuffer = await this.generatePdfCore(html, context);

            this.logger.log(`Stateless Risk Profile PDF generated for: ${clientData.clientName}`);
            return pdfBuffer;

        } catch (error: any) {
            this.logger.error(`Failed to generate Risk Profile PDF: ${error.message}`);
            throw new Error('Gagal memproses laporan PDF Profil Risiko.');
        }
    }

    async generateEducationSimulationPdf(
        dto: CreateEducationSimulationDto & { aggregatedResult?: any }, // [CRITICAL FIX] Type union adapter
        agent: User
    ): Promise<Buffer> {
        try {
            this.logger.log(`Mapping Stateless Education PDF data for: ${dto.clientName}`);

            // 1. Formatter Mata Uang (Format Rupiah Standar)
            const fmt = (n: number) =>
                new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    maximumFractionDigits: 0
                }).format(n || 0);

            // 2. Kalkulasi Umur Klien Secara Dinamis
            const clientAge = dto.clientDob
                ? new Date().getFullYear() - new Date(dto.clientDob).getFullYear()
                : '-';

            // 3. Mapping Data Anak dan Agregasi Total secara Komprehensif
            let grandTotalFutureCost = 0;
            let grandTotalMonthlySaving = 0;

            const mappedChildren = (dto.childrenPlans || []).map((child) => {
                const childDob = new Date(child.childDob);
                const childAge = isNaN(childDob.getTime()) ? '-' : new Date().getFullYear() - childDob.getFullYear();

                let childTotalMonthlySaving = 0;

                const mappedStages = child.stages.map((stage) => {
                    // Agregasi ke level Anak & Global
                    childTotalMonthlySaving += stage.calculatedMonthlySaving || 0;
                    grandTotalFutureCost += stage.calculatedFutureValue || 0;
                    grandTotalMonthlySaving += stage.calculatedMonthlySaving || 0;

                    // Hitung Present Value Kasar (Biaya Hari Ini Total) berdasarkan durasi
                    const rawPv = (stage.costEntry || 0) +
                        ((stage.costMonthly || 0) * 12 * stage.duration) +
                        ((stage.costSemester || 0) * 2 * stage.duration) +
                        (stage.costFull || 0);

                    return {
                        level: stage.level,
                        startYear: stage.startYear,
                        duration: stage.duration,
                        costEntry: stage.costEntry ? fmt(stage.costEntry) : null,
                        costMonthly: stage.costMonthly ? fmt(stage.costMonthly) : null,
                        costSemester: stage.costSemester ? fmt(stage.costSemester) : null,
                        costFull: stage.costFull ? fmt(stage.costFull) : null,
                        totalPv: fmt(rawPv),
                        totalFv: fmt(stage.calculatedFutureValue || 0)
                    };
                });

                return {
                    name: child.childName || '-',
                    currentAge: childAge,
                    stages: mappedStages,
                    monthlySaving: fmt(childTotalMonthlySaving)
                };
            });

            // 4. Susun Context (Information Expert) Sesuai Ekspektasi Template Handlebars
            const context = {
                generatedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
                simulationId: `EDU-${Math.random().toString(36).substring(7).toUpperCase()}`,

                agent: {
                    name: agent.fullName || 'Agen Finansial',
                    agency: agent.companyName || 'KeuanganKu Pratama',
                },

                client: {
                    name: dto.clientName || '-',
                    dob: dto.clientDob ? new Date(dto.clientDob).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-',
                    age: clientAge,
                    city: dto.clientCity || '-',
                    job: dto.clientJob || '-'
                },

                financial: {
                    inflationRate: dto.inflationRate || 10
                },

                summary: {
                    totalChildren: mappedChildren.length,
                    totalFutureCost: fmt(grandTotalFutureCost),
                    totalMonthlyInvestment: fmt(grandTotalMonthlySaving)
                },

                children: mappedChildren
            };

            // 5. Bypass Legacy Method -> Langsung Compile & Generate Core PDF
            const template = handlebars.compile(educationReportTemplate);
            const html = template(context);

            const pdfBuffer = await this.generatePdfCore(html, context);

            this.logger.log(`Successfully generated Education PDF for: ${dto.clientName}`);
            return pdfBuffer;

        } catch (error: any) {
            this.logger.error(`Failed to generate Education PDF: ${error.message}`);
            throw new Error('Gagal memproses laporan PDF Pendidikan.');
        }
    }
}