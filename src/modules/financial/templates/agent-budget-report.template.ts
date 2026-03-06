import * as fs from 'fs';
import * as path from 'path';

/**
 * LOGIC: ASSET HANDLING
 * Mengonversi gambar lokal menjadi Base64 agar Puppeteer dapat merender tanpa kendala pathing.
 */
function getImageBase64(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return '';
    const bitmap = fs.readFileSync(filePath);
    const extension = path.extname(filePath).toLowerCase().replace('.', '');
    let mimeType = '';
    switch (extension) {
      case 'webp': mimeType = 'image/webp'; break;
      case 'png': mimeType = 'image/png'; break;
      case 'jpg':
      case 'jpeg': mimeType = 'image/jpeg'; break;
      default: mimeType = 'image/png';
    }
    return `data:${mimeType};base64,${bitmap.toString('base64')}`;
  } catch (error) {
    return '';
  }
}

const ASSET_BASE_PATH = path.join(process.cwd(), 'src/assets/images');

const assets = {
  logo: getImageBase64(path.join(ASSET_BASE_PATH, 'logokeuanganku.png')),
  header1: getImageBase64(path.join(ASSET_BASE_PATH, 'rancanganggaran1.webp')),
  header2: getImageBase64(path.join(ASSET_BASE_PATH, 'rancanganggaran2.webp'))
};

export const agentBudgetReportTemplate = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    :root {
      --primary: #0e7490;
      --secondary: #64748b;
      --dark: #0f172a;
      --border: #e2e8f0;
      --bg-soft: #f8fafc;
      --accent: #0284c7;
    }

    /* --- PRINT & PAGE SETUP --- */
    @page {
      size: A4;
      margin: 15mm 15mm 20mm 15mm; /* Margin bawah lebih besar untuk footer */
    }

    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; }

    body {
      margin: 0; padding: 0;
      font-family: 'Helvetica', 'Arial', sans-serif;
      color: var(--dark);
      background-color: white;
      font-size: 11px;
      line-height: 1.5;
    }

    .section-group {
      page-break-inside: avoid; /* Memaksa satu grup (judul + isi) tetap bersama */
      break-inside: avoid;
      width: 100%;
      margin-bottom: 20px;
    }

    /* --- LOGIKA FOOTER REPEATING --- */
    .page-footer-container {
      position: fixed;
      bottom: -10mm;
      left: 0;
      right: 0;
      height: 12mm;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: white;
      font-size: 9px;
      color: var(--secondary);
      z-index: 999;
    }

    /* --- CONTENT WRAPPER --- */
    .content {
      width: 100%;
    }

    /* --- PREVENT ELEMENT BREAKING --- */
    .info-container, .comparison-table, .analysis-memo, .section-title {
      page-break-inside: avoid; /* Mencegah elemen terpotong di tengah halaman */
    }

    /* --- HEADER (HANYA HALAMAN 1) --- */
    .header-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 110px 70px;
      gap: 8px;
      margin-bottom: 30px;
    }
    .h-title-box {
      background-color: var(--primary);
      color: white;
      padding: 20px 30px;
      border-top-left-radius: 20px;
      display: flex; flex-direction: column; justify-content: center;
    }
    .h-image-right-top {
      background-image: url('${assets.header1}');
      background-size: cover; background-position: center;
      border-top-right-radius: 20px;
    }
    .h-image-left-bottom {
      background-image: url('${assets.header2}');
      background-size: cover; background-position: center;
      border-bottom-left-radius: 20px;
    }
    .h-brand-box {
        background-color: #ffffff;
        display: flex; align-items: center; justify-content: center;
        border: 1px solid var(--border);
        border-bottom-right-radius: 20px;
        padding: 10px;
    }
    .logo-maxipro { height: 50px; width: auto; }
    .main-heading { font-size: 28px; font-weight: 800; line-height: 1; margin: 0; }
    .sub-heading { text-transform: uppercase; font-size: 9px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 4px; }

    /* --- COMPONENTS --- */
    .section-title {
      font-size: 10px; font-weight: 800; color: var(--secondary);
      text-transform: uppercase; letter-spacing: 1px;
      border-bottom: 2px solid var(--border); padding-bottom: 4px; 
      margin-top: 10px;
      margin-bottom: 12px;
    }

    .info-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .info-card { background: var(--bg-soft); border: 1px solid var(--border); border-radius: 12px; padding: 15px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .label { color: var(--secondary); font-weight: 600; }
    .value { font-weight: 700; text-align: right; }

    .comparison-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .comparison-table th { background: #f1f5f9; padding: 8px 10px; text-align: left; border-bottom: 2px solid var(--border); color: var(--secondary); text-transform: uppercase; font-size: 9px; }
    .comparison-table td { padding: 10px; border-bottom: 1px solid var(--border); }
    .val-col { text-align: right; font-family: monospace; font-size: 11px; font-weight: 700; }
    .highlight-row { background: #f8fafc; font-weight: 800; }

    .analysis-memo {
      background-color: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 16px;
      padding: 20px;
    }
    .memo-header {
      color: var(--accent); font-weight: 800; font-size: 11px; text-transform: uppercase; margin-bottom: 12px;
    }
    .analysis-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
    .analysis-item { background: white; padding: 12px; border-radius: 10px; border: 1px solid #e0f2fe; }
    .analysis-label { font-size: 9px; color: var(--secondary); font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
    .analysis-value { font-size: 12px; font-weight: 800; }
    
    .recommendation-text {
      font-size: 11px; color: #0c4a6e; line-height: 1.6;
      background: #e0f2fe; padding: 15px; border-radius: 10px;
      border-left: 4px solid var(--accent);
    }
  </style>
</head>
<body>
  <div class="page-footer-container">
    <div>KeuanganKu Agent Platform • {{documentId}}</div>
    <div>CONFIDENTIAL • Generated on {{generatedAt}}</div>
  </div>

  <div class="content">
    <div class="header-grid">
      <div class="h-title-box">
        <div class="sub-heading">Financial Planning Simulation</div>
        <h1 class="main-heading">Budget Plan</h1>
      </div>
      <div class="h-image-right-top"></div>
      <div class="h-image-left-bottom"></div>
      <div class="h-brand-box">
        <img src="${assets.logo}" class="logo-maxipro" alt="Logo">
      </div>
    </div>

    <div class="section-group">
      <div class="info-container">
        <div>
          <div class="section-title">01. Profil Klien</div>
          <div class="info-card">
            <div class="info-row"><span class="label">Nama Lengkap</span><span class="value">{{client.name}}</span></div>
            <div class="info-row"><span class="label">Pekerjaan</span><span class="value">{{client.job}}</span></div>
            <div class="info-row"><span class="label">Domisili</span><span class="value">{{client.city}}</span></div>
          </div>
        </div>
        <div>
          <div class="section-title">02. Profil Konsultan</div>
          <div class="info-card" style="border-left: 4px solid var(--primary);">
            <div class="info-row"><span class="label">Konsultan</span><span class="value">{{agent.name}}</span></div>
            <div class="info-row"><span class="label">Instansi</span><span class="value">{{agent.parentCompany}}</span></div>
            <div class="info-row"><span class="label">Group</span><span class="value">{{agent.companyNameency}}</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-group">
      <div class="section-title">03. Analisa Detail Pendapatan (Income Analysis)</div>
      <table class="comparison-table">
        <thead>
          <tr>
            <th style="width: 40%;">Kategori Sumber Dana</th>
            <th class="val-col">Estimasi / Bulan</th>
            <th class="val-col">Estimasi / Tahun</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Penghasilan Tetap (Fixed Income)</td>
            <td class="val-col">{{financial.fixedMonthly}}</td>
            <td class="val-col">{{financial.fixedAnnual}}</td>
          </tr>
          <tr>
            <td>Penghasilan Variabel (Average)</td>
            <td class="val-col">{{financial.variableMonthly}}</td>
            <td class="val-col">{{financial.variableAnnual}}</td>
          </tr>
          <tr class="highlight-row">
            <td style="color: var(--primary);">TOTAL ESTIMASI PENDAPATAN</td>
            <td class="val-col" style="color: var(--primary);">{{financial.totalMonthly}}</td>
            <td class="val-col" style="color: var(--primary);">{{financial.totalAnnual}}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section-group">
      <div class="section-title">04. Rencana Alokasi Anggaran Ideal</div>
      <table class="comparison-table">
        <thead>
          <tr>
            <th style="width: 40%;">Pos Alokasi Pengeluaran</th>
            <th class="val-col">Alokasi / Bulan</th>
            <th class="val-col">Alokasi / Tahun</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border-left: 4px solid #3b82f6;">Biaya Hidup (45%)</td>
            <td class="val-col">{{allocation.livingMonthly}}</td>
            <td class="val-col">{{allocation.livingAnnual}}</td>
          </tr>
          <tr>
            <td style="border-left: 4px solid #f59e0b;">Cicilan Hutang Produktif (Maks 20%)</td>
            <td class="val-col">{{allocation.productiveMonthly}}</td>
            <td class="val-col">{{allocation.productiveAnnual}}</td>
          </tr>
          <tr>
            <td style="border-left: 4px solid #ef4444;">Cicilan Hutang Konsumtif (Maks 15%)</td>
            <td class="val-col">{{allocation.consumptiveMonthly}}</td>
            <td class="val-col">{{allocation.consumptiveAnnual}}</td>
          </tr>
          <tr>
            <td style="border-left: 4px solid #10b981;">Tabungan & Investasi (Min 10%)</td>
            <td class="val-col">{{allocation.savingMonthly}}</td>
            <td class="val-col">{{allocation.savingAnnual}}</td>
          </tr>
          <tr>
            <td style="border-left: 4px solid #6366f1;">Proteksi & Asuransi (Min 10%)</td>
            <td class="val-col">{{allocation.insuranceMonthly}}</td>
            <td class="val-col">{{allocation.insuranceAnnual}}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section-group">
      <div class="section-title">05. Executive Summary & Recommendation</div>
      <div class="analysis-memo">
        <div class="memo-header">📝 Ringkasan Analis</div>
        <div class="analysis-grid">
          <div class="analysis-item">
            <div class="analysis-label">Batas Aman Living Cost</div>
            <div class="analysis-value">{{allocation.livingMonthly}} / Bln</div>
          </div>
          <div class="analysis-item">
            <div class="analysis-label">Potensi Surplus Investasi</div>
            <div class="analysis-value">{{financial.variableMonthly}} / Bln</div>
          </div>
        </div>
        <div class="recommendation-text">
          <strong>Saran Strategis:</strong><br>
          {{recommendationText}}
        </div>
      </div>
    </div>

  </div>
</body>
</html>
`;