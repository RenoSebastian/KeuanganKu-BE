import * as fs from 'fs';
import * as path from 'path';

/**
 * ------------------------------------------------------------------
 * 1. LOGIC LAYER: ASSET HANDLING
 * ------------------------------------------------------------------
 */
function getImageBase64(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) {
      // Fallback: Return string kosong agar PDF tetap ter-generate meski tanpa gambar
      return '';
    }
    const bitmap = fs.readFileSync(filePath);
    const extension = path.extname(filePath).toLowerCase().replace('.', '');

    let mimeType = '';
    switch (extension) {
      case 'webp': mimeType = 'image/webp'; break;
      case 'png': mimeType = 'image/png'; break;
      case 'jpg':
      case 'jpeg': mimeType = 'image/jpeg'; break;
      case 'svg': mimeType = 'image/svg+xml'; break;
      default: mimeType = 'image/png';
    }

    return `data:${mimeType};base64,${bitmap.toString('base64')}`;
  } catch (error: any) {
    console.error(`[PDF Assets] Error loading ${filePath}: ${error.message}`);
    return '';
  }
}

// Path ke folder images (Sesuaikan dengan struktur project Anda)
const ASSET_BASE_PATH = path.join(process.cwd(), 'src/assets/images');

// Load images sekali saja saat module di-load
const assets = {
  logoMaxiPro: getImageBase64(path.join(ASSET_BASE_PATH, 'logokeuanganku.png')),
  // Pastikan nama file sesuai dengan yang ada di folder assets Anda
  headerImg1: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangdanapendidikan1.webp')),
  headerImg2: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangdanapendidikan2.webp'))
};

/**
 * ------------------------------------------------------------------
 * 2. VIEW LAYER: HTML TEMPLATE (AGENT SIMULATION VERSION)
 * ------------------------------------------------------------------
 * Template ini didesain untuk flow simulasi agen:
 * - Header memuat info Agen & Company
 * - Body memuat info Klien
 * - Menampilkan Summary Total Keluarga
 * - Menampilkan Detail per Anak
 */
export const educationSimulationReportTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Education Simulation Report</title>
  <style>
    :root {
      --primary: #0e7490;      /* Cyan 700 */
      --primary-dark: #155e75; /* Cyan 800 */
      --secondary: #64748b;    /* Slate 500 */
      --dark: #0f172a;         /* Slate 900 */
      --border: #e2e8f0;       /* Slate 200 */
      --bg-soft: #f8fafc;
      --accent: #f59e0b;       /* Amber 500 */
      --success: #10b981;      /* Emerald 500 */
      --danger: #ef4444;       /* Red 500 */
    }

    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    body {
      margin: 0; padding: 0;
      font-family: Helvetica, Arial, sans-serif;
      color: var(--dark);
      background-color: #fff;
    }

    @page {
      size: A4;
      margin: 15mm 15mm 20mm 15mm; /* Top, Right, Bottom, Left */
    }

    /* --- HEADER SECTION --- */
    .header-grid {
      display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: 100px 60px; 
      gap: 6px; margin-bottom: 25px;
    }
    .h-title-box {
      background-color: var(--primary); color: white; padding: 20px 25px;
      border-top-left-radius: 16px; display: flex; flex-direction: column; justify-content: center;
    }
    .h-image-top {
      background-image: url('${assets.headerImg1}'); background-size: cover; background-position: center;
      border-top-right-radius: 16px; background-color: var(--dark);
    }
    .h-image-bottom {
      background-image: url('${assets.headerImg2}'); background-size: cover; background-position: center;
      border-bottom-left-radius: 16px; background-color: var(--secondary);
    }
    .h-brand-box {
      background-color: var(--primary-dark); color: white;
      display: flex; align-items: center; justify-content: center;
      border-bottom-right-radius: 16px; padding: 10px;
    }
    .logo-maxipro { height: 70px; width: auto; display: block; }
    
    .main-heading { font-family: 'Times New Roman', serif; font-size: 28px; line-height: 1.1; margin: 0; }
    .sub-heading { text-transform: uppercase; font-size: 10px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 4px; }

    /* --- AGENT & CLIENT INFO --- */
    .info-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;
    }
    .info-card {
      border: 1px solid var(--border); border-radius: 10px; padding: 15px;
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
      border: 1px solid #cffafe; border-radius: 12px; padding: 20px;
      margin-bottom: 30px; position: relative; overflow: hidden;
    }
    .summary-section::before {
      content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; background: var(--primary);
    }
    .sum-header { font-size: 12px; font-weight: 800; text-transform: uppercase; color: var(--primary); margin-bottom: 15px; }
    
    .sum-metrics { display: flex; justify-content: space-between; gap: 15px; }
    .metric-box { flex: 1; }
    .metric-lbl { font-size: 10px; color: var(--secondary); text-transform: uppercase; margin-bottom: 4px; }
    .metric-val { font-size: 18px; font-weight: 800; color: var(--dark); font-family: monospace; }
    .metric-val.highlight { color: var(--primary); font-size: 22px; }

    /* --- CHILD DETAIL SECTION --- */
    .child-section { margin-bottom: 30px; page-break-inside: avoid; }
    
    .child-header {
      background: var(--dark); color: white; padding: 10px 15px;
      border-top-left-radius: 10px; border-top-right-radius: 10px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .child-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .child-meta { font-size: 11px; opacity: 0.9; }

    .child-body {
      border: 1px solid var(--border); border-top: none; 
      border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;
      padding: 15px;
    }

    /* STAGES TABLE */
    .stages-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
    .stages-table th {
      text-align: left; background: var(--bg-soft); color: var(--secondary); padding: 8px;
      border-bottom: 2px solid var(--border); text-transform: uppercase; font-size: 9px;
    }
    .stages-table td { padding: 8px; border-bottom: 1px dashed var(--border); color: var(--dark); }
    .stages-table tr:last-child td { border-bottom: none; }
    
    .col-right { text-align: right; }
    .text-mono { font-family: monospace; font-weight: 600; font-size: 11px; }
    .text-accent { color: var(--accent); }
    .text-total { color: var(--primary); font-weight: 800; }

    /* CHILD SUMMARY ROW */
    .child-footer {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 15px; padding-top: 10px; border-top: 2px solid var(--border);
    }
    .cf-label { font-size: 11px; font-weight: 700; color: var(--secondary); text-transform: uppercase; }
    .cf-value { font-size: 16px; font-weight: 800; color: var(--primary); font-family: monospace; }

    /* --- FOOTER --- */
    .page-footer {
      position: fixed; bottom: 0; left: 0; right: 0;
      height: 10mm; border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      background: white; padding-top: 5px;
    }
    .footer-text { font-size: 9px; color: var(--secondary); }

  </style>
</head>
<body>

  <div class="header-grid">
    <div class="h-title-box">
      <div class="sub-heading">MAXIPRO FINANCIAL</div>
      <h1 class="main-heading">Rencana Dana Pendidikan</h1>
    </div>
    <div class="h-image-top"></div>
    <div class="h-image-bottom"></div>
    <div class="h-brand-box">
      <img src="${assets.logoMaxiPro}" class="logo-maxipro" alt="Logo">
    </div>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <div class="info-title">Profil Klien (Orang Tua)</div>
      <div class="info-row"><span class="info-label">Nama</span><span class="info-val">{{client.name}}</span></div>
      <div class="info-row"><span class="info-label">Usia / Tgl Lahir</span><span class="info-val">{{client.dob}}</span></div>
      <div class="info-row"><span class="info-label">Kota Domisili</span><span class="info-val">{{client.city}}</span></div>
      <div class="info-row"><span class="info-label">Pekerjaan</span><span class="info-val">{{client.job}}</span></div>
    </div>
    <div class="info-card">
      <div class="info-title">Disiapkan Oleh</div>
      <div class="info-row"><span class="info-label">Nama Agen</span><span class="info-val">{{agent.name}}</span></div>
      <div class="info-row"><span class="info-label">Level</span><span class="info-val">{{agent.level}}</span></div>
      <div class="info-row"><span class="info-label">Agency</span><span class="info-val">{{agent.agency}}</span></div>
      <div class="info-row"><span class="info-label">Tanggal</span><span class="info-val">{{generatedAt}}</span></div>
    </div>
  </div>

  <div class="summary-section">
    <div class="sum-header">Ringkasan Total Kebutuhan Keluarga</div>
    <div class="sum-metrics">
      <div class="metric-box">
        <div class="metric-lbl">Total Anak</div>
        <div class="metric-val">{{summary.totalChildren}}</div>
      </div>
      <div class="metric-box">
        <div class="metric-lbl">Total Biaya Masa Depan</div>
        <div class="metric-val">{{summary.totalFutureCost}}</div>
      </div>
      <div class="metric-box">
        <div class="metric-lbl">Dana Tersedia Saat Ini</div>
        <div class="metric-val">{{summary.existingFund}}</div>
      </div>
      <div class="metric-box" style="text-align: right;">
        <div class="metric-lbl">Total Investasi Rutin / Bulan</div>
        <div class="metric-val highlight">{{summary.totalMonthlyInvestment}}</div>
      </div>
    </div>
  </div>

  {{#each children}}
  <div class="child-section">
    <div class="child-header">
      <div class="child-title">{{this.index}}. {{this.name}}</div>
      <div class="child-meta">Usia Saat Ini: {{this.age}} Tahun</div>
    </div>
    <div class="child-body">
      <table class="stages-table">
        <thead>
          <tr>
            <th width="20%">Jenjang</th>
            <th width="20%">Jenis Biaya</th>
            <th width="15%">Masuk Dlm</th>
            <th width="20%" class="col-right">Biaya Sekarang</th>
            <th width="25%" class="col-right">Biaya Nanti (FV)</th>
          </tr>
        </thead>
        <tbody>
          {{#each this.stages}}
          <tr>
            <td><strong>{{this.level}}</strong></td>
            <td>{{this.costType}}</td>
            <td>{{this.yearsToStart}} Tahun</td>
            <td class="col-right text-mono">{{this.currentCost}}</td>
            <td class="col-right text-mono text-total">{{this.futureCost}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
      
      <div class="child-footer">
        <div class="cf-label">Rekomendasi Tabungan Rutin (Anak ini)</div>
        <div class="cf-value">{{this.monthlySaving}} / Bulan</div>
      </div>
    </div>
  </div>
  {{/each}}

  <div class="page-footer">
    <div class="footer-text">Dokumen Simulasi Internal • Dibuat melalui KeuanganKu Agent Tools</div>
    <div class="footer-text">ID: {{documentId}} • Page 1 of 1</div>
  </div>

</body>
</html>
`;