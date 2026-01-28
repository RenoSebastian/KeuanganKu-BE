import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer'; // Atau puppeteer-core untuk production
import * as handlebars from 'handlebars';
import { checkupReportTemplate } from '../templates/checkup-report.template';
import { HealthAnalysisResult } from '../utils/financial-math.util';

@Injectable()
export class PdfGeneratorService {

    async generateCheckupPdf(data: any): Promise<Buffer> {
        // 1. Compile Template
        const template = handlebars.compile(checkupReportTemplate);

        // 2. Prepare Data for Template (Mapping Logic)
        const context = this.mapDataToContext(data);

        // 3. Render HTML String
        const html = template(context);

        // 4. Launch Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'], // Penting untuk Docker/Server environment
        });
        const page = await browser.newPage();

        // 5. Set Content & Wait for Network (Fonts/Images)
        await page.setContent(html, { waitUntil: 'networkidle0' });

        // 6. Print to PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true, // Agar warna background/gradient tercetak
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }, // Margin diatur di CSS
        });

        await browser.close();

        // Return Buffer (Uint8Array)
        return Buffer.from(pdfBuffer);
    }

    // Helper: Mapping data BE raw ke format Handlebars yang bersih
    private mapDataToContext(data: any) {
        const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

        return {
            userName: data.userProfile?.name || 'User',
            checkDate: new Date(data.checkDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
            score: data.healthScore,
            globalStatus: data.status,
            scoreColor: data.healthScore >= 80 ? '#22c55e' : data.healthScore >= 50 ? '#f59e0b' : '#ef4444',
            netWorth: formatRp(Number(data.totalNetWorth)),
            monthlySurplus: formatRp(Number(data.surplusDeficit)),

            // Hitung Count
            healthyCount: (data.ratiosDetails as any[]).filter(r => r.statusColor.includes('GREEN')).length,
            warningCount: (data.ratiosDetails as any[]).filter(r => !r.statusColor.includes('GREEN')).length,

            // Mapping Ratios Array
            ratios: (data.ratiosDetails as any[]).map(r => ({
                label: r.label,
                valueDisplay: r.id === 'emergency_fund' ? `${r.value}x` : `${r.value}%`,
                benchmark: r.benchmark,
                recommendation: r.recommendation,
                statusLabel: r.statusColor === 'GREEN_DARK' ? 'Excellent' : r.statusColor === 'GREEN_LIGHT' ? 'Good' : r.statusColor === 'YELLOW' ? 'Warning' : 'Danger',
                cssClass: r.statusColor.includes('GREEN') ? 'bg-green' : r.statusColor === 'YELLOW' ? 'bg-yellow' : 'bg-red'
            }))
        };
    }
}