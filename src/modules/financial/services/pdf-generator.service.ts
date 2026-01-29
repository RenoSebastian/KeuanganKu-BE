import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import { checkupReportTemplate } from '../templates/checkup-report.template';
import { budgetReportTemplate } from '../templates/budget-report.template';
import { pensionReportTemplate } from '../templates/pension-report.template'; // Import template
import { insuranceReportTemplate } from '../templates/insurance-report.template';
import { goalReportTemplate } from '../templates/goals-report.template';
import { educationReportTemplate } from '../templates/education-report.template';
import { historyCheckupReportTemplate } from '../templates/history-checkup-report.template';

@Injectable()
export class PdfGeneratorService {

    async generateCheckupPdf(data: any): Promise<Buffer> {
        const template = handlebars.compile(checkupReportTemplate);
        const context = this.mapDataToContext(data);
        const html = template(context);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        await browser.close();
        return Buffer.from(pdfBuffer);
    }

    private mapDataToContext(data: any) {
        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        // --- Grouping Neraca ---
        const assetCash = num(data.assetCash);
        const assetPersonal = num(data.assetHome) + num(data.assetVehicle) + num(data.assetJewelry) + num(data.assetAntique) + num(data.assetPersonalOther);
        const assetInvest = num(data.assetInvHome) + num(data.assetInvVehicle) + num(data.assetGold) + num(data.assetInvAntique) + num(data.assetStocks) + num(data.assetMutualFund) + num(data.assetBonds) + num(data.assetDeposit) + num(data.assetInvOther);
        const totalAsset = assetCash + assetPersonal + assetInvest;

        const debtKPR = num(data.debtKPR);
        const debtKPM = num(data.debtKPM);
        const debtOther = num(data.debtCC) + num(data.debtCoop) + num(data.debtConsumptiveOther);
        const debtProductive = num(data.debtBusiness);
        const totalDebt = debtKPR + debtKPM + debtOther + debtProductive;

        // --- Grouping Arus Kas ---
        // Asumsi data di DB adalah TAHUNAN (sesuai input wizard terakhir kita)
        const incomeFixed = num(data.incomeFixed);
        const incomeVariable = num(data.incomeVariable);
        const totalIncome = incomeFixed + incomeVariable;

        const expenseDebt = num(data.installmentKPR) + num(data.installmentKPM) + num(data.installmentCC) + num(data.installmentCoop) + num(data.installmentConsumptiveOther) + num(data.installmentBusiness);
        const expenseInsurance = num(data.insuranceLife) + num(data.insuranceHealth) + num(data.insuranceHome) + num(data.insuranceVehicle) + num(data.insuranceBPJS) + num(data.insuranceOther);
        const expenseSaving = num(data.savingEducation) + num(data.savingRetirement) + num(data.savingPilgrimage) + num(data.savingHoliday) + num(data.savingEmergency) + num(data.savingOther);
        const expenseLiving = num(data.expenseFood) + num(data.expenseSchool) + num(data.expenseTransport) + num(data.expenseCommunication) + num(data.expenseHelpers) + num(data.expenseTax) + num(data.expenseLifestyle);
        const totalExpense = expenseDebt + expenseInsurance + expenseSaving + expenseLiving;

        // --- Calculate Age ---
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

            // Financial Data Grouped
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

            // Score & Ratios
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

    // [NEW] Method untuk Budgeting PDF
    async generateBudgetPdf(data: any): Promise<Buffer> {
        const template = handlebars.compile(budgetReportTemplate);
        const context = this.mapBudgetData(data);
        const html = template(context);

        // Reuse logic Puppeteer yang sama agar konsisten
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        await browser.close();
        return Buffer.from(pdfBuffer);
    }

    // [UPDATED] Mapper untuk Budgeting sesuai Schema User yang benar
    private mapBudgetData(data: any) {
        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        // 1. Data Diri & Tanggal
        // [FIX] Ambil dari data.user.dateOfBirth, bukan data.user.userProfile.dob
        const dob = data.user?.dateOfBirth ? new Date(data.user.dateOfBirth) : null;
        const age = dob ? new Date().getFullYear() - dob.getFullYear() : '-';

        // 2. Data Penghasilan
        const fixedIncome = num(data.fixedIncome);
        const variableIncome = num(data.variableIncome);
        const totalIncome = fixedIncome + variableIncome;

        // 3. Perhitungan Alokasi (Berdasarkan FIXED INCOME)
        const allocProductiveDebt = fixedIncome * 0.20;
        const allocConsumptiveDebt = fixedIncome * 0.15;
        const allocInsurance = fixedIncome * 0.10;
        const allocSaving = fixedIncome * 0.10;
        const allocLiving = fixedIncome * 0.45;

        // 4. Kesimpulan
        const totalBudget = allocProductiveDebt + allocConsumptiveDebt + allocInsurance + allocSaving + allocLiving;
        const totalSurplus = variableIncome;

        return {
            period: `${data.month}/${data.year}`,
            createdAt: new Date(data.createdAt).toLocaleDateString('id-ID'),

            // [FIX] Ambil dari data.user.fullName
            user: {
                name: data.user?.fullName || 'User',
                age: age
            },

            // Penghasilan
            income: {
                fixed: fmt(fixedIncome),
                variable: fmt(variableIncome),
                total: fmt(totalIncome)
            },

            // Anggaran Disarankan
            allocations: {
                productive: { label: 'Utang Produktif (20%)', value: fmt(allocProductiveDebt) },
                consumptive: { label: 'Utang Konsumtif (15%)', value: fmt(allocConsumptiveDebt) },
                insurance: { label: 'Premi Asuransi (10%)', value: fmt(allocInsurance) },
                saving: { label: 'Tabungan & Investasi (10%)', value: fmt(allocSaving) },
                living: { label: 'Biaya Hidup (45%)', value: fmt(allocLiving) },
            },

            // Kesimpulan
            summary: {
                totalBudget: fmt(totalBudget),
                totalSurplus: fmt(totalSurplus)
            }
        };
    }

    // [NEW] Generate Pension PDF
    async generatePensionPdf(data: any): Promise<Buffer> {
        const template = handlebars.compile(pensionReportTemplate);
        const context = this.mapPensionData(data); // Panggil mapper khusus pensiun
        const html = template(context);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        await browser.close();
        return Buffer.from(pdfBuffer);
    }

    // Mapper for Pension Data
    private mapPensionData(data: any) {
        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        // 1. Extract Raw Values from DB
        const currentAge = num(data.currentAge);
        const retirementAge = num(data.retirementAge);
        const lifeExpectancy = num(data.lifeExpectancy);
        const currentExpense = num(data.currentExpense);
        const currentSaving = num(data.currentSaving);
        const inflationRate = num(data.inflationRate) / 100; // Convert percent to decimal
        const returnRate = num(data.returnRate) / 100;       // Convert percent to decimal

        // 2. Re-Calculate Logic (TVM) - Agar data di PDF lengkap
        const yearsToRetire = retirementAge - currentAge;
        const retirementDuration = lifeExpectancy - retirementAge;

        // FV Pengeluaran Bulanan = PV * (1 + i)^n
        const futureMonthlyExpense = currentExpense * Math.pow(1 + inflationRate, yearsToRetire);

        // FV Tabungan Saat Ini = PV * (1 + r)^n
        const fvExistingFund = currentSaving * Math.pow(1 + returnRate, yearsToRetire);

        // Total Dana Dibutuhkan (Approximation: Future Monthly * 12 * Duration)
        // Note: Rumus asli mungkin lebih kompleks (annuity), tapi kita pakai totalFundNeeded dari DB sebagai patokan utama jika ada.
        // Jika data.totalFundNeeded ada, kita pakai itu. Jika tidak, kita hitung kasar.
        const totalFundNeeded = num(data.totalFundNeeded) > 0
            ? num(data.totalFundNeeded)
            : (futureMonthlyExpense * 12 * retirementDuration);

        const shortfall = Math.max(0, totalFundNeeded - fvExistingFund);

        // 3. User Data
        // Handling relasi user profile (sesuai schema User yang tidak punya userProfile relation terpisah tapi field langsung)
        // Cek controller untuk memastikan include apa yang dikirim.
        // Asumsi Controller mengirim: include: { user: true }
        const userProfile = data.user || {};

        const dob = userProfile.dateOfBirth ? new Date(userProfile.dateOfBirth) : null;
        // Jika age dihitung dari DOB, atau pakai currentAge dari plan

        return {
            createdAt: new Date(data.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),

            user: {
                name: userProfile.fullName || 'User',
            },

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

    async generateInsurancePdf(data: any): Promise<Buffer> {
        const template = handlebars.compile(insuranceReportTemplate);
        const context = this.mapInsuranceData(data);
        const html = template(context);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        await browser.close();
        return Buffer.from(pdfBuffer);
    }

    private mapInsuranceData(data: any) {
        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        // 1. Raw Data & Calculation Re-check (Consistency)
        const monthlyExpense = num(data.monthlyExpense);
        const annualExpense = monthlyExpense * 12;
        const duration = num(data.protectionDuration);
        const debt = num(data.existingDebt);
        const existingCov = num(data.existingCoverage);

        // Asumsi inflasi vs return investasi (Net Rate 2% konservatif)
        // Rumus PV Annuity Due (Simple approximation untuk display)
        // Real calculation mungkin lebih kompleks di service utama, tapi untuk display kita pakai data DB jika ada
        const incomeReplacement = num(data.calculation?.incomeReplacementValue) || (annualExpense * duration);
        const totalNeeded = num(data.calculation?.totalNeeded) || (incomeReplacement + debt);
        const gap = num(data.calculation?.coverageGap) || (totalNeeded - existingCov);

        // Translate Type
        const typeMap = {
            'LIFE': 'Asuransi Jiwa (Life)',
            'HEALTH': 'Asuransi Kesehatan',
            'CRITICAL_ILLNESS': 'Sakit Kritis'
        };

        return {
            createdAt: new Date(data.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),

            user: {
                name: data.user?.fullName || 'User',
            },

            plan: {
                typeLabel: typeMap[data.type] || data.type,
                dependentCount: data.dependentCount,
                monthlyExpense: fmt(monthlyExpense),
                protectionDuration: duration,
                existingDebt: fmt(debt),
                existingCoverage: fmt(existingCov),
                recommendation: data.recommendation || data.plan?.recommendation || '-'
            },

            calc: {
                annualExpense: fmt(annualExpense),
                nettRate: "2.00", // Default assumption text
                incomeReplacementValue: fmt(incomeReplacement),
                debtClearanceValue: fmt(debt),
                totalNeeded: fmt(totalNeeded),
                coverageGap: fmt(gap)
            }
        };
    }

    // [NEW] Generate Goal PDF
    async generateGoalPdf(data: any): Promise<Buffer> {
        const template = handlebars.compile(goalReportTemplate);
        const context = this.mapGoalData(data); // Mapper baru
        const html = template(context);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        await browser.close();
        return Buffer.from(pdfBuffer);
    }

    // [UPDATED] Mapper for Goal Data
    private mapGoalData(data: any) {
        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        // 1. Raw Data Extraction & Reverse Calculation
        const targetAmount = num(data.targetAmount); // Ini adalah Future Value (FV)
        const inflationRate = num(data.inflationRate) / 100;
        const returnRate = num(data.returnRate) / 100;

        // Hitung Durasi (Years) dari targetDate - createdAt (atau now)
        const startDate = data.createdAt ? new Date(data.createdAt) : new Date();
        const endDate = data.targetDate ? new Date(data.targetDate) : new Date();

        // Hitung selisih tahun (secara kasar untuk display)
        let years = endDate.getFullYear() - startDate.getFullYear();
        // Koreksi jika bulan belum sampai
        if (endDate.getMonth() < startDate.getMonth()) years--;
        // Minimal 1 tahun agar tidak error pembagian
        years = Math.max(1, years);

        // Hitung Current Cost (PV)
        // Rumus: PV = FV / (1 + i)^n
        // Kita balik rumus FV = PV * (1+i)^n
        const currentCost = targetAmount / Math.pow(1 + inflationRate, years);

        // 2. Re-Calculation for Display Consistency
        const futureValue = targetAmount; // FV sudah ada di DB

        // Monthly Payment (PMT)
        // Kita gunakan data.monthlySaving dari DB jika ada (hasil hitungan akurat saat save)
        // Jika tidak ada, kita hitung ulang.
        let monthlySaving = num(data.monthlySaving);

        if (monthlySaving === 0) {
            const r = returnRate / 12;
            const n = years * 12;
            if (r === 0) {
                monthlySaving = futureValue / n;
            } else {
                monthlySaving = (futureValue * r) / (Math.pow(1 + r, n) - 1);
            }
        }

        // Inflasi Effect (Selisih FV - PV)
        const inflationEffect = futureValue - currentCost;

        // 3. Mapping Return
        // Handling User Profile (jika include user dilakukan di controller)
        const userProfile = data.user || {};

        return {
            createdAt: new Date(data.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),

            user: {
                name: userProfile.fullName || 'User', // Sesuaikan dengan schema User Anda
            },

            goal: {
                name: data.goalName || 'Tujuan Keuangan',
                currentCost: fmt(currentCost), // Menampilkan estimasi harga hari ini
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

    // [NEW] Generate Education PDF (Family Report)
    async generateEducationPdf(dataArray: any[]): Promise<Buffer> {
        const template = handlebars.compile(educationReportTemplate);
        const context = this.mapEducationData(dataArray);
        const html = template(context);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' }, // Margin handled by CSS @page
        });

        await browser.close();
        return Buffer.from(pdfBuffer);
    }

    // [NEW] Mapper for Education (Array Input)
    private mapEducationData(dataArray: any[]) {
        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        // Urutan Level agar rapi di PDF
        const levelOrder = ['TK', 'SD', 'SMP', 'SMA', 'S1', 'S2'];

        const plans = dataArray.map(item => {
            const plan = item.plan;
            const calc = item.calculation;

            // 1. Hitung Usia Anak
            const dob = new Date(plan.childDob);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
                age--;
            }

            // 2. Grouping Stages by Level
            const stagesMap = new Map<string, any[]>();

            (calc.stagesBreakdown || []).forEach((stage: any) => {
                const level = stage.level;
                if (!stagesMap.has(level)) {
                    stagesMap.set(level, []);
                }
                stagesMap.get(level)?.push({
                    costType: stage.costType === 'ENTRY' ? 'Uang Pangkal' : 'SPP Tahunan',
                    yearsToStart: stage.yearsToStart,
                    currentCost: fmt(stage.currentCost),
                    futureCost: fmt(stage.futureCost),
                    monthlySaving: fmt(stage.monthlySaving),
                    rawFutureCost: Number(stage.futureCost) // Helper untuk subtotal
                });
            });

            // 3. Convert Map to Array & Sort
            const groupedStages = Array.from(stagesMap.entries())
                .map(([levelName, items]) => {
                    // Hitung subtotal per level untuk header card
                    const subTotalRaw = items.reduce((sum, i) => sum + i.rawFutureCost, 0);
                    const minYears = Math.min(...items.map(i => i.yearsToStart)); // Tahun mulai paling cepat

                    return {
                        levelName,
                        items,
                        subTotalCost: fmt(subTotalRaw),
                        startIn: minYears
                    };
                })
                .sort((a, b) => {
                    return levelOrder.indexOf(a.levelName) - levelOrder.indexOf(b.levelName);
                });

            return {
                childName: plan.childName,
                childAge: age,
                uniYear: dob.getFullYear() + 18,
                inflationRate: plan.inflationRate,
                returnRate: plan.returnRate,
                method: plan.method === 'GEOMETRIC' ? 'Geometrik (Bertahap)' : 'Statik',

                totalFutureCost: fmt(calc.totalFutureCost),
                monthlySaving: fmt(calc.monthlySaving),

                groupedStages: groupedStages // Gunakan data yang sudah digroup
            };
        });

        return {
            plans: plans
        };
    }

    // [NEW] Generate PDF from History Detail
    // Input: { score, globalStatus, netWorth, ratios, record: { ...rawFinancialData } }
    async generateHistoryCheckupPdf(data: any): Promise<Buffer> {
        const template = handlebars.compile(historyCheckupReportTemplate);
        const context = this.mapHistoryCheckupData(data); // Mapper khusus
        const html = template(context);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        await browser.close();
        return Buffer.from(pdfBuffer);
    }

    // [UPDATED] Mapper for History Checkup - Full Page Ratio Logic
    private mapHistoryCheckupData(fullData: any) {
        const data = fullData.record || {};
        const analysis = fullData;

        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        // --- 1. GROUPING NERACA ---
        const assetCash = num(data.assetCash);
        const assetPersonal = num(data.assetHome) + num(data.assetVehicle) + num(data.assetJewelry) + num(data.assetAntique) + num(data.assetPersonalOther);
        const assetInvest = num(data.assetInvHome) + num(data.assetInvVehicle) + num(data.assetGold) + num(data.assetInvAntique) + num(data.assetStocks) + num(data.assetMutualFund) + num(data.assetBonds) + num(data.assetDeposit) + num(data.assetInvOther);
        const totalAsset = assetCash + assetPersonal + assetInvest;

        const debtKPR = num(data.debtKPR);
        const debtKPM = num(data.debtKPM);
        const debtOther = num(data.debtCC) + num(data.debtCoop) + num(data.debtConsumptiveOther);
        const debtProductive = num(data.debtBusiness);
        const totalDebt = debtKPR + debtKPM + debtOther + debtProductive;

        // --- 2. GROUPING ARUS KAS ---
        const incomeFixed = num(data.incomeFixed);
        const incomeVariable = num(data.incomeVariable);
        const totalIncome = incomeFixed + incomeVariable;

        const expenseDebt = num(data.installmentKPR) + num(data.installmentKPM) + num(data.installmentCC) + num(data.installmentCoop) + num(data.installmentConsumptiveOther) + num(data.installmentBusiness);
        const expenseInsurance = num(data.insuranceLife) + num(data.insuranceHealth) + num(data.insuranceHome) + num(data.insuranceVehicle) + num(data.insuranceBPJS) + num(data.insuranceOther);
        const expenseSaving = num(data.savingEducation) + num(data.savingRetirement) + num(data.savingPilgrimage) + num(data.savingHoliday) + num(data.savingEmergency) + num(data.savingOther);
        const expenseLiving = num(data.expenseFood) + num(data.expenseSchool) + num(data.expenseTransport) + num(data.expenseCommunication) + num(data.expenseHelpers) + num(data.expenseTax) + num(data.expenseLifestyle);
        const totalExpense = expenseDebt + expenseInsurance + expenseSaving + expenseLiving;

        // --- 3. LOGIC SMART PAGINATION ---
        const allRatios = (analysis.ratios || []).map((r: any) => ({
            ...r,
            valueDisplay: r.id === 'emergency_fund' ? `${r.value}x` : `${r.value}%`,
            statusLabel: r.statusColor.includes('GREEN') ? 'Sehat' : r.statusColor === 'YELLOW' ? 'Waspada' : 'Bahaya',
            cssClass: r.statusColor.includes('GREEN') ? 'bg-green' : r.statusColor === 'YELLOW' ? 'bg-yellow' : 'bg-red'
        }));

        const ratioPages: any[] = [];
        const remainingRatios = [...allRatios];

        /**
         * LOGIKA: Halaman 2 (Halaman Rasio Pertama) dibuat muat hingga 8 rasio (Grid 2x4).
         * Jika rasio lebih dari 8 (misal ada tambahan indikator di masa depan), 
         * barulah sisa rasio tersebut dibuatkan halaman baru (Page 3).
         */
        const FIRST_RATIO_PAGE_CAPACITY = 8;
        const NEXT_RATIO_PAGE_CAPACITY = 10; // Halaman kosong penuh muat lebih banyak

        if (remainingRatios.length > 0) {
            // Ambil 8 pertama untuk Halaman 2
            const page2Items = remainingRatios.splice(0, FIRST_RATIO_PAGE_CAPACITY);
            ratioPages.push({
                isFirstPage: true,
                pageNumber: 2,
                items: page2Items
            });
        }

        // Jika masih ada sisa (rasio ke-9 dst), buat Halaman 3
        let pageCounter = 3;
        while (remainingRatios.length > 0) {
            const chunk = remainingRatios.splice(0, NEXT_RATIO_PAGE_CAPACITY);
            ratioPages.push({
                isFirstPage: false,
                pageNumber: pageCounter++,
                items: chunk
            });
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