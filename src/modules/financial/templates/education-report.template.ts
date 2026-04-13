import * as fs from 'fs';
import * as path from 'path';

/**
 * ------------------------------------------------------------------
 * 1. LOGIC LAYER: ASSET HANDLING
 * ------------------------------------------------------------------
 * Mengubah gambar fisik menjadi Base64 string agar bisa dirender
 * oleh Puppeteer tanpa masalah path relative/absolute.
 */
function getImageBase64(filePath: string): string {
  try {
    // Cek keberadaan file
    if (!fs.existsSync(filePath)) {
      console.warn(`[PDF Assets] File not found: ${filePath}`);
      return '';
    }

    const bitmap = fs.readFileSync(filePath);
    const extension = path.extname(filePath).toLowerCase().replace('.', '');

    let mimeType = '';
    switch (extension) {
      case 'webp':
        mimeType = 'image/webp';
        break;
      case 'png':
        mimeType = 'image/png';
        break;
      case 'jpg':
      case 'jpeg':
        mimeType = 'image/jpeg';
        break;
      case 'svg':
        mimeType = 'image/svg+xml';
        break;
      default:
        mimeType = 'image/png';
    }

    return `data:${mimeType};base64,${bitmap.toString('base64')}`;
  } catch (error: any) {
    console.error(`[PDF Assets] Error loading ${filePath}: ${error.message}`);
    return '';
  }
}

// Path ke folder images (Adjusted for NestJS source structure)
// Note: Pastikan aset gambar sudah ada di folder ini atau disalin saat build (dist)
const ASSET_BASE_PATH = path.join(process.cwd(), 'src/assets/images');

// Load images ke memori saat aplikasi start (Caching)
const assets = {
  logoMaxiPro: getImageBase64(
    path.join(ASSET_BASE_PATH, 'logokeuanganku.png'),
  ),
  headerImg1: getImageBase64(
    path.join(ASSET_BASE_PATH, 'rancangdanapendidikan1.webp'),
  ),
  headerImg2: getImageBase64(
    path.join(ASSET_BASE_PATH, 'rancangdanapendidikan2.webp'),
  ),
};

/**
 * ------------------------------------------------------------------
 * 2. VIEW LAYER: HTML TEMPLATE (AGENT SIMULATION VERSION)
 * ------------------------------------------------------------------
 * Template ini didesain untuk flow simulasi agen:
 * - Header memuat info Agen & Company
 * - Body memuat info Klien
 * - Menampilkan Summary Total Keluarga
 * - Menampilkan Detail per Anak (Looping)
 */
export const educationReportTemplate = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Simulasi Pendidikan</title>
  <style>
    :root {
      --primary: #0e7490;      /* Cyan 700 */
      --primary-dark: #155e75; /* Cyan 800 */
      --secondary: #64748b;    /* Slate 500 */
      --dark: #0f172a;         /* Slate 900 */
      --border: #e2e8f0;       /* Slate 200 */
      --bg-soft: #f8fafc;
      --accent: #f59e0b;       /* Amber 500 */
    }

    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    body {
      margin: 0; padding: 0;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: var(--dark);
      background-color: #fff;
      font-size: 12px;
    }

    @page {
      size: A4;
      margin: 10mm 15mm 15mm 15mm; /* Top, Right, Bottom, Left */
    }

    /* --- HEADER SECTION --- */
    .header-grid {
      display: grid; 
      grid-template-columns: 2fr 1fr; 
      grid-template-rows: 90px 50px; 
      gap: 4px; 
      margin-bottom: 25px;
    }
    
    .h-title-box {
      background-color: var(--primary); color: white; padding: 20px 25px;
      border-top-left-radius: 12px; 
      display: flex; flex-direction: column; justify-content: center;
    }
    
    .h-image-top {
      background-image: url('${assets.headerImg1}'); 
      background-size: cover; background-position: center;
      border-top-right-radius: 12px; 
      background-color: var(--dark); /* Fallback color */
    }
    
    .h-image-bottom {
      background-image: url('${assets.headerImg2}'); 
      background-size: cover; background-position: center;
      border-bottom-left-radius: 12px; 
      background-color: var(--secondary); /* Fallback color */
    }
    
    .h-brand-box {
      background-color: var(--primary-dark); color: white;
      display: flex; align-items: center; justify-content: center;
      border-bottom-right-radius: 12px; 
      padding: 10px;
    }
    
    .logo-maxipro { height: 50px; width: auto; display: block; object-fit: contain; }
    
    .main-heading { font-family: 'Times New Roman', serif; font-size: 24px; line-height: 1.1; margin: 0; font-weight: bold; }
    .sub-heading { text-transform: uppercase; font-size: 9px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 4px; }

    /* --- INFO CARDS --- */
    .info-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;
    }
    .info-card {
      border: 1px solid var(--border); border-radius: 8px; padding: 12px;
      background: var(--bg-soft);
    }
    .info-title {
      font-size: 10px; font-weight: 700; color: var(--secondary); text-transform: uppercase; 
      margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 4px;
    }
    .info-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
    .info-label { color: var(--secondary); }
    .info-val { font-weight: 700; color: var(--dark); }

    /* --- EXECUTIVE SUMMARY --- */
    .summary-section {
      background: linear-gradient(to right, #ecfeff, #f0fdf4);
      border: 1px solid #cffafe; border-radius: 10px; padding: 15px;
      margin-bottom: 30px; position: relative; overflow: hidden;
    }
    .summary-section::before {
      content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--primary);
    }
    .sum-header { font-size: 12px; font-weight: 800; text-transform: uppercase; color: var(--primary); margin-bottom: 12px; }
    
    .sum-metrics { display: flex; justify-content: space-between; gap: 10px; }
    .metric-box { flex: 1; }
    .metric-lbl { font-size: 9px; color: var(--secondary); text-transform: uppercase; margin-bottom: 2px; }
    .metric-val { font-size: 16px; font-weight: 800; color: var(--dark); font-family: monospace; }
    .metric-val.highlight { color: var(--primary); font-size: 18px; }

    /* --- CHILD DETAIL SECTION --- */
    .child-section { 
      margin-bottom: 25px; 
      page-break-inside: avoid; /* Mencegah tabel terpotong di tengah halaman */
    }
    
    .child-header {
      background: var(--dark); color: white; padding: 8px 12px;
      border-top-left-radius: 8px; border-top-right-radius: 8px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .child-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .child-meta { font-size: 10px; opacity: 0.9; }

    .child-body {
      border: 1px solid var(--border); border-top: none; 
      border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;
      padding: 12px;
    }

    /* TABLE STYLES */
    .stages-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 5px; }
    .stages-table th {
      text-align: left; background: var(--bg-soft); color: var(--secondary); padding: 6px 8px;
      border-bottom: 2px solid var(--border); text-transform: uppercase; font-size: 9px;
    }
    .stages-table td { padding: 6px 8px; border-bottom: 1px dashed var(--border); color: var(--dark); vertical-align: middle; }
    .stages-table tr:last-child td { border-bottom: none; }
    
    .col-right { text-align: right; }
    .text-mono { font-family: 'Courier New', monospace; font-weight: 600; letter-spacing: -0.5px; }
    .text-total { color: var(--primary); font-weight: 800; }
    .badge-stage { 
      background: var(--bg-soft); border: 1px solid var(--border); 
      padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9px;
    }

    /* CHILD FOOTER */
    .child-footer {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 10px; padding-top: 10px; border-top: 2px solid var(--border);
    }
    .cf-label { font-size: 10px; font-weight: 700; color: var(--secondary); text-transform: uppercase; }
    .cf-value { font-size: 14px; font-weight: 800; color: var(--primary); font-family: monospace; }

    /* --- PAGE FOOTER --- */
    .page-footer {
      position: fixed; bottom: 0; left: 0; right: 0;
      height: 8mm; border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      background: white; padding-top: 5px;
    }
    .footer-text { font-size: 8px; color: var(--secondary); }
    
    /* DISCLAIMER */
    .disclaimer {
      font-size: 8px; color: #94a3b8; margin-top: 20px; text-align: justify; line-height: 1.3;
      padding: 10px; background: #f8fafc; border-radius: 6px;
    }

  </style>
</head>
<body>

  <div class="header-grid">
    <div class="h-title-box">
      <div class="sub-heading">KEUANGANKU FINANCIAL TOOLS</div>
      <h1 class="main-heading">Simulasi Dana Pendidikan</h1>
    </div>
    <div class="h-image-top"></div>
    <div class="h-image-bottom"></div>
    <div class="h-brand-box">
      <img src="${assets.logoMaxiPro}" class="logo-maxipro" alt="KeuanganKu Logo">
    </div>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <div class="info-title">Profil Klien</div>
      <div class="info-row"><span class="info-label">Nama Lengkap</span><span class="info-val">{{client.name}}</span></div>
      <div class="info-row"><span class="info-label">Tgl Lahir / Usia</span><span class="info-val">{{client.dob}} ({{client.age}} Thn)</span></div>
      <div class="info-row"><span class="info-label">Domisili</span><span class="info-val">{{client.city}}</span></div>
      <div class="info-row"><span class="info-label">Pekerjaan</span><span class="info-val">{{client.job}}</span></div>
    </div>
    <div class="info-card">
      <div class="info-title">Disiapkan Oleh (Agen)</div>
      <div class="info-row"><span class="info-label">Nama Agen</span><span class="info-val">{{agent.name}}</span></div>
      <div class="info-row"><span class="info-label">Agency</span><span class="info-val">{{agent.agency}}</span></div>
      <div class="info-row"><span class="info-label">Tanggal Simulasi</span><span class="info-val">{{generatedAt}}</span></div>
      <div class="info-row"><span class="info-label">Asumsi Inflasi</span><span class="info-val">{{financial.inflationRate}}% / Tahun</span></div>
    </div>
  </div>

  <div class="summary-section">
    <div class="sum-header">Ringkasan Total (Seluruh Anak)</div>
    <div class="sum-metrics">
      <div class="metric-box">
        <div class="metric-lbl">Total Anak</div>
        <div class="metric-val">{{summary.totalChildren}}</div>
      </div>
      <div class="metric-box">
        <div class="metric-lbl">Total Dana Dibutuhkan (FV)</div>
        <div class="metric-val">{{summary.totalFutureCost}}</div>
      </div>
      <div class="metric-box" style="text-align: right;">
        <div class="metric-lbl">Total Investasi Rutin / Bulan</div>
        <div class="metric-val highlight">{{summary.totalMonthlyInvestment}}</div>
      </div>
    </div>
  </div>

  {{#each plans}}
  <div class="child-section">
    <div class="child-header">
      <div class="child-title">{{inc @index}}. {{this.childName}}</div>
      <div class="child-meta">Usia: {{this.childAge}} Tahun | Target Universitas: {{this.uniYear}}</div>
    </div>
    <div class="child-body">
      <table class="stages-table">
        <thead>
          <tr>
            <th width="12%">Jenjang</th>
            <th width="10%">Mulai</th>
            <th width="8%">Durasi</th>
            <th width="22%">Rincian Biaya</th>
            <th width="18%" class="col-right">Biaya Sekarang</th>
            <th width="18%" class="col-right">Biaya Masa Depan</th>
            <th width="12%" class="col-right">Nabung/Bln</th>
          </tr>
        </thead>
        <tbody>
          {{#each this.groupedStages}}
          {{#each this.items}}
          <tr>
            <td><span class="badge-stage">{{../levelName}}</span></td>
            <td class="col-right"><strong>{{this.yearsToStart}}</strong></td>
            <td class="col-right">-</td>
            <td style="font-size: 9px; color: #64748b;">{{this.costType}}</td>
            <td class="col-right text-mono" style="opacity: 0.7; font-size: 10px;">{{this.currentCost}}</td>
            <td class="col-right text-mono text-total">{{this.futureCost}}</td>
            <td class="col-right text-mono" style="color: var(--primary);">{{this.monthlySaving}}</td>
          </tr>
          {{/each}}
          {{/each}}
        </tbody>
      </table>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
        <div style="padding: 8px; background: #f0fdf4; border-radius: 6px; border-left: 3px solid #22c55e;">
          <div class="cf-label" style="color: #16a34a;">Total Dana Dibutuhkan</div>
          <div class="cf-value" style="color: #16a34a;">{{this.totalFutureCost}}</div>
        </div>
        <div style="padding: 8px; background: #eff6ff; border-radius: 6px; border-left: 3px solid var(--primary);">
          <div class="cf-label">Investasi Rutin</div>
          <div class="cf-value">{{this.monthlySaving}}/Bulan</div>
        </div>
      </div>
    </div>
  </div>
  {{/each}}

  <div class="disclaimer">
    <strong>Disclaimer:</strong> Simulasi ini merupakan ilustrasi perencanaan keuangan berdasarkan data yang diberikan dan asumsi tingkat inflasi/hasil investasi. Nilai sebenarnya di masa depan dapat berbeda. Dokumen ini bukan merupakan kontrak asuransi atau jaminan hasil investasi.
  </div>

  <div class="page-footer">
    <div class="footer-text">Generated by KeuanganKu Agent System • ID: {{simulationId}}</div>
    <div class="footer-text">Page 1 of 1</div>
  </div>

</body>
</html>
`;