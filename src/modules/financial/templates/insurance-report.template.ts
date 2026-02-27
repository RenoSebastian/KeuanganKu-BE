import * as fs from 'fs';
import * as path from 'path';

/**
 * UTILITY: Image to Base64 Converter
 */
function getImageBase64(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) {
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
  logo: getImageBase64(path.join(ASSET_BASE_PATH, 'logokeuanganku.png')),
  // [UPDATED] Menggunakan asset header yang sama/mirip dengan referensi agar konsisten
  header1: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangproteksi1.webp')),
  header2: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangproteksi2.webp')),
};

/**
 * GENERATOR FUNCTION (Template Literal)
 */
export const generateInsuranceReportHtml = (data: any) => {
  const { client, agent, input, result, meta } = data;

  // Hitung persentase coverage untuk visual bar
  const coveragePercent = Math.min(Math.round((input.existingCoverageRaw / result.totalNeededRaw) * 100) || 0, 100);

  // Tentukan warna status
  const statusColor = coveragePercent >= 90 ? '#10b981' : (coveragePercent >= 50 ? '#f59e0b' : '#be123c');
  const statusText = coveragePercent >= 90 ? 'AMAN' : (coveragePercent >= 50 ? 'WASPADA' : 'BERISIKO');

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Perencanaan Asuransi</title>
  <style>
    :root {
      --primary: #be123c;      /* Rose 700 - Theme Asuransi */
      --primary-light: #fff1f2; /* Rose 50 */
      --secondary: #475569;    /* Slate 600 */
      --dark: #0f172a;         /* Slate 900 */
      --border: #e2e8f0;       /* Slate 200 */
      --accent: #be123c;       /* Sama dengan primary untuk konsistensi */
    }

    @page { 
      size: A4; 
      margin: 15mm 15mm 20mm 15mm; 
    }
    
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    body {
      margin: 0; padding: 0;
      font-family: 'Helvetica', 'Arial', sans-serif;
      color: var(--dark);
      background-color: #ffffff;
      font-size: 10px;
      line-height: 1.5;
    }

    /* --- FOOTER REPEATING (Fixed Position) --- */
    .page-footer-container {
      position: fixed;
      bottom: -10mm; left: 0; right: 0; height: 12mm;
      border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      background: white; font-size: 9px; color: var(--secondary);
      z-index: 999;
    }

    /* --- HEADER GRID 2x2 (ADAPTED FROM REFERENCE) --- */
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
        display: flex; align-items: center; justify-content: center;
        border: 1px solid var(--border);
        border-bottom-right-radius: 20px;
        padding: 10px;
    }
    .logo-img { height: 50px; width: auto; }
    
    .main-heading { font-size: 28px; font-weight: 800; line-height: 1; margin: 0; }
    .sub-heading { text-transform: uppercase; font-size: 9px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 4px; }

    /* --- PROFILE GRID --- */
    .info-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
    
    .section-title {
      font-size: 10px; font-weight: 800; color: var(--secondary);
      text-transform: uppercase; letter-spacing: 1px;
      border-bottom: 2px solid var(--border); padding-bottom: 4px; 
      margin-top: 25px; margin-bottom: 12px;
    }

    .info-card {
      background: #f8fafc; border: 1px solid var(--border);
      border-radius: 12px; padding: 15px;
    }
    .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 10px; }
    .row.highlight { background: var(--primary-light); padding: 4px; border-radius: 4px; font-weight: 700; color: var(--primary); }
    .label { color: var(--secondary); font-weight: 600; }
    .val { font-weight: 700; color: var(--dark); text-align: right; }

    /* --- CALCULATION SECTION --- */
    .calc-container {
      display: flex; gap: 15px; margin-bottom: 25px;
    }
    .calc-box {
      flex: 1; border: 1px solid var(--border); border-radius: 10px; padding: 15px;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .calc-title { font-size: 10px; font-weight: 700; color: var(--accent); margin-bottom: 5px; text-transform: uppercase; }
    .calc-desc { font-size: 9px; color: var(--secondary); margin-bottom: 10px; height: 35px; line-height: 1.3; }
    .calc-amount { font-size: 14px; font-weight: 800; font-family: monospace; text-align: right; }
    .calc-box.primary { background: var(--primary-light); border-color: #fda4af; }
    .calc-box.primary .calc-title { color: var(--primary); }

    /* --- GAP ANALYSIS & VISUAL BAR --- */
    .gap-section {
      background: #ffffff; border: 2px solid var(--border);
      border-radius: 12px; padding: 20px; margin-bottom: 30px;
    }
    .gap-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; }
    .gap-amount { font-size: 28px; font-weight: 800; color: var(--primary); line-height: 1; }

    .bar-container {
      height: 24px; width: 100%; background: #e2e8f0; border-radius: 12px;
      position: relative; overflow: hidden; margin-bottom: 10px;
    }
    .bar-fill {
      height: 100%; background: ${statusColor};
      width: ${coveragePercent}%;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: flex-end;
      padding-right: 10px; color: white; font-size: 10px; font-weight: 700;
      min-width: 15%; 
    }
    .bar-markers {
      display: flex; justify-content: space-between; font-size: 9px; color: var(--secondary); margin-top: 5px; font-weight: 600;
    }

    /* --- RECOMMENDATION --- */
    .rec-box {
      background: #f0f9ff; border: 1px solid #bae6fd;
      border-radius: 12px; padding: 20px;
      border-left: 4px solid var(--primary);
    }
    .rec-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--primary); margin-bottom: 8px; }
    .rec-text { font-size: 11px; line-height: 1.6; color: #0c4a6e; }

  </style>
</head>
<body>
  
  <div class="page-footer-container">
    <div>KeuanganKu Agent Platform • ${meta.documentId}</div>
    <div>CONFIDENTIAL • Generated on ${meta.generatedAt}</div>
  </div>

  <div class="content">
    
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
          <div class="row"><span class="label">Nama Lengkap</span><span class="val">${client.name}</span></div>
          <div class="row"><span class="label">Pekerjaan</span><span class="val">${client.job}</span></div>
          <div class="row"><span class="label">Domisili</span><span class="val">${client.city}</span></div>
          <div class="row"><span class="label">Tgl Lahir</span><span class="val">${client.dob}</span></div>
          <div class="row highlight">
            <span class="label" style="color: var(--primary);">Jumlah Tanggungan</span>
            <span class="val" style="color: var(--primary);">${input.dependents} Orang</span>
          </div>
        </div>
      </div>
      <div>
        <div class="section-title">02. Profil Konsultan</div>
        <div class="info-card" style="border-left: 4px solid var(--primary);">
          <div class="row"><span class="label">Nama Agen</span><span class="val">${agent.name}</span></div>
          <div class="row"><span class="label">Perusahaan</span><span class="val">${agent.companyName}</span></div>
          <div class="row"><span class="label">Level</span><span class="val">${agent.level}</span></div>
        </div>
      </div>
    </div>

    <div class="section-title">03. Parameter Analisa & Asumsi</div>
    <div class="info-card" style="margin-bottom: 25px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
                <div class="row"><span class="label">Biaya Hidup Bulanan</span><span class="val">${input.monthlyExpense}</span></div>
                <div class="row"><span class="label">Sisa Hutang Berjalan</span><span class="val">${input.existingDebt}</span></div>
                <div class="row"><span class="label">Biaya Akhir Hayat</span><span class="val">${input.finalExpense}</span></div>
            </div>
            <div>
                <div class="row"><span class="label">UP Asuransi Saat Ini</span><span class="val">${input.existingCoverage}</span></div>
                <div class="row"><span class="label">Durasi Proteksi</span><span class="val">${input.protectionDuration} Tahun</span></div>
                <div class="row"><span class="label">Asumsi Inflasi / Return</span><span class="val">${input.inflationRate}% / ${input.returnRate}%</span></div>
            </div>
        </div>
    </div>

    <div class="section-title">04. Detail Perhitungan Kebutuhan</div>
    <div class="calc-container">
      <div class="calc-box">
        <div>
          <div class="calc-title">A. DANA HIDUP (Income Replacement)</div>
          <div class="calc-desc">
            Dana pengganti penghasilan untuk menghidupi ${input.dependents} tanggungan selama ${input.protectionDuration} tahun ke depan.
          </div>
        </div>
        <div class="calc-amount">${result.incomeReplacement}</div>
      </div>

      <div class="calc-box">
        <div>
          <div class="calc-title">B. DANA PELUNASAN (Clearance)</div>
          <div class="calc-desc">
            Dana tunai (Cash) untuk melunasi seluruh sisa hutang dan biaya pemakaman seketika.
          </div>
        </div>
        <div class="calc-amount">${result.debtClearance}</div>
      </div>

      <div class="calc-box primary">
        <div>
          <div class="calc-title">TOTAL KEBUTUHAN (A+B)</div>
          <div class="calc-desc">
            Total Uang Pertanggungan (UP) ideal yang harus tersedia jika risiko terjadi hari ini.
          </div>
        </div>
        <div class="calc-amount" style="font-size: 16px;">${result.totalNeeded}</div>
      </div>
    </div>

    <div class="section-title">05. Analisa Kekurangan (Gap Analysis)</div>
    <div class="gap-section">
      <div class="gap-header">
        <div>
          <div style="font-size: 10px; color: var(--secondary); text-transform: uppercase; font-weight: 700;">Status Proteksi Anda</div>
          <div style="font-size: 18px; font-weight: 800; color: ${statusColor};">${statusText} (${coveragePercent}%)</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10px; color: var(--secondary); margin-bottom: 4px;">Kekurangan (Gap) Coverage</div>
          <div class="gap-amount">${result.gap}</div>
        </div>
      </div>

      <div class="bar-container">
        <div class="bar-fill">Terpenuhi</div>
      </div>
      <div class="bar-markers">
        <span>0%</span>
        <span>Existing: ${input.existingCoverage}</span>
        <span>Target: ${result.totalNeeded}</span>
      </div>
    </div>

    <div class="section-title">06. Rekomendasi Strategis</div>
    <div class="rec-box">
        <div class="rec-title">Saran Penambahan UP</div>
        <div class="rec-text">
          ${result.recommendation}
        </div>
    </div>

  </div>
</body>
</html>
  `;
};