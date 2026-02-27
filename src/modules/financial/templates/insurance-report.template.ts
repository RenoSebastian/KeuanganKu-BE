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

const ASSET_BASE_PATH = path.join(process.cwd(), 'src/assets/images');
const assets = {
  logo: getImageBase64(path.join(ASSET_BASE_PATH, 'logokeuanganku.png')),
  header1: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangproteksi1.webp')),
  header2: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangproteksi2.webp')),
};

/**
 * GENERATOR FUNCTION (Template Literal)
 */
export const generateInsuranceReportHtml = (data: any) => {
  const { client, agent, input, result, meta } = data;

  const coveragePercent = Math.min(Math.round((input.existingCoverageRaw / result.totalNeededRaw) * 100) || 0, 100);

  const statusColor = coveragePercent >= 90 ? '#10b981' : (coveragePercent >= 50 ? '#f59e0b' : '#be123c');
  const statusBg = coveragePercent >= 90 ? '#ecfdf5' : (coveragePercent >= 50 ? '#fffbeb' : '#fff1f2');
  const statusText = coveragePercent >= 90 ? 'AMAN' : (coveragePercent >= 50 ? 'WASPADA' : 'BERISIKO');

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Perencanaan Asuransi</title>
  <style>
    :root {
      --primary: #be123c;      /* Rose 700 */
      --primary-dark: #881337; /* Rose 900 */
      --secondary: #475569;    /* Slate 600 */
      --dark: #0f172a;         /* Slate 900 */
      --border: #e2e8f0;       /* Slate 200 */
      --bg-soft: #f8fafc;      /* Slate 50 */
      --white: #ffffff;
    }

    @page { 
      size: A4; 
      margin: 0; /* Margin dikontrol oleh padding .page */
    }
    
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; }

    body {
      margin: 0; padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: var(--dark);
      background-color: #f1f5f9;
      line-height: 1.6;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      background: var(--white);
      margin: 0 auto;
      padding: 15mm 15mm 20mm 15mm;
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }

    @media print {
      body { background: none; }
      .page { margin: 0; box-shadow: none; page-break-after: always; }
    }

    /* --- FOOTER (Repeating) --- */
    .footer {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 15mm; padding: 0 15mm;
      border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      background: var(--white);
      font-size: 9px; color: var(--secondary);
    }

    /* --- HEADER GRID --- */
    .header-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 110px 70px;
      gap: 10px;
      margin-bottom: 30px;
    }
    .h-title-box {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: var(--white);
      padding: 25px 35px;
      border-radius: 20px 4px 20px 4px;
      display: flex; flex-direction: column; justify-content: center;
    }
    .main-heading { font-size: 32px; font-weight: 800; line-height: 1; margin: 0; letter-spacing: -0.5px; }
    .sub-heading { text-transform: uppercase; font-size: 10px; letter-spacing: 3px; opacity: 0.9; margin-bottom: 6px; font-weight: 600; }

    .h-image-right-top {
      background-image: url('${assets.header1}');
      background-size: cover; background-position: center;
      border-radius: 4px 20px 4px 20px;
    }
    .h-image-left-bottom {
      background-image: url('${assets.header2}');
      background-size: cover; background-position: center;
      border-radius: 4px 20px 4px 20px;
    }
    .h-brand-box {
        background: var(--white);
        display: flex; align-items: center; justify-content: center;
        border: 1px solid var(--border);
        border-radius: 20px 4px 20px 4px;
        padding: 10px;
    }
    .logo-img { height: 50px; width: auto; object-fit: contain; }

    /* --- SECTION HELPERS --- */
    .section-title {
      font-size: 11px; font-weight: 800; color: var(--secondary);
      text-transform: uppercase; letter-spacing: 1.5px;
      border-bottom: 2px solid var(--bg-soft);
      padding-bottom: 6px; margin-bottom: 15px; margin-top: 25px;
      display: flex; align-items: center;
    }
    .section-title::before {
      content: ''; display: inline-block; width: 4px; height: 14px; background: var(--primary); margin-right: 8px; border-radius: 2px;
    }

    /* --- INFO CARDS --- */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .info-card {
      background: var(--bg-soft); border: 1px solid var(--border);
      border-radius: 16px; padding: 18px;
    }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11px; }
    .row.highlight { 
      background: var(--white); padding: 8px 12px; border-radius: 10px; 
      border-left: 4px solid var(--primary); margin-top: 10px;
    }
    .label { color: var(--secondary); font-weight: 500; }
    .val { font-weight: 700; color: var(--dark); text-align: right; }

    /* --- CALCULATION BOXES --- */
    .calc-container { display: flex; gap: 15px; margin-bottom: 25px; }
    .calc-box {
      flex: 1; border: 1px solid var(--border); border-radius: 14px; padding: 18px;
      background: var(--white); position: relative;
    }
    .calc-title { font-size: 9px; font-weight: 800; color: var(--secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .calc-desc { font-size: 10px; color: var(--secondary); margin-bottom: 12px; height: 45px; line-height: 1.4; }
    .calc-amount { font-size: 16px; font-weight: 800; color: var(--dark); font-family: 'Inter', sans-serif; }
    
    .calc-box.total { 
      background: linear-gradient(135deg, #fff1f2 0%, var(--white) 100%);
      border-color: #fecdd3; border-width: 1.5px;
    }
    .calc-box.total .calc-title { color: var(--primary); }
    .calc-box.total .calc-amount { color: var(--primary); font-size: 18px; }

    /* --- GAP ANALYSIS --- */
    .gap-card {
      background: var(--white); border: 1.5px solid var(--border);
      border-radius: 20px; padding: 25px; margin-bottom: 30px;
    }
    .gap-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .status-badge {
      background: ${statusBg}; color: ${statusColor};
      padding: 6px 14px; border-radius: 30px; font-weight: 800; font-size: 12px;
      border: 1px solid ${statusColor}44;
    }
    .gap-amount-label { font-size: 10px; color: var(--secondary); text-transform: uppercase; font-weight: 700; }
    .gap-value { font-size: 28px; font-weight: 800; color: var(--primary); letter-spacing: -1px; }

    .progress-wrapper { margin-bottom: 10px; }
    .bar-container {
      height: 28px; width: 100%; background: #f1f5f9; border-radius: 40px;
      overflow: hidden; border: 1px solid var(--border);
    }
    .bar-fill {
      height: 100%; background: ${statusColor}; width: ${coveragePercent}%;
      transition: width 1s ease-in-out; display: flex; align-items: center; justify-content: flex-end;
      padding-right: 15px; color: white; font-size: 11px; font-weight: 700;
    }
    .bar-labels { display: flex; justify-content: space-between; font-size: 10px; color: var(--secondary); margin-top: 8px; font-weight: 600; }

    /* --- RECOMMENDATION --- */
    .rec-box {
      background: #f0f9ff; border: 1px solid #bae6fd;
      border-radius: 16px; padding: 25px; display: flex; gap: 20px; align-items: flex-start;
    }
    .rec-icon {
      background: #0ea5e9; color: white; width: 40px; height: 40px; 
      border-radius: 12px; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 20px;
    }
    .rec-content { flex: 1; }
    .rec-title { font-size: 13px; font-weight: 800; color: #0369a1; margin-bottom: 6px; text-transform: uppercase; }
    .rec-text { font-size: 11px; line-height: 1.6; color: #0c4a6e; }

  </style>
</head>
<body>
  
  <div class="page">
    <div class="footer">
      <div>KeuanganKu Agent Platform • ${meta.documentId}</div>
      <div>CONFIDENTIAL • Generated on ${meta.generatedAt}</div>
    </div>

    <!-- Header -->
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

    <div class="grid-2">
      <!-- Client Profile -->
      <section>
        <div class="section-title">01. Profil Klien</div>
        <div class="info-card">
          <div class="row"><span class="label">Nama Lengkap</span><span class="val">${client.name}</span></div>
          <div class="row"><span class="label">Pekerjaan</span><span class="val">${client.job}</span></div>
          <div class="row"><span class="label">Domisili</span><span class="val">${client.city}</span></div>
          <div class="row"><span class="label">Tanggal Lahir</span><span class="val">${client.dob}</span></div>
          <div class="row highlight">
            <span class="label" style="color: var(--primary);">Jumlah Tanggungan</span>
            <span class="val" style="color: var(--primary);">${input.dependents} Orang</span>
          </div>
        </div>
      </section>

      <!-- Consultant Profile -->
      <section>
        <div class="section-title">02. Profil Konsultan</div>
        <div class="info-card">
          <div class="row"><span class="label">Nama Agen</span><span class="val">${agent.name}</span></div>
          <div class="row"><span class="label">Perusahaan</span><span class="val">${agent.companyName}</span></div>
          <div class="row"><span class="label">Level</span><span class="val">${agent.level}</span></div>
          <div class="row" style="margin-top: 22px;"><span class="label">Metode Analisa</span><span class="val">Income Replacement</span></div>
        </div>
      </section>
    </div>

    <!-- Parameters -->
    <section>
      <div class="section-title">03. Parameter & Asumsi Keuangan</div>
      <div class="info-card">
        <div class="grid-2">
            <div>
                <div class="row"><span class="label">Biaya Hidup Bulanan</span><span class="val">${input.monthlyExpense}</span></div>
                <div class="row"><span class="label">Sisa Hutang Berjalan</span><span class="val">${input.existingDebt}</span></div>
                <div class="row"><span class="label">Biaya Akhir Hayat</span><span class="val">${input.finalExpense}</span></div>
            </div>
            <div>
                <div class="row"><span class="label">UP Saat Ini (Existing)</span><span class="val">${input.existingCoverage}</span></div>
                <div class="row"><span class="label">Durasi Proteksi</span><span class="val">${input.protectionDuration} Tahun</span></div>
                <div class="row"><span class="label">Asumsi Inflasi / Return</span><span class="val">${input.inflationRate}% / ${input.returnRate}%</span></div>
            </div>
        </div>
      </div>
    </section>

    <!-- Calculations -->
    <section>
      <div class="section-title">04. Detail Kebutuhan Dana Pertanggungan</div>
      <div class="calc-container">
        <div class="calc-box">
          <div class="calc-title">Income Replacement</div>
          <div class="calc-desc">Dana pengganti biaya hidup keluarga agar standar hidup tetap terjaga selama durasi proteksi.</div>
          <div class="calc-amount">${result.incomeReplacement}</div>
        </div>

        <div class="calc-box">
          <div class="calc-title">Debt Clearance</div>
          <div class="calc-desc">Dana tunai untuk melunasi seluruh kewajiban hutang dan biaya akhir hayat seketika.</div>
          <div class="calc-amount">${result.debtClearance}</div>
        </div>

        <div class="calc-box total">
          <div class="calc-title">Total Kebutuhan UP</div>
          <div class="calc-desc">Total dana ideal yang harus tersedia jika risiko terjadi hari ini (Life Insurance).</div>
          <div class="calc-amount">${result.totalNeeded}</div>
        </div>
      </div>
    </section>

    <!-- Gap Analysis -->
    <section>
      <div class="section-title">05. Analisa Kekurangan (Gap Analysis)</div>
      <div class="gap-card">
        <div class="gap-header">
          <div>
            <div class="gap-amount-label">Status Proteksi Anda</div>
            <div class="status-badge">${statusText} (${coveragePercent}%)</div>
          </div>
          <div style="text-align: right;">
            <div class="gap-amount-label">Kekurangan Dana (Gap)</div>
            <div class="gap-value">${result.gap}</div>
          </div>
        </div>

        <div class="progress-wrapper">
          <div class="bar-container">
            <div class="bar-fill">${coveragePercent}% Terpenuhi</div>
          </div>
          <div class="bar-labels">
            <span>Rp 0</span>
            <span>Existing UP: ${input.existingCoverage}</span>
            <span>Kebutuhan Ideal: ${result.totalNeeded}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Strategic Recommendation -->
    <section>
      <div class="rec-box">
        <div class="rec-icon">ⓘ</div>
        <div class="rec-content">
          <div class="rec-title">Saran Strategis Konsultan</div>
          <div class="rec-text">${result.recommendation}</div>
        </div>
      </div>
    </section>

  </div>
</body>
</html>
  `;
};