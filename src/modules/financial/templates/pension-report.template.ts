import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper: Mengubah file gambar lokal menjadi Base64 string
 * untuk di-embed langsung ke dalam HTML PDF.
 */
function getImageBase64(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`[PDF Template] File not found: ${filePath}`);
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
    console.error(`[PDF Template] Error converting base64: ${error.message}`);
    return '';
  }
}

// Setup Path Aset
const ASSET_BASE_PATH = path.join(process.cwd(), 'src/assets/images');

// Load Assets sekali saja saat startup
const assets = {
  logoMaxiPro: getImageBase64(path.join(ASSET_BASE_PATH, 'logokeuanganku.png')),
  // Gunakan gambar spesifik pensiun
  headerImg1: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangdanaharitua1.webp')),
  headerImg2: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangdanaharitua2.webp'))
};

// HTML Template String
export const pensionReportTemplate = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Perencanaan Dana Pensiun</title>
  <style>
    /* -----------------------------------------------------------
       1. GLOBAL RESET & TYPOGRAPHY
       ----------------------------------------------------------- */
    :root {
      --primary: #4f46e5;      /* Indigo 600 */
      --primary-light: #818cf8; /* Indigo 400 */
      --primary-dark: #312e81;  /* Indigo 900 */
      --accent: #06b6d4;        /* Cyan 500 */
      --danger: #e11d48;        /* Rose 600 */
      --success: #059669;       /* Emerald 600 */
      --text-dark: #0f172a;     /* Slate 900 */
      --text-mute: #64748b;     /* Slate 500 */
      --border: #e2e8f0;        /* Slate 200 */
      --bg-soft: #f8fafc;       /* Slate 50 */
      
      --page-width: 210mm;
      --page-height: 297mm;
      --page-padding: 15mm;
    }

    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    
    body { 
      margin: 0; padding: 0; 
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
      color: var(--text-dark); 
      background-color: #525252; /* Background luar kertas */
    }

    .page {
      width: var(--page-width);
      min-height: var(--page-height);
      background: #ffffff;
      margin: 20px auto;
      padding: var(--page-padding);
      padding-bottom: 25mm; /* Space for footer */
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    @media print { 
      body { background: none; } 
      .page { margin: 0; box-shadow: none; page-break-after: always; height: auto; min-height: var(--page-height); border: none; } 
    }

    /* -----------------------------------------------------------
       2. HEADER SECTION (Grid 2x2 Professional)
       ----------------------------------------------------------- */
    .header-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 100px 60px;
      gap: 12px;
      margin-bottom: 35px;
    }
    
    /* Box Kiri Atas: Judul Utama */
    .h-title-box {
      background-color: var(--primary);
      color: white;
      padding: 20px 30px;
      border-top-left-radius: 24px;
      border-bottom-right-radius: 24px; /* Unik style */
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    
    /* Aksen Dekoratif di Title Box */
    .h-title-box::after {
      content: ''; position: absolute; right: -20px; bottom: -20px;
      width: 80px; height: 80px; border-radius: 50%;
      background: rgba(255,255,255,0.1);
    }

    .sub-heading { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.9; margin-bottom: 6px; font-weight: 600; }
    .main-heading { font-size: 28px; font-weight: 800; margin: 0; line-height: 1.1; letter-spacing: -0.5px; }

    /* Box Kanan Atas: Foto 1 */
    .h-image-top {
      background-image: url('${assets.headerImg1}');
      background-size: cover; background-position: center;
      border-top-right-radius: 24px;
      background-color: var(--text-dark);
      border-bottom-left-radius: 24px;
    }

    /* Box Kiri Bawah: Foto 2 / Brand Bar */
    .h-image-bottom {
      background-image: url('${assets.headerImg2}');
      background-size: cover; background-position: center;
      border-bottom-left-radius: 24px;
      border-top-right-radius: 24px;
      background-color: var(--text-mute);
    }

    /* Box Kanan Bawah: Logo */
    .h-logo-box {
      background-color: white;
      border: 1px solid var(--border);
      border-bottom-right-radius: 24px;
      border-top-left-radius: 24px;
      display: flex; align-items: center; justify-content: center;
      padding: 8px;
    }
    .logo-img { height: 45px; width: auto; object-fit: contain; }

    /* -----------------------------------------------------------
       3. CONTENT UTILS
       ----------------------------------------------------------- */
    .section-title {
      font-size: 11px; font-weight: 800; color: var(--text-mute);
      text-transform: uppercase; letter-spacing: 1.5px;
      border-bottom: 2px solid var(--border);
      padding-bottom: 8px; margin-bottom: 20px; margin-top: 30px;
      display: flex; justify-content: space-between;
    }
    
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    .card { background: var(--bg-soft); border-radius: 16px; padding: 20px; border: 1px solid var(--border); }
    .flex-between { display: flex; justify-content: space-between; align-items: center; }

    /* Meta List Style */
    .meta-list { list-style: none; padding: 0; margin: 0; font-size: 11px; }
    .meta-list li { 
      display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px;
    }
    .meta-list li:last-child { border-bottom: none; margin-bottom: 0; }
    .meta-key { color: var(--text-mute); }
    .meta-val { font-weight: 700; color: var(--text-dark); }

    /* -----------------------------------------------------------
       4. FUTURE REALITY CHECK (Shock Therapy)
       ----------------------------------------------------------- */
    .reality-box {
      display: grid; grid-template-columns: 1fr 40px 1fr; gap: 10px; align-items: center;
      margin-bottom: 20px;
    }
    .reality-card {
      text-align: center; padding: 15px; border-radius: 12px; border: 1px solid var(--border);
    }
    .reality-card.current { background: #ecfeff; border-color: #cffafe; } /* Cyan tint */
    .reality-card.future { background: #fff1f2; border-color: #pecdd3; } /* Rose tint */
    
    .reality-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: var(--text-mute); margin-bottom: 6px; }
    .reality-val { font-size: 16px; font-weight: 800; font-family: 'Courier New', monospace; }
    .reality-arrow { text-align: center; font-size: 24px; color: var(--text-mute); }

    /* -----------------------------------------------------------
       5. TIMELINE VISUALIZATION
       ----------------------------------------------------------- */
    .timeline-container { margin: 20px 0; }
    .section-prevent-split {
        page-break-inside: avoid;
        break-inside: avoid;
        display: block;
        width: 100%;
    }
    .timeline-bar {
        height: 28px; /* Sedikit lebih tebal agar rapi */
        background: #f1f5f9; 
        border-radius: 14px; 
        overflow: hidden; /* Kunci utama agar warna di dalam tidak keluar jalur radius */
        display: flex;
        border: 1px solid var(--border); /* Memberi bingkai agar ujung terlihat solid */
    }
    /* width diinject via inline style */
    .time-segment-work { background: var(--success); display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; font-weight: 700; }
    .time-segment-retire { background: var(--primary); display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; font-weight: 700; }
    
    .timeline-legend {
      display: flex; justify-content: space-between; font-size: 10px; color: var(--text-mute); margin-top: 6px; font-weight: 600;
    }

    /* -----------------------------------------------------------
       6. SOLUTION CARD (The Hero)
       ----------------------------------------------------------- */
    .solution-wrapper {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      border-radius: 20px; padding: 30px; text-align: center; color: white;
      box-shadow: 0 20px 25px -5px rgba(79, 70, 229, 0.3);
      position: relative; overflow: hidden; margin-top: 10px;
    }
    /* Pattern overlay */
    .solution-wrapper::before {
      content: ''; position: absolute; top:0; left:0; right:0; bottom:0;
      background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0);
      background-size: 20px 20px; pointer-events: none;
    }

    .sol-label { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 12px; font-weight: 600; }
    .sol-amount { font-size: 32px; font-weight: 800; font-family: 'Courier New', monospace; margin-bottom: 8px; line-height: 1; }
    .sol-period { font-size: 11px; opacity: 0.8; font-style: italic; }

    /* Gap Analysis Table */
    .gap-table { width: 100%; font-size: 11px; border-collapse: collapse; }
    .gap-table td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .gap-table tr:last-child td { border-bottom: none; font-weight: 800; padding-top: 12px; font-size: 12px; }
    .text-danger { color: var(--danger); }
    .text-success { color: var(--success); }

    /* Footer */
    .page-footer {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 15mm; padding: 0 15mm;
      border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      font-size: 9px; color: var(--text-mute); background: white;
    }
  </style>
</head>
<body>

  <div class="page">
    
    <div class="header-grid">
      <div class="h-title-box">
        <div class="sub-heading">Keuanganku Financial Conversation Tools</div>
        <h1 class="main-heading">Perencanaan<br>Dana Pensiun</h1>
      </div>
      <div class="h-image-top"></div>
      <div class="h-image-bottom"></div>
      <div class="h-logo-box">
        <img src="\${assets.logoMaxiPro}" class="logo-img" alt="Logo">
      </div>
    </div>

    <div class="section-title">
      <span>01. Profil Klien</span>
      <span>Dibuat: {{createdAt}}</span>
    </div>

    <div class="grid-2" style="margin-bottom: 25px;">
      <div class="card">
        <div style="font-size:10px; text-transform:uppercase; color:var(--primary); font-weight:700; margin-bottom:12px;">Identitas Diri</div>
        <ul class="meta-list">
          <li><span class="meta-key">Nama Lengkap</span> <span class="meta-val">{{user.name}}</span></li>
          <li><span class="meta-key">Usia Saat Ini</span> <span class="meta-val">{{plan.currentAge}} Tahun</span></li>
          <li><span class="meta-key">Kota Domisili</span> <span class="meta-val">{{user.city}}</span></li>
          <li><span class="meta-key">Pekerjaan</span> <span class="meta-val">{{user.job}}</span></li>
        </ul>
      </div>
      <div class="card">
        <div style="font-size:10px; text-transform:uppercase; color:var(--primary); font-weight:700; margin-bottom:12px;">Parameter Ekonomi</div>
        <ul class="meta-list">
          <li><span class="meta-key">Asumsi Inflasi</span> <span class="meta-val">{{plan.inflationRate}}% / tahun</span></li>
          <li><span class="meta-key">Target Return Investasi</span> <span class="meta-val" style="color:var(--success);">{{plan.returnRate}}% / tahun</span></li>
          <li><span class="meta-key">Usia Pensiun</span> <span class="meta-val">{{plan.retirementAge}} Tahun</span></li>
          <li><span class="meta-key">Harapan Hidup</span> <span class="meta-val">{{plan.lifeExpectancy}} Tahun</span></li>
        </ul>
      </div>
    </div>

    <div class="section-title">02. Inflasi & Realita Biaya Hidup</div>
    
    <p style="font-size:11px; color:var(--text-mute); margin-bottom:15px; line-height:1.4;">
      Simulasi kenaikan biaya hidup akibat inflasi {{plan.inflationRate}}% per tahun hingga usia pensiun ({{calc.yearsToRetire}} tahun lagi).
    </p>

    <div class="reality-box">
      <div class="reality-card current">
        <div class="reality-label">Biaya Hidup Hari Ini</div>
        <div class="reality-val" style="color:#0891b2;">{{plan.currentExpense}}</div>
        <div style="font-size:9px; margin-top:4px; opacity:0.7;">Per Bulan</div>
      </div>
      <div class="reality-arrow">→</div>
      <div class="reality-card future">
        <div class="reality-label">Biaya Saat Pensiun</div>
        <div class="reality-val text-danger">{{calc.futureMonthlyExpense}}</div>
        <div style="font-size:9px; margin-top:4px; opacity:0.7;">Per Bulan (Future Value)</div>
      </div>
    </div>

    <div class="section-prevent-split">
      <div class="section-title">03. Garis Waktu Perencanaan</div>
      <div class="timeline-container">
        <div class="timeline-bar">
          <div class="time-segment-work" style="width: {{calc.workingPercentage}}%;">
            Masa Menabung ({{calc.yearsToRetire}} Thn)
          </div>
          <div class="time-segment-retire" style="width: {{calc.retirementPercentage}}%;">
            Masa Pensiun ({{calc.retirementDuration}} Thn)
          </div>
        </div>
        <div class="timeline-legend">
          <span>Start: {{plan.currentAge}} Thn</span>
          <span style="text-align:center;">Pensiun: {{plan.retirementAge}} Thn</span>
          <span>Akhir: {{plan.lifeExpectancy}} Thn</span>
        </div>
      </div>
    </div>

    <div class="section-prevent-split" style="margin-top: 20px;">
    <div class="grid-2">
      <div>
        <div class="section-title" style="margin-top:10px;">04. Analisa Kekurangan</div>
        <div class="card" style="background:white;">
          <table class="gap-table">
            <tr>
              <td>Total Dana Dibutuhkan</td>
              <td class="text-right">{{calc.totalFundNeeded}}</td>
            </tr>
            <tr>
              <td>Aset Pensiun Saat Ini (FV)</td>
              <td class="text-right text-success">- {{calc.fvExistingFund}}</td>
            </tr>
            <tr>
              <td class="text-danger">KEKURANGAN (SHORTFALL)</td>
              <td class="text-right text-danger">{{calc.shortfall}}</td>
            </tr>
          </table>
          <p style="font-size:10px; color:var(--text-mute); margin-top:10px; line-height:1.4;">
            *Angka "Total Dana" adalah jumlah uang tunai yang harus tersedia di hari pertama pensiun untuk mendanai gaya hidup selama {{calc.retirementDuration}} tahun.
          </p>
        </div>
      </div>

      <div>
        <div class="section-title" style="margin-top:10px;">05. Solusi Investasi</div>
        <div class="solution-wrapper">
          <div style="position:relative; z-index:1;">
            <div class="sol-label">Rekomendasi Tabungan Bulanan</div>
            <div class="sol-amount">{{plan.monthlySaving}}</div>
            <div class="sol-period">Mulai bulan ini hingga usia {{plan.retirementAge}} tahun</div>
            <div style="margin-top:15px; font-size:10px; background:rgba(255,255,255,0.2); display:inline-block; padding:4px 12px; border-radius:12px;">
              Investasi di instrumen return {{plan.returnRate}}%
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>

    <div class="page-footer">
      <div>
        <strong>MAXIPRO Financial Planning System</strong><br>
        Generated by Agent: {{user.agentName}}
      </div>
      <div style="text-align:right;">
        CONFIDENTIAL DOCUMENT<br>
        Halaman 1 dari 1
      </div>
    </div>

  </div>

</body>
</html>
`;