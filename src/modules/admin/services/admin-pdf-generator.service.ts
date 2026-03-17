import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { CashflowLedgerItemDto, CashflowStatus } from '../dto/cashflow-ledger.dto';
import * as puppeteer from 'puppeteer';

@Injectable()
export class AdminPdfGeneratorService {
    private readonly logger = new Logger(AdminPdfGeneratorService.name);

    /**
     * Menggunakan Puppeteer (Headless Chrome) untuk merender HTML menjadi PDF Buffer.
     * Pendekatan ini menyelaraskan arsitektur dengan modul Financial yang sudah ada.
     */
    async generateCashflowReport(data: CashflowLedgerItemDto[], periodInfo: string = 'Keseluruhan'): Promise<Buffer> {
        // Kalkulasi Gross Revenue
        const totalGross = data
            .filter(item => item.status === CashflowStatus.VERIFIED)
            .reduce((acc, curr) => acc + curr.amount, 0);

        // Membangun injeksi antarmuka HTML (Template Engine murni)
        const htmlTemplate = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Laporan Arus Kas</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
                body {
                    font-family: 'Inter', sans-serif;
                    color: #1e293b;
                    padding: 40px;
                    margin: 0;
                }
                .header {
                    text-align: center;
                    margin-bottom: 40px;
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 20px;
                }
                .header h1 {
                    margin: 0;
                    color: #0f172a;
                    font-size: 24px;
                    font-weight: 800;
                    letter-spacing: -0.5px;
                }
                .header p {
                    margin: 8px 0 0 0;
                    color: #64748b;
                    font-size: 12px;
                }
                .summary-box {
                    background-color: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 30px;
                    width: max-content;
                }
                .summary-label {
                    font-size: 11px;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .summary-value {
                    font-size: 24px;
                    font-weight: 800;
                    color: #16a34a;
                    margin-top: 4px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                th {
                    background-color: #0f172a;
                    color: #ffffff;
                    text-transform: uppercase;
                    font-size: 10px;
                    letter-spacing: 0.5px;
                    padding: 12px 15px;
                    text-align: left;
                }
                td {
                    padding: 12px 15px;
                    border-bottom: 1px solid #e2e8f0;
                }
                tr:nth-child(even) {
                    background-color: #f8fafc;
                }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                
                /* Status Badges */
                .status { padding: 4px 8px; border-radius: 4px; font-weight: 800; font-size: 10px; }
                .status-VERIFIED { background-color: #dcfce7; color: #166534; }
                .status-PENDING { background-color: #fef3c7; color: #92400e; }
                .status-REJECTED { background-color: #ffe4e6; color: #991b1b; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Buku Besar Arus Kas</h1>
                <p>Periode Analitik: ${periodInfo} | Waktu Cetak: ${new Date().toLocaleString('id-ID')}</p>
            </div>

            <div class="summary-box">
                <div class="summary-label">Total Pendapatan Terverifikasi</div>
                <div class="summary-value">Rp ${totalGross.toLocaleString('id-ID')}</div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Tanggal</th>
                        <th>No. Referensi</th>
                        <th>Pengguna</th>
                        <th>Paket</th>
                        <th class="text-center">Status</th>
                        <th class="text-right">Nominal (IDR)</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(trx => `
                    <tr>
                        <td>${new Date(trx.transactionDate).toLocaleDateString('id-ID')}</td>
                        <td style="font-family: monospace;">${trx.transactionId.split('-')[0].toUpperCase()}</td>
                        <td style="font-weight: 600;">${trx.userName}</td>
                        <td>${trx.planName}</td>
                        <td class="text-center">
                            <span class="status status-${trx.status}">${trx.status}</span>
                        </td>
                        <td class="text-right font-mono" style="font-weight: 600;">
                            ${trx.amount.toLocaleString('id-ID')}
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
        `;

        let browser: puppeteer.Browser | null = null;

        try {
            // Konfigurasi Puppeteer dioptimalkan untuk lingkungan Docker/Server
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            });

            const page = await browser.newPage();

            // Render HTML ke dalam Headless Browser
            await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });

            // Cetak menjadi Buffer PDF
            const pdfUint8Array = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    bottom: '20px',
                    left: '20px',
                    right: '20px'
                }
            });

            return Buffer.from(pdfUint8Array);
        } catch (error: any) {
            this.logger.error(`Kegagalan engine Puppeteer saat merender PDF: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Gagal mengekspor dokumen arus kas.');
        } finally {
            // Memastikan zombie process chrome tertutup apa pun yang terjadi
            if (browser) {
                await browser.close();
            }
        }
    }
}