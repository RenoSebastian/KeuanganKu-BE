import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import { checkupReportTemplate } from '../templates/checkup-report.template';
import { budgetReportTemplate } from '../templates/budget-report.template';
import { pensionReportTemplate } from '../templates/pension-report.template';
import { insuranceReportTemplate } from '../templates/insurance-report.template';
import { goalReportTemplate } from '../templates/goals-report.template';
import { educationReportTemplate } from '../templates/education-report.template';
import { historyCheckupReportTemplate } from '../templates/history-checkup-report.template';
import { calculateInsurancePlan } from '../utils/financial-math.util';

@Injectable()
export class PdfGeneratorService implements OnModuleInit, OnModuleDestroy {
    private browser: puppeteer.Browser | null = null;
    private readonly logger = new Logger(PdfGeneratorService.name);

    // --- LIFECYCLE ---

    async onModuleInit() {
        await this.initBrowser();
    }

    async onModuleDestroy() {
        await this.closeBrowser();
    }

    // Inisialisasi Browser dengan Config Stabil
    private async initBrowser() {
        if (this.browser) return;

        this.logger.log('Initializing Puppeteer Browser...');
        try {
            this.browser = await puppeteer.launch({
                headless: true, // Mode tanpa UI (Wajib untuk server)
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage', // Mencegah crash memori di Docker/Linux
                    '--disable-gpu',           // Hemat resource GPU
                    '--no-first-run',
                    '--no-zygote',
                    // [REMOVED] '--single-process', // JANGAN PAKAI INI DI WINDOWS -> Bikin Crash!
                    '--disable-extensions',
                    '--disable-features=site-per-process', // Hemat RAM
                ],
            });
            this.logger.log('Puppeteer Browser Ready.');
        } catch (error) {
            this.logger.error('Failed to launch Puppeteer:', error);
        }
    }

    // Tutup browser dengan aman
    private async closeBrowser() {
        if (this.browser) {
            try {
                await this.browser.close();
            } catch (e) {
                // Ignore error if already closed
            }
            this.browser = null;
            this.logger.log('Puppeteer Browser Closed/Reset.');
        }
    }

    // Helper: Pastikan browser hidup, kalau mati nyalakan lagi
    private async getBrowser() {
        if (!this.browser || !this.browser.isConnected()) {
            this.logger.warn('Browser disconnected. Restarting instance...');
            await this.closeBrowser();
            await this.initBrowser();
        }
        return this.browser;
    }

    // --- CORE GENERATOR DENGAN AUTO-RETRY ---

    private async generatePdfCore(templateHtml: string, data: any, attempt = 1): Promise<Buffer> {
        const MAX_RETRIES = 2; // Coba maksimal 2 kali jika crash
        let page: puppeteer.Page | null = null;

        try {
            const browser = await this.getBrowser();
            if (!browser) throw new Error("Browser failed to initialize");

            page = await browser.newPage();

            // 1. Optimasi Resource: Blokir Gambar/Font Eksternal biar cepat
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const type = req.resourceType();
                if (['font', 'stylesheet', 'media', 'image'].includes(type)) {
                    // Abort request berat (gambar sudah base64 di template, jadi aman)
                    req.abort();
                } else {
                    req.continue();
                }
            });

            // 2. Render HTML
            await page.setContent(templateHtml, {
                waitUntil: 'domcontentloaded', // Lebih cepat dari networkidle0
                timeout: 30000 // 30 detik timeout
            });

            // 3. Cetak PDF
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' },
            });

            return Buffer.from(pdfBuffer);

        } catch (error: any) {
            this.logger.error(`Error generating PDF (Attempt ${attempt}): ${error.message}`);

            // Deteksi Crash Browser
            const isCrash = error.message.includes('TargetCloseError') ||
                error.message.includes('Protocol error') ||
                error.message.includes('Session closed') ||
                error.message.includes('Connection closed');

            // Jika Crash & masih punya kuota retry -> RESTART BROWSER & COBA LAGI
            if (isCrash && attempt <= MAX_RETRIES) {
                this.logger.warn(`Browser crashed. Resetting and retrying... (Attempt ${attempt}/${MAX_RETRIES})`);
                await this.closeBrowser(); // Matikan browser rusak
                return this.generatePdfCore(templateHtml, data, attempt + 1); // Rekursif call
            }

            throw error; // Lempar error jika bukan crash atau sudah habis retry
        } finally {
            // Selalu tutup tab (page) untuk membebaskan RAM
            if (page) {
                try {
                    await page.close();
                } catch (e) {
                    // Swallow error if page is already closed/crashed
                }
            }
        }
    }

    // --- PUBLIC METHODS ---

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
        const template = handlebars.compile(insuranceReportTemplate);
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
                valueDisplay: r.id === 'emergency_fund' ? `${r.value}x` : `${r.value}%`,
                statusLabel: r.statusColor.includes('GREEN') ? 'Sehat' : r.statusColor === 'YELLOW' ? 'Waspada' : 'Bahaya',
                cssClass: r.statusColor.includes('GREEN') ? 'bg-green' : r.statusColor === 'YELLOW' ? 'bg-yellow' : 'bg-red'
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

        const yearsToRetire = retirementAge - currentAge;
        const retirementDuration = lifeExpectancy - retirementAge;
        const futureMonthlyExpense = currentExpense * Math.pow(1 + inflationRate, yearsToRetire);
        const fvExistingFund = currentSaving * Math.pow(1 + returnRate, yearsToRetire);
        const totalFundNeeded = num(data.totalFundNeeded) > 0 ? num(data.totalFundNeeded) : (futureMonthlyExpense * 12 * retirementDuration);
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

        // [FIX 2] HITUNG ULANG AGAR SINKRON DENGAN FE & DB
        // Kita reconstruct DTO dari data database untuk dihitung ulang
        const calculationResult = calculateInsurancePlan({
            type: data.type,
            dependentCount: num(data.dependentCount),
            monthlyExpense: num(data.monthlyExpense),
            existingDebt: num(data.existingDebt),
            existingCoverage: num(data.existingCoverage),
            protectionDuration: num(data.protectionDuration),
            inflationRate: num(data.inflationRate),
            returnRate: num(data.returnRate)
        });

        // Ambil hasil perhitungan yang akurat (TVM Based)
        const incomeReplacement = calculationResult.incomeReplacementValue;
        const totalNeeded = calculationResult.totalNeeded;
        const gap = calculationResult.coverageGap;
        const calculatedNettRate = calculationResult.nettRatePercentage; // Ambil langsung dari hasil hitungan

        // Data Display
        const monthlyExpense = num(data.monthlyExpense);
        const annualExpense = monthlyExpense * 12;
        const duration = num(data.protectionDuration);
        const debt = num(data.existingDebt);
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
                existingDebt: fmt(debt),
                existingCoverage: fmt(existingCov),
                recommendation: data.recommendation || '-'
            },
            calc: {
                annualExpense: fmt(annualExpense),
                nettRate: calculatedNettRate, // Menggunakan hasil hitungan (-10.00)
                incomeReplacementValue: fmt(incomeReplacement), // [FIXED] Sekarang pasti 2.26 M
                debtClearanceValue: fmt(debt),
                totalNeeded: fmt(totalNeeded), // [FIXED] Sekarang pasti 2.3 M
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
                    rawFutureCost: Number(stage.futureCost)
                });
            });

            const groupedStages = Array.from(stagesMap.entries())
                .map(([levelName, items]) => {
                    const subTotalRaw = items.reduce((sum, i) => sum + i.rawFutureCost, 0);
                    const minYears = Math.min(...items.map(i => i.yearsToStart));
                    return { levelName, items, subTotalCost: fmt(subTotalRaw), startIn: minYears };
                })
                .sort((a, b) => levelOrder.indexOf(a.levelName) - levelOrder.indexOf(b.levelName));

            return {
                childName: plan.childName,
                childAge: age,
                uniYear: dob.getFullYear() + 18,
                inflationRate: plan.inflationRate,
                returnRate: plan.returnRate,
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
            valueDisplay: r.id === 'emergency_fund' ? `${r.value}x` : `${r.value}%`,
            statusLabel: r.statusColor.includes('GREEN') ? 'Sehat' : r.statusColor === 'YELLOW' ? 'Waspada' : 'Bahaya',
            cssClass: r.statusColor.includes('GREEN') ? 'bg-green' : r.statusColor === 'YELLOW' ? 'bg-yellow' : 'bg-red'
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
}