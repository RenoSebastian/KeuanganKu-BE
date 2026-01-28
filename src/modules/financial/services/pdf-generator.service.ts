import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import { checkupReportTemplate } from '../templates/checkup-report.template';

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
        // Helper Formatter
        const fmt = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
        const num = (n: any) => Number(n) || 0;

        // Helper Hitung Umur
        const calculateAge = (dobString: string) => {
            if (!dobString) return '-';
            const diff = Date.now() - new Date(dobString).getTime();
            const age = new Date(diff);
            return Math.abs(age.getUTCFullYear() - 1970);
        };

        // --- 1. GROUPING NERACA (ASSETS vs DEBTS) ---
        // Aset
        const liquidAssets = num(data.assetCash);
        const personalAssets = num(data.assetHome) + num(data.assetVehicle) + num(data.assetJewelry) + num(data.assetAntique) + num(data.assetPersonalOther);
        const investAssets = num(data.assetInvHome) + num(data.assetInvVehicle) + num(data.assetGold) + num(data.assetInvAntique) + num(data.assetStocks) + num(data.assetMutualFund) + num(data.assetBonds) + num(data.assetDeposit) + num(data.assetInvOther);
        const totalAssets = liquidAssets + personalAssets + investAssets;

        // Utang
        const debtHome = num(data.debtKPR);
        const debtVehicle = num(data.debtKPM);
        const debtConsumptive = num(data.debtCC) + num(data.debtCoop) + num(data.debtConsumptiveOther);
        const debtProductive = num(data.debtBusiness);
        const totalDebt = debtHome + debtVehicle + debtConsumptive + debtProductive;

        // --- 2. GROUPING ARUS KAS (INCOME vs EXPENSE) ---
        // Pemasukan (Tahunan) -> Asumsi data dari DB disimpan dalam BULANAN, tapi report minta TAHUNAN? 
        // *Catatan: Sesuaikan logika ini. Jika DB simpan bulanan, dikali 12. Jika tahunan, biarkan.*
        // Di JSON contoh Anda terlihat angka besar (Milyaran), asumsi ini sudah TAHUNAN.
        const incomeFixed = num(data.incomeFixed);
        const incomeVar = num(data.incomeVariable);
        const totalIncome = incomeFixed + incomeVar;

        // Pengeluaran
        const expInstallments = num(data.installmentKPR) + num(data.installmentKPM) + num(data.installmentCC) + num(data.installmentCoop) + num(data.installmentConsumptiveOther) + num(data.installmentBusiness);
        const expInsurance = num(data.insuranceLife) + num(data.insuranceHealth) + num(data.insuranceHome) + num(data.insuranceVehicle) + num(data.insuranceBPJS) + num(data.insuranceOther);
        const expSavings = num(data.savingEducation) + num(data.savingRetirement) + num(data.savingPilgrimage) + num(data.savingHoliday) + num(data.savingEmergency) + num(data.savingOther);
        const expLiving = num(data.expenseFood) + num(data.expenseSchool) + num(data.expenseTransport) + num(data.expenseCommunication) + num(data.expenseHelpers) + num(data.expenseTax) + num(data.expenseLifestyle);
        const totalExpense = expInstallments + expInsurance + expSavings + expLiving;

        // --- 3. MAPPING RETURN ---
        return {
            // Header Data
            checkDate: new Date(data.checkDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),

            // [FIXED] User Profile Mapping
            user: {
                name: data.userProfile?.name || '-',
                age: calculateAge(data.userProfile?.dob),
                job: data.userProfile?.occupation || '-',
                domicile: data.userProfile?.city || '-',
                dependents: data.userProfile?.childrenCount || 0,
            },
            spouse: data.spouseProfile ? {
                name: data.spouseProfile.name,
                age: calculateAge(data.spouseProfile.dob),
                job: data.spouseProfile.occupation,
                domicile: '-', // Fallback jika tidak ada di schema
            } : null,

            // [NEW] Financial Snapshot Data (Untuk Halaman 1)
            snapshot: {
                netWorth: fmt(num(data.totalNetWorth)),
                surplus: fmt(num(data.surplusDeficit)),
                // Neraca Values
                assets: {
                    liquid: fmt(liquidAssets),
                    personal: fmt(personalAssets),
                    invest: fmt(investAssets),
                    total: fmt(totalAssets)
                },
                debts: {
                    home: fmt(debtHome),
                    vehicle: fmt(debtVehicle),
                    consumptive: fmt(debtConsumptive),
                    business: fmt(debtProductive),
                    total: fmt(totalDebt)
                },
                // Arus Kas Values
                income: {
                    fixed: fmt(incomeFixed),
                    variable: fmt(incomeVar),
                    total: fmt(totalIncome)
                },
                expense: {
                    debt: fmt(expInstallments),
                    insurance: fmt(expInsurance),
                    saving: fmt(expSavings),
                    living: fmt(expLiving),
                    total: fmt(totalExpense)
                }
            },

            // Score & Ratios (Untuk Halaman 2)
            score: data.healthScore,
            globalStatus: data.status, // SEHAT / WASPADA / BAHAYA
            scoreColor: data.healthScore >= 80 ? '#22c55e' : data.healthScore >= 50 ? '#f59e0b' : '#ef4444',

            healthyCount: (data.ratiosDetails || []).filter((r: any) => r.statusColor.includes('GREEN')).length,
            warningCount: (data.ratiosDetails || []).filter((r: any) => !r.statusColor.includes('GREEN')).length,

            ratios: (data.ratiosDetails || []).map((r: any) => ({
                label: r.label,
                valueDisplay: r.id === 'emergency_fund' ? `${r.value}x` : `${r.value}%`,
                benchmark: r.benchmark,
                recommendation: r.recommendation,
                // Mapping statusColor BE ke label UI
                statusLabel: r.statusColor === 'GREEN_DARK' ? 'Excellent' : r.statusColor === 'GREEN_LIGHT' ? 'Good' : r.statusColor === 'YELLOW' ? 'Warning' : 'Danger',
                cssClass: r.statusColor.includes('GREEN') ? 'bg-green' : r.statusColor === 'YELLOW' ? 'bg-yellow' : 'bg-red'
            }))
        };
    }
}