import * as fs from 'fs';
import * as path from 'path';

function getImageBase64(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`[PDF] File not found: ${filePath}`);
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
    console.error(`[PDF] Error base64: ${error.message}`);
    return '';
  }
}

const ASSET_BASE_PATH = path.join(process.cwd(), 'src/assets/images');
const assets = {
  logoMaxiPro: getImageBase64(path.join(ASSET_BASE_PATH, 'maxipro.webp')),
  headerImg1: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangdanaharitua1.webp')),
  headerImg2: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangdanaharitua2.webp'))
};

export const pensionReportTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pension Plan Report</title>
  <style>
    /* [OPTIMISASI] Hapus font eksternal */
    /* @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans...'); */
    
    :root {
      --white: #ffffff;
      --primary: #0e7490;      /* Cyan 700 */
      --primary-dark: #155e75; /* Cyan 800 */
      --secondary: #64748b;    /* Slate 500 */
      --dark: #0f172a;         /* Slate 900 */
      --border: #e2e8f0;       /* Slate 200 */
      --bg-soft: #f8fafc;
      --accent: #8b5cf6;       /* Violet 500 - Pembeda visual modul Pensiun */
      --page-width: 210mm;
      --page-height: 297mm;
      --page-padding: 15mm;
    }

    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    
    body { 
      margin: 0; padding: 0; 
      /* [OPTIMISASI] Gunakan system font */
      font-family: Helvetica, Arial, sans-serif; 
      color: var(--dark); 
      background-color: #525252; 
    }

    .page {
      width: var(--page-width); min-height: var(--page-height);
      background: #ffffff; margin: 20px auto; padding: var(--page-padding); padding-bottom: 25mm;
      position: relative; overflow: hidden; display: flex; flex-direction: column;
    }

    @media print { body { background: none; } .page { margin: 0; box-shadow: none; page-break-after: always; height: auto; min-height: var(--page-height); } }

    /* --- LAYOUT UTILS --- */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .flex { display: flex; } .justify-between { justify-content: space-between; } .items-center { align-items: center; }
    .text-right { text-align: right; } .font-bold { font-weight: 700; }
    .text-secondary { color: var(--secondary); } .text-primary { color: var(--primary); }

    /* --- HEADER GRID 2x2 --- */
    .header-grid {
      display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: 110px 70px; gap: 8px; margin-bottom: 30px;
    }
    .h-title-box {
      background-color: var(--primary); color: white; padding: 20px 30px;
      border-top-left-radius: 20px; display: flex; flex-direction: column; justify-content: center;
    }
    .h-image-right-top {
      background-image: url('${assets.headerImg1}'); background-size: cover; background-position: center;
      border-top-right-radius: 20px; background-color: var(--dark);
    }
    .h-image-left-bottom {
      background-image: url('${assets.headerImg2}'); background-size: cover; background-position: center;
      border-bottom-left-radius: 20px; background-color: var(--secondary);
    }
    .h-brand-box {
        background-color: var(--white);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        border-bottom-right-radius: 20px;
        padding: 10px;
    }
   
    .logo-maxipro { 
      height: 88px; 
      width: auto; 
      display: block;
    }

    .brand-text { font-weight: 800; letter-spacing: 2px; font-size: 12px; text-transform: uppercase; }
    .main-heading { 
      font-family: 'Times New Roman', serif; 
      font-size: 32px; line-height: 1; margin: 0; 
    }
    .sub-heading { text-transform: uppercase; font-size: 10px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 4px; }

    /* --- SECTION TITLE --- */
    .section-title {
      font-size: 12px; font-weight: 800; color: var(--secondary);
      text-transform: uppercase; letter-spacing: 1px;
      border-bottom: 2px solid var(--border); padding-bottom: 6px; margin-bottom: 16px; margin-top: 24px;
    }
    .section-title:first-child { margin-top: 0; }

    /* --- PROFILE METADATA --- */
    .profile-card {
      background: var(--bg-soft); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px; margin-bottom: 10px;
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
    .meta-row:last-child { margin-bottom: 0; }
    .meta-label { color: var(--secondary); font-weight: 500; }
    .meta-val { color: var(--dark); font-weight: 700; }

    /* --- STATS BOXES --- */
    .stat-box {
      border: 1px solid var(--border); border-radius: 12px; padding: 16px;
      background: white; text-align: center;
    }
    .stat-label { font-size: 10px; text-transform: uppercase; color: var(--secondary); font-weight: 700; margin-bottom: 8px; }
    .stat-val { font-size: 18px; font-weight: 800; color: var(--primary); font-family: monospace; }
    .stat-val-small { font-size: 14px; font-weight: 700; color: var(--dark); }

    /* --- PROJECTION TABLE --- */
    .proj-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
    .proj-table td { padding: 10px 0; border-bottom: 1px dashed var(--border); }
    .proj-table td:last-child { text-align: right; font-weight: 700; font-family: monospace; color: var(--dark); }
    .proj-table tr:last-child td { border-bottom: none; }
    .highlight-row { background-color: #f0f9ff; padding: 10px; border-radius: 8px; font-weight: 700; }

    /* --- RESULT CARD --- */
    .result-card {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); /* Indigo theme */
      color: white; padding: 20px; border-radius: 16px; text-align: center;
      margin-top: 10px; margin-bottom: 10px;
      box-shadow: 0 10px 20px -5px rgba(49, 46, 129, 0.3);
    }
    .result-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-bottom: 10px; }
    .result-amount { font-size: 24px; font-weight: 600; line-height: 1; margin-bottom: 4px; font-family: monospace; }
    .result-desc { font-size: 11px; opacity: 0.9; max-width: 60%; margin: 0 auto; line-height: 1; }

    /* --- FOOTER --- */
    .page-footer {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 15mm; padding: 0 15mm;
      border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      font-size: 9px; color: var(--secondary); background: white;
    }
  </style>
</head>
<body>

  <div class="page">
    
    <div class="header-grid">
      <div class="h-title-box">
        <div class="sub-heading">PamJaya Financial</div>
        <h1 class="main-heading">Pension Plan</h1>
      </div>
      <div class="h-image-right-top"></div>
      <div class="h-image-left-bottom"></div>
      <div class="h-brand-box">
        <img src="${assets.logoMaxiPro}" class="logo-maxipro" alt="Logo">
      </div>
    </div>

    <div class="section-title">01. Profil & Asumsi Dasar</div>
    <div class="profile-card">
      <div>
        <div class="meta-row"><span class="meta-label">Nama Pemohon</span> <span class="meta-val">{{user.name}}</span></div>
        <div class="meta-row"><span class="meta-label">Usia Saat Ini</span> <span class="meta-val">{{plan.currentAge}} Tahun</span></div>
        <div class="meta-row"><span class="meta-label">Usia Pensiun</span> <span class="meta-val">{{plan.retirementAge}} Tahun</span></div>
        <div class="meta-row"><span class="meta-label">Harapan Hidup</span> <span class="meta-val">Hingga {{plan.lifeExpectancy}} Tahun</span></div>
      </div>
      <div>
        <div class="meta-row"><span class="meta-label">Tanggal Rencana</span> <span class="meta-val">{{createdAt}}</span></div>
        <div class="meta-row"><span class="meta-label">Inflasi Tahunan</span> <span class="meta-val">{{plan.inflationRate}}%</span></div>
        <div class="meta-row"><span class="meta-label">Estimasi Return Investasi</span> <span class="meta-val">{{plan.returnRate}}% / thn</span></div>
        <div class="meta-row"><span class="meta-label">Masa Pensiun</span> <span class="meta-val">{{calc.retirementDuration}} Tahun</span></div>
      </div>
    </div>

    <div class="section-title">02. Kondisi Finansial Saat Ini</div>
    <div class="grid-2 mb-6">
      <div class="stat-box">
        <div class="stat-label">Pengeluaran Bulanan</div>
        <div class="stat-val text-dark">{{plan.currentExpense}}</div>
        <div style="font-size:9px; color:var(--secondary); margin-top:4px;">Gaya hidup saat ini</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Tabungan Tersedia</div>
        <div class="stat-val" style="color:#059669;">{{plan.currentSaving}}</div>
        <div style="font-size:9px; color:var(--secondary); margin-top:4px;">Modal awal investasi</div>
      </div>
    </div>

    <div class="section-title">03. Proyeksi Masa Depan ({{calc.yearsToRetire}} Tahun Lagi)</div>
    <div class="grid-2 mb-6">
      <div class="stat-box" style="text-align:left;">
        <div class="stat-label">Analisa Kebutuhan Dana</div>
        <table class="proj-table">
          <tr>
            <td>Biaya Hidup Nanti (FV)</td>
            <td>{{calc.futureMonthlyExpense}} <span style="font-size:9px; font-weight:400; color:var(--secondary);">/bln</span></td>
          </tr>
          <tr>
            <td>Durasi Pensiun</td>
            <td>{{calc.retirementDuration}} Tahun</td>
          </tr>
          <tr>
            <td style="font-weight:700; color:var(--primary);">TOTAL DANA DIBUTUHKAN</td>
            <td style="font-weight:800; color:var(--primary); font-size:13px;">{{calc.totalFundNeeded}}</td>
          </tr>
        </table>
      </div>

      <div class="stat-box" style="text-align:left;">
        <div class="stat-label">Analisa Kekurangan (Gap)</div>
        <table class="proj-table">
          <tr>
            <td>Target Dana</td>
            <td>{{calc.totalFundNeeded}}</td>
          </tr>
          <tr>
            <td>Nilai Aset Saat Ini (FV)</td>
            <td style="color:#059669;">- {{calc.fvExistingFund}}</td>
          </tr>
          <tr>
            <td style="font-weight:700; color:#b91c1c;">KEKURANGAN DANA (Shortfall)</td>
            <td style="font-weight:800; color:#b91c1c; font-size:13px;">{{calc.shortfall}}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="section-title">04. Rekomendasi Investasi</div>
    <div class="result-card">
      <div class="result-label">Investasi Bulanan Yang Harus Disisihkan</div>
      <div class="result-amount">{{plan.monthlySaving}}</div>
      <div class="result-desc">
        Untuk mencapai target dana pensiun sebesar <strong>{{calc.totalFundNeeded}}</strong> dalam <strong>{{calc.yearsToRetire}} tahun</strong> ke depan, 
        dengan asumsi return investasi <strong>{{plan.returnRate}}%</strong> per tahun.
      </div>
    </div>

    <div class="page-footer">
      <div>Generated by KeuanganKu System</div>
      <div>CONFIDENTIAL • Pension Planning</div>
    </div>

  </div>
</body>
</html>
`;