// File: src/modules/admin/services/admin-pdf-generator.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { CashflowLedgerItemDto, CashflowStatus } from '../dto/cashflow-ledger.dto';
const PdfPrinter = require('pdfmake/js/Printer').default;
import { TDocumentDefinitions, StyleDictionary } from 'pdfmake/interfaces';

@Injectable()
export class AdminPdfGeneratorService {
    private readonly logger = new Logger(AdminPdfGeneratorService.name);
    private printer: any;

    constructor() {
        // Menggunakan standar font Helvetica bawaan (Standard 14 Fonts)
        // Hal ini meniadakan kebutuhan untuk memuat file .ttf fisik di dalam container Docker
        const fonts = {
            Helvetica: {
                normal: 'Helvetica',
                bold: 'Helvetica-Bold',
                italics: 'Helvetica-Oblique',
                bolditalics: 'Helvetica-BoldOblique'
            }
        };
        this.printer = new PdfPrinter(fonts);
    }

    /**
     * Mengonversi struktur JSON Ledger menjadi dokumen PDF siap cetak
     */
    async generateCashflowReport(data: CashflowLedgerItemDto[], periodInfo: string = 'Keseluruhan'): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                // Kalkulasi agregasi ringan untuk summary header
                const totalGross = data
                    .filter(item => item.status === CashflowStatus.VERIFIED)
                    .reduce((acc, curr) => acc + curr.amount, 0);

                const styles: StyleDictionary = {
                    header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10], alignment: 'center' },
                    subheader: { fontSize: 12, margin: [0, 0, 0, 20], alignment: 'center' },
                    tableHeader: { bold: true, fontSize: 10, color: 'white', fillColor: '#1e293b', alignment: 'center' },
                    tableRow: { fontSize: 9, margin: [0, 5, 0, 5] },
                    summaryTitle: { fontSize: 11, bold: true, marginTop: 20 },
                    summaryValue: { fontSize: 14, bold: true, color: '#16a34a' }
                };

                // [FIX] Deklarasi tipe eksplisit untuk menghindari error 'never[]'
                const tableBody: any[][] = [];

                // Table Header
                tableBody.push([
                    { text: 'TANGGAL', style: 'tableHeader' },
                    { text: 'ID TRANSAKSI', style: 'tableHeader' },
                    { text: 'PENGGUNA', style: 'tableHeader' },
                    { text: 'PAKET', style: 'tableHeader' },
                    { text: 'STATUS', style: 'tableHeader' },
                    { text: 'NOMINAL (IDR)', style: 'tableHeader', alignment: 'right' }
                ]);

                // Table Rows
                data.forEach(trx => {
                    tableBody.push([
                        { text: new Date(trx.transactionDate).toLocaleDateString('id-ID'), style: 'tableRow' },
                        { text: trx.transactionId.split('-')[0], style: 'tableRow' }, // Short UUID
                        { text: trx.userName, style: 'tableRow' },
                        { text: trx.planName, style: 'tableRow' },
                        { text: trx.status, style: 'tableRow', alignment: 'center' },
                        { text: trx.amount.toLocaleString('id-ID'), style: 'tableRow', alignment: 'right' }
                    ]);
                });

                const docDefinition: TDocumentDefinitions = {
                    defaultStyle: { font: 'Helvetica' },
                    pageSize: 'A4',
                    pageOrientation: 'portrait',
                    pageMargins: [40, 60, 40, 60],
                    content: [
                        { text: 'LAPORAN ARUS KAS KEUANGAN', style: 'header' },
                        { text: `Periode: ${periodInfo} | Dicetak: ${new Date().toLocaleString('id-ID')}`, style: 'subheader' },

                        // Ringkasan Finansial
                        {
                            columns: [
                                {
                                    width: '*',
                                    text: [
                                        { text: 'Total Pendapatan Terverifikasi:\n', style: 'summaryTitle' },
                                        { text: `Rp ${totalGross.toLocaleString('id-ID')}`, style: 'summaryValue' }
                                    ]
                                }
                            ],
                            columnGap: 10,
                            margin: [0, 0, 0, 20]
                        },

                        // Tabel Ledger
                        {
                            table: {
                                headerRows: 1,
                                widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto'],
                                body: tableBody
                            },
                            layout: {
                                hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 2 : 1,
                                vLineWidth: () => 0,
                                hLineColor: () => '#e2e8f0',
                                paddingLeft: () => 5,
                                paddingRight: () => 5,
                            }
                        }
                    ]
                };

                const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
                const chunks: Buffer[] = [];

                pdfDoc.on('data', (chunk) => chunks.push(chunk));
                pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
                pdfDoc.on('error', (err) => reject(err));

                pdfDoc.end();
            } catch (error) {
                this.logger.error(`Terjadi kesalahan saat membangun struktur PDF: ${error.message}`);
                reject(error);
            }
        });
    }
}