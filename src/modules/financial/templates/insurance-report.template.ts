import * as fs from 'fs';
import * as path from 'path';

/**
 * UTILITY: Image to Base64 Converter
 * Memastikan aset gambar lokal dapat dirender oleh Puppeteer tanpa masalah path.
 */
function getImageBase64(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`[PDF Template] Asset missing: ${filePath}`);
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
    console.error(`[PDF Template] Error converting image: ${error.message}`);
    return '';
  }
}

// Define Asset Paths
const ASSET_BASE_PATH = path.join(process.cwd(), 'src/assets/images');
const assets = {
  // Logo
  logo: getImageBase64(path.join(ASSET_BASE_PATH, 'logokeuanganku.png')),
  // Header Visuals (Asuransi Specific)
  header1: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangproteksi1.webp')),
  header2: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangproteksi2.webp'))
};

export const insuranceReportTemplate = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Perencanaan Asuransi</title>
  <style>
    :root {
      --primary: #be123c;      /* Rose 700 - Insurance Theme */
      --primary-soft: #fff1f2; /* Rose 50 */
      --secondary: #64748b;    /* Slate 500 */
      --dark: #0f172a;         /* Slate 900 */
      --border: #e2e8f0;       /* Slate 200 */
      --accent: #0369a1;       /* Sky 700 (Secondary Accent) */
    }

    /* --- PAGE SETUP --- */
    @page {
      size: A4;
      margin: 0;
    }
    
    * { 
      box-sizing: border-box; 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }

    body {
      margin: 0; padding: 0;
      font-family: 'Helvetica', 'Arial', sans-serif;
      color: var(--dark);
      background-color: #ffffff;
      font-size: 11px;
      line-height: 1.4;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* --- HEADER GRID 2x2 (PROFESSIONAL LAYOUT) --- */
    .header-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 110px 70px;
      gap: 8px;
      margin-bottom: 25px;
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
      background-color: var(--dark); /* Fallback */
    }
    .h-image-left-bottom {
      background-image: url('${assets.header2}');
      background-size: cover; background-position: center;
      border-bottom-left-radius: 20px;
      background-color: var(--secondary); /* Fallback */
    }
    .h-brand-box {
      background-color: #ffffff;
      border: 1px solid var(--border);
      border-bottom-right-radius: 20px;
      display: flex; align-items: center; justify-content: center;
      padding: 10px;
    }
    .logo-img { height: 50px; width: auto; }

    .main-heading { font-size: 28px; font-weight: 800; margin: 0; line-height: 1; }
    .sub-heading { text-transform: uppercase; font-size: 10px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 4px; }

    /* --- SECTION COMPONENTS --- */
    .section-title {
      font-size: 11px; font-weight: 800; color: var(--secondary);
      text-transform: uppercase; letter-spacing: 1px;
      border-bottom: 2px solid var(--border);
      padding-bottom: 5px; margin-top: 20px; margin-bottom: 12px;
    }

    /* --- INFO CARD (PROFILE) --- */
    .info-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .info-card {
      background: #f8fafc; border: 1px solid var(--border);
      border-radius: 12px; padding: 15px;
    }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 10.5px; }
    .label { color: var(--secondary); font-weight: 600; }
    .value { font-weight: 700; color: var(--dark); text-align: right; }

    /* --- BREAKDOWN CARDS (A vs B) --- */
    .breakdown-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .bd-card {
      border: 1px solid var(--border); border-radius: 12px; padding: 15px;
      background: white; display: flex; flex-direction: column; justify-content: space-between;
    }
    .bd-title {
      font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .bd-desc { font-size: 9px; color: var(--secondary); margin-bottom: 10px; line-height: 1.3; min-height: 24px; }
    
    .bd-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 10px; }
    .bd-val { font-family: monospace; font-weight: 700; }
    
    .bd-total {
      margin-top: 10px; padding: 8px; border-radius: 6px;
      display: flex; justify-content: space-between; align-items: center;
      font-weight: 800; font-size: 11px;
    }

    /* --- CALCULATION SUMMARY --- */
    .calc-box {
      background: linear-gradient(to right, #fff1f2, #ffffff);
      border-left: 4px solid var(--primary);
      border-radius: 10px; padding: 15px;
      margin-bottom: 20px;
    }
    .calc-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .calc-row.final { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--primary); }
    .big-num { font-size: 18px; font-weight: 800; font-family: monospace; color: var(--primary); }

    /* --- RECOMMENDATION BOX --- */
    .rec-box {
      background: var(--primary); color: white;
      border-radius: 12px; padding: 20px; text-align: center;
      box-shadow: 0 4px 6px -1px rgba(190, 18, 60, 0.2);
    }
    .rec-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 5px; }
    .rec-amount { font-size: 32px; font-weight: 800; margin-bottom: 10px; font-family: monospace; line-height: 1; }
    .rec-text { 
      font-size: 11px; background: rgba(255,255,255,0.15); 
      padding: 10px; border-radius: 8px; display: inline-block; 
    }

    /* --- FOOTER --- */
    .footer {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 12mm; padding: 0 15mm;
      display: flex; justify-content: space-between; align-items: center;
      border-top: 1px solid var(--border);
      font-size: 9px; color: var(--secondary); background: white;
    }
  </style>
</head>
<body>
  <div class="page">
    
    <div class="header-grid">
      <div class="h-title-box">
        <div class="sub-heading">Financial Protection Plan</div>
        <h1 class="main-heading">Insurance Analysis</h1>
      </div>
      <div class="h-image-right-top"></div>
      <div class="h-image-left-bottom"></div>
      <div class="h-brand-box">
        <img src="${assets.logo}" class="logo-img" alt="Logo">
      </div>
    </div>

    <div class="info-container">
      <div>
        <div class="section-title">01. Profil Klien</div>
        <div class="info-card">
          <div class="info-row"><span class="label">Nama Lengkap</span><span class="value">{{client.name}}</span></div>
          <div class="info-row"><span class="label">Pekerjaan</span><span class="value">{{client.job}}</span></div>
          <div class="info-row"><span class="label">Domisili</span><span class="value">{{client.city}}</span></div>
          <div class="info-row"><span class="label">Tgl Lahir</span><span class="value">{{client.dob}}</span></div>
        </div>
      </div>
      <div>
        <div class="section-title">02. Profil Konsultan</div>
        <div class="info-card" style="border-left: 4px solid var(--primary);">
          <div class="info-row"><span class="label">Nama Agen</span><span class="value">{{agent.name}}</span></div>
          <div class="info-row"><span class="label">Perusahaan</span><span class="value">{{agent.parentCompany}}</span></div>
          <div class="info-row"><span class="label">Group Agency</span><span class="value">{{agent.groupAgency}}</span></div>
          <div class="info-row"><span class="label">Level</span><span class="value">{{agent.level}}</span></div>
        </div>
      </div>
    </div>

    <div class="section-title">03. Parameter Analisa Risiko</div>
    <div class="info-card" style="margin-bottom: 20px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <div class="info-row"><span class="label">Jenis Asuransi</span><span class="value" style="color:var(--primary);">{{input.typeLabel}}</span></div>
          <div class="info-row"><span class="label">Jumlah Tanggungan</span><span class="value">{{input.dependentCount}} Orang</span></div>
          <div class="info-row"><span class="label">Durasi Proteksi</span><span class="value">{{input.protectionDuration}} Tahun</span></div>
        </div>
        <div>
          <div class="info-row"><span class="label">Asumsi Inflasi</span><span class="value">{{input.inflationRate}}%</span></div>
          <div class="info-row"><span class="label">Asumsi Return</span><span class="value">{{input.returnRate}}%</span></div>
          <div class="info-row"><span class="label">UP Saat Ini (Existing)</span><span class="value">{{input.existingCoverage}}</span></div>
        </div>
      </div>
    </div>

    <div class="section-title">04. Detail Kebutuhan Dana Proteksi</div>
    
    <div class="breakdown-grid">
      <div class="bd-card">
        <div>
          <div class="bd-title" style="color: var(--accent);">A. Living Cost Protection</div>
          <div class="bd-desc">
            Dana yang dibutuhkan keluarga untuk bertahan hidup (Income Replacement) selama periode proteksi jika pencari nafkah tutup usia.
          </div>
          <div class="bd-row">
            <span class="label">Biaya Hidup / Bulan</span>
            <span class="bd-val">{{input.monthlyExpense}}</span>
          </div>
          <div class="bd-row">
            <span class="label">Biaya Hidup / Tahun</span>
            <span class="bd-val">{{result.annualExpense}}</span>
          </div>
        </div>
        <div class="bd-total" style="background: #f0f9ff; color: var(--accent);">
          <span>TOTAL DANA HIDUP</span>
          <span>{{result.incomeReplacement}}</span>
        </div>
      </div>

      <div class="bd-card">
        <div>
          <div class="bd-title" style="color: var(--primary);">B. Debt & Final Clearance</div>
          <div class="bd-desc">
            Dana tunai (Cash) yang harus tersedia seketika untuk melunasi seluruh sisa hutang dan biaya akhir hayat (pemakaman).
          </div>
          <div class="bd-row">
            <span class="label">Sisa Hutang Berjalan</span>
            <span class="bd-val">{{input.existingDebt}}</span>
          </div>
          <div class="bd-row">
            <span class="label">Biaya Pemakaman</span>
            <span class="bd-val">{{input.finalExpense}}</span>
          </div>
        </div>
        <div class="bd-total" style="background: #fff1f2; color: var(--primary);">
          <span>TOTAL DANA PELUNASAN</span>
          <span>{{result.debtClearance}}</span>
        </div>
      </div>
    </div>

    <div class="section-title">05. Analisa Kekurangan (Gap Analysis)</div>
    <div class="calc-box">
      <div class="calc-row">
        <span class="label">Total Kebutuhan Proteksi (A + B)</span>
        <span class="value">{{result.totalNeeded}}</span>
      </div>
      <div class="calc-row">
        <span class="label">Dikurangi: UP Asuransi Saat Ini</span>
        <span class="value" style="color: #16a34a;">- {{result.existing}}</span>
      </div>
      <div class="calc-row final">
        <span class="label" style="font-weight: 800; color: var(--primary); text-transform: uppercase;">
          Kekurangan Uang Pertanggungan (Coverage Gap)
        </span>
        <span class="big-num">{{result.gap}}</span>
      </div>
    </div>

    <div class="section-title">06. Rekomendasi Strategis</div>
    <div class="rec-box">
      <div class="rec-label">Saran Penambahan UP</div>
      <div class="rec-amount">{{result.gap}}</div>
      <div class="rec-text">
        {{result.recommendation}}
      </div>
    </div>

    <div class="footer">
      <div>KeuanganKu Agent Platform • {{documentId}}</div>
      <div>CONFIDENTIAL • Generated on {{generatedAt}}</div>
    </div>

  </div>
</body>
</html>
`;