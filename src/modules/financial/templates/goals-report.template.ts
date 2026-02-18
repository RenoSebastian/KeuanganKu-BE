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

// Load Assets
const assets = {
  logoMaxiPro: getImageBase64(path.join(ASSET_BASE_PATH, 'logokeuanganku.png')),
  // Gambar Header khusus Goals
  headerImg1: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangtujuanlainnya1.webp')),
  headerImg2: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangtujuanlainnya2.webp'))
};

export const goalReportTemplate = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Tujuan Keuangan</title>
  <style>
    /* -----------------------------------------------------------
       1. GLOBAL RESET & TYPOGRAPHY
       ----------------------------------------------------------- */
    :root {
      --primary: #7c3aed;      /* Violet 600 */
      --primary-light: #a78bfa; /* Violet 400 */
      --primary-dark: #5b21b6;  /* Violet 900 */
      --accent: #f59e0b;        /* Amber 500 */
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
      background-color: #525252;
    }

    .page {
      width: var(--page-width);
      min-height: var(--page-height);
      background: #ffffff;
      margin: 20px auto;
      padding: var(--page-padding);
      padding-bottom: 25mm;
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
    
    .h-title-box {
      background-color: var(--primary);
      color: white;
      padding: 20px 30px;
      border-top-left-radius: 24px;
      border-bottom-right-radius: 24px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    
    .h-title-box::after {
      content: ''; position: absolute; right: -20px; bottom: -20px;
      width: 80px; height: 80px; border-radius: 50%;
      background: rgba(255,255,255,0.1);
    }

    .sub-heading { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.9; margin-bottom: 6px; font-weight: 600; }
    .main-heading { font-size: 28px; font-weight: 800; margin: 0; line-height: 1.1; letter-spacing: -0.5px; }

    .h-image-top {
      background-image: url('${assets.headerImg1}');
      background-size: cover; background-position: center;
      border-top-right-radius: 24px;
      background-color: var(--text-dark);
      border-bottom-left-radius: 24px;
    }

    .h-image-bottom {
      background-image: url('${assets.headerImg2}');
      background-size: cover; background-position: center;
      border-bottom-left-radius: 24px;
      border-top-right-radius: 24px;
      background-color: var(--text-mute);
    }

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
    
    /* Meta List Style */
    .meta-list { list-style: none; padding: 0; margin: 0; font-size: 11px; }
    .meta-list li { 
      display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px;
    }
    .meta-list li:last-child { border-bottom: none; margin-bottom: 0; }
    .meta-key { color: var(--text-mute); }
    .meta-val { font-weight: 700; color: var(--text-dark); }

    /* -----------------------------------------------------------
       4. REALITY CHECK (INFLATION VISUAL)
       ----------------------------------------------------------- */
    .reality-box {
      display: grid; grid-template-columns: 1fr 40px 1fr; gap: 10px; align-items: center;
      margin-bottom: 20px;
    }
    .reality-card {
      text-align: center; padding: 15px; border-radius: 12px; border: 1px solid var(--border);
    }
    .reality-card.current { background: white; border-color: var(--border); } 
    .reality-card.future { background: #fff1f2; border-color: #fecdd3; } /* Rose tint */
    
    .reality-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: var(--text-mute); margin-bottom: 6px; }
    .reality-val { font-size: 16px; font-weight: 800; font-family: 'Courier New', monospace; }
    .reality-arrow { text-align: center; font-size: 24px; color: var(--text-mute); }
    
    .inflation-badge {
      font-size: 9px; color: var(--danger); font-weight: 700; background: rgba(225, 29, 72, 0.1);
      padding: 2px 8px; border-radius: 10px; display: inline-block; margin-top: 4px;
    }

    /* -----------------------------------------------------------
       5. STRATEGY (GAP ANALYSIS)
       ----------------------------------------------------------- */
    .strategy-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
    .strategy-table td { padding: 10px 0; border-bottom: 1px solid var(--border); }
    .strategy-table tr:last-child td { border-bottom: none; font-weight: 800; padding-top: 15px; font-size: 13px; }
    
    .gap-bar-container { margin-top: 5px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
    .gap-bar-fill { height: 100%; border-radius: 3px; }

    /* -----------------------------------------------------------
       6. SOLUTION CARD (HERO)
       ----------------------------------------------------------- */
    .solution-wrapper {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      border-radius: 20px; padding: 30px; text-align: center; color: white;
      box-shadow: 0 20px 25px -5px rgba(124, 58, 237, 0.3);
      position: relative; overflow: hidden; margin-top: 10px;
    }
    .solution-wrapper::before {
      content: ''; position: absolute; top: -50px; right: -50px; width: 150px; height: 150px;
      background: rgba(255,255,255,0.1); border-radius: 50%;
    }

    .sol-label { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 12px; font-weight: 600; }
    .sol-amount { font-size: 36px; font-weight: 800; font-family: 'Courier New', monospace; margin-bottom: 8px; line-height: 1; }
    .sol-period { font-size: 11px; opacity: 0.8; font-style: italic; }

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
        <h1 class="main-heading">Perencanaan<br>Tujuan Keuangan</h1>
      </div>
      <div class="h-image-top"></div>
      <div class="h-image-bottom"></div>
      <div class="h-logo-box">
        <img src="\${assets.logoMaxiPro}" class="logo-img" alt="Logo">
      </div>
    </div>

    <div class="section-title">
      <span>01. Profil & Target</span>
      <span>Dibuat: {{generatedAt}}</span>
    </div>

    <div class="grid-2" style="margin-bottom: 25px;">
      <div class="card">
        <div style="font-size:10px; text-transform:uppercase; color:var(--primary); font-weight:700; margin-bottom:12px;">Informasi Klien</div>
        <ul class="meta-list">
          <li><span class="meta-key">Nama Lengkap</span> <span class="meta-val">{{client.name}}</span></li>
          <li><span class="meta-key">Nama Tujuan</span> <span class="meta-val" style="color:var(--primary);">{{goal.name}}</span></li>
          <li><span class="meta-key">Kota Domisili</span> <span class="meta-val">{{client.city}}</span></li>
          <li><span class="meta-key">Target Waktu</span> <span class="meta-val">{{goal.targetDate}}</span></li>
        </ul>
      </div>
      <div class="card">
        <div style="font-size:10px; text-transform:uppercase; color:var(--primary); font-weight:700; margin-bottom:12px;">Asumsi Ekonomi</div>
        <ul class="meta-list">
          <li><span class="meta-key">Durasi Investasi</span> <span class="meta-val">{{calc.yearsDuration}} Tahun ({{calc.monthsDuration}} Bln)</span></li>
          <li><span class="meta-key">Asumsi Inflasi</span> <span class="meta-val">{{goal.inflationRate}}% / tahun</span></li>
          <li><span class="meta-key">Return Investasi</span> <span class="meta-val" style="color:var(--success);">{{goal.returnRate}}% / tahun</span></li>
          <li><span class="meta-key">Modal Awal</span> <span class="meta-val">{{goal.currentSaving}}</span></li>
        </ul>
      </div>
    </div>

    <div class="section-title">02. Inflasi & Nilai Masa Depan</div>
    
    <p style="font-size:11px; color:var(--text-mute); margin-bottom:15px; line-height:1.4;">
      Simulasi kenaikan harga barang/jasa akibat inflasi selama {{calc.yearsDuration}} tahun ke depan.
    </p>

    <div class="reality-box">
      <div class="reality-card current">
        <div class="reality-label">Harga Hari Ini (PV)</div>
        <div class="reality-val">{{goal.targetAmount}}</div>
      </div>
      <div class="reality-arrow">→</div>
      <div class="reality-card future">
        <div class="reality-label">Harga Nanti (FV)</div>
        <div class="reality-val text-danger" style="color:var(--danger);">{{calc.futureTargetAmount}}</div>
        <div class="inflation-badge">Kenaikan Inflasi</div>
      </div>
    </div>

    <div class="grid-2">
      <div>
        <div class="section-title" style="margin-top:10px;">03. Analisa Kekurangan</div>
        <div class="card" style="background:white; padding-top:5px;">
          <table class="strategy-table">
            <tr>
              <td>
                Target Dana (Future Value)
                <div class="gap-bar-container"><div class="gap-bar-fill" style="width:100%; background:var(--danger);"></div></div>
              </td>
              <td class="text-right">{{calc.futureTargetAmount}}</td>
            </tr>
            <tr>
              <td>
                Akumulasi Modal Awal
                <div style="font-size:9px; color:var(--text-mute);">(Tumbuh {{goal.returnRate}}%/thn)</div>
                <div class="gap-bar-container"><div class="gap-bar-fill" style="width:{{calc.existingPercentage}}%; background:var(--success);"></div></div>
              </td>
              <td class="text-right" style="color:var(--success);"> - {{calc.futureExistingFund}}</td>
            </tr>
            <tr>
              <td style="color:var(--primary); padding-top:15px;">TOTAL DANA YANG HARUS DIKUMPULKAN</td>
              <td class="text-right" style="color:var(--primary);">{{calc.netTarget}}</td>
            </tr>
          </table>
        </div>
      </div>

      <div>
        <div class="section-title" style="margin-top:10px;">04. Solusi Investasi</div>
        <div class="solution-wrapper">
          <div style="position:relative; z-index:1;">
            <div class="sol-label">Tabungan Rutin Per Bulan</div>
            <div class="sol-amount">{{calc.monthlySaving}}</div>
            <div class="sol-period">
              Mulai bulan ini hingga {{goal.targetDate}}<br>
              (Selama {{calc.monthsDuration}} Bulan)
            </div>
            <div style="margin-top:20px; font-size:10px; background:rgba(255,255,255,0.2); display:inline-block; padding:4px 12px; border-radius:12px;">
              Investasi di instrumen return {{goal.returnRate}}%
            </div>
          </div>
        </div>
        
        <div style="margin-top:15px; font-size:10px; color:var(--text-mute); line-height:1.4; text-align:justify;">
          *Perhitungan ini menggunakan metode bunga majemuk (compound interest). Hasil investasi masa lalu tidak menjamin kinerja masa depan. Disarankan melakukan review berkala setiap tahun.
        </div>
      </div>
    </div>

    <div class="page-footer">
      <div>
        <strong>MAXIPRO Financial Planning System</strong><br>
        Generated by Agent: {{agent.name}}
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