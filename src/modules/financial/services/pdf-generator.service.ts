import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import { checkupReportTemplate } from '../templates/checkup-report.template';
import { budgetReportTemplate } from '../templates/budget-report.template';

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
}