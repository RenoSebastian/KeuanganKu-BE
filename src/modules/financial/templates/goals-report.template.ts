import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper: Mengubah file gambar lokal menjadi Base64 string
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

const ASSET_BASE_PATH = path.join(process.cwd(), 'src/assets/images');

const assets = {
  logoMaxiPro: getImageBase64(path.join(ASSET_BASE_PATH, 'logokeuanganku.png')),
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
    :root {
      --primary: #6d28d9;      /* Violet 700 */
      --primary-dark: #4c1d95; /* Violet 900 */
      --primary-light: #ede9fe;/* Violet 50 */
      --accent: #f59e0b;       /* Amber 500 */
      --success: #10b981;      /* Emerald 500 */
      --danger: #ef4444;       /* Red 500 */
      --text-dark: #1e293b;    /* Slate 800 */
      --text-mute: #64748b;    /* Slate 500 */
      --border: #e2e8f0;       /* Slate 200 */
      --white: #ffffff;
    }

    @page { 
      size: A4; 
      margin: 0; 
    }
    
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; }
    
    body { 
      margin: 0; padding: 0; 
      font-family: 'Inter', -apple-system, sans-serif; 
      color: var(--text-dark); 
      background-color: #f1f5f9;
      line-height: 1.5;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      background: var(--white);
      margin: 0 auto;
      padding: 15mm;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    @media print { 
      body { background: none; } 
      .page { margin: 0; box-shadow: none; page-break-after: always; } 
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
      color: white;
      padding: 25px 35px;
      border-radius: 20px 4px 20px 4px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .sub-heading { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.9; margin-bottom: 6px; font-weight: 600; }
    .main-heading { font-size: 28px; font-weight: 800; margin: 0; line-height: 1.1; }

    .h-image-top {
      background: #1e293b url('${assets.headerImg1}') center/cover;
      border-radius: 4px 20px 4px 20px;
    }

    .h-image-bottom {
      background: #64748b url('${assets.headerImg2}') center/cover;
      border-radius: 4px 20px 4px 20px;
    }

    .h-logo-box {
      background: white;
      border: 1px solid var(--border);
      border-radius: 20px 4px 20px 4px;
      display: flex; align-items: center; justify-content: center;
      padding: 10px;
    }
    .logo-img { height: 45px; width: auto; object-fit: contain; }

    /* --- SECTION TITLES --- */
    .section-title {
      font-size: 11px; font-weight: 800; color: var(--secondary);
      text-transform: uppercase; letter-spacing: 1.5px;
      border-bottom: 2px solid var(--primary-light);
      padding-bottom: 6px; margin-bottom: 15px; margin-top: 25px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .section-title::before {
      content: ''; display: inline-block; width: 4px; height: 14px; background: var(--primary); margin-right: 8px; border-radius: 2px;
    }
    
    /* --- CARDS & GRIDS --- */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .card { background: #f8fafc; border-radius: 16px; padding: 20px; border: 1px solid var(--border); }
    
    .meta-list { list-style: none; padding: 0; margin: 0; }
    .meta-list li { 
      display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px dashed #e2e8f0;
    }
    .meta-list li:last-child { border-bottom: none; margin-bottom: 0; }
    .meta-key { color: var(--text-mute); font-size: 11px; }
    .meta-val { font-weight: 700; color: var(--text-dark); font-size: 11px; }

    /* --- INFLATION VISUAL (REALITY CHECK) --- */
    .reality-container {
      background: var(--white);
      border: 1.5px solid var(--border);
      border-radius: 20px;
      padding: 25px;
      display: flex;
      align-items: center;
      justify-content: space-around;
      margin-bottom: 20px;
    }
    .reality-item { text-align: center; flex: 1; }
    .reality-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: var(--text-mute); margin-bottom: 8px; }
    .reality-val { font-size: 18px; font-weight: 800; color: var(--text-dark); }
    .reality-arrow { font-size: 24px; color: var(--primary); padding: 0 20px; opacity: 0.5; }
    
    .future-highlight { color: var(--danger); }
    .inflation-badge {
      display: inline-block; background: #fff1f2; color: var(--danger);
      font-size: 9px; font-weight: 700; padding: 4px 10px; border-radius: 20px; margin-top: 8px;
    }

    /* --- STRATEGY TABLE --- */
    .strategy-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .strategy-table td { padding: 12px 0; border-bottom: 1px solid var(--border); }
    .strategy-table tr:last-child td { border-bottom: none; }
    
    .progress-bar-bg { height: 8px; background: #e2e8f0; border-radius: 10px; margin-top: 8px; overflow: hidden; }
    .progress-bar-fill { height: 100%; border-radius: 10px; }

    /* --- SOLUTION BOX (HERO) --- */
    .solution-hero {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      border-radius: 24px; padding: 30px; text-align: center; color: white;
      box-shadow: 0 15px 30px -10px rgba(109, 40, 217, 0.4);
      position: relative; overflow: hidden;
    }
    .solution-hero::before {
      content: 'SOLUSI'; position: absolute; top: -10px; left: -10px; font-size: 60px; font-weight: 900; opacity: 0.05;
    }

    .sol-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 15px; font-weight: 600; }
    .sol-amount { font-size: 32px; font-weight: 800; margin-bottom: 5px; font-family: 'Inter', sans-serif; letter-spacing: -1px; }
    .sol-period { font-size: 11px; opacity: 0.8; font-style: italic; }
    .sol-badge { 
      display: inline-block; background: rgba(255,255,255,0.2); 
      padding: 6px 15px; border-radius: 30px; font-size: 10px; margin-top: 20px; font-weight: 600;
    }

    /* --- FOOTER --- */
    .page-footer {
      margin-top: auto;
      padding-top: 15px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: var(--text-mute);
    }
  </style>
</head>
<body>

  <div class="page">
    
    <!-- Header -->
    <div class="header-grid">
      <div class="h-title-box">
        <div class="sub-heading">Financial Conversation Tools</div>
        <h1 class="main-heading">Perencanaan<br>Tujuan Keuangan</h1>
      </div>
      <div class="h-image-top"></div>
      <div class="h-image-bottom"></div>
      <div class="h-logo-box">
        <img src="${assets.logoMaxiPro}" class="logo-img" alt="Logo">
      </div>
    </div>

    <!-- Info Section -->
    <div class="section-title">
      <span>01. Profil Rencana & Target</span>
      <span style="font-weight: 500; font-size: 9px;">Tanggal: {{generatedAt}}</span>
    </div>

    <div class="grid-2">
      <div class="card">
        <div style="font-size:10px; font-weight:800; color:var(--primary); margin-bottom:12px; text-transform:uppercase;">Informasi Klien</div>
        <ul class="meta-list">
          <li><span class="meta-key">Nama Klien</span> <span class="meta-val">{{client.name}}</span></li>
          <li><span class="meta-key">Tujuan</span> <span class="meta-val" style="color:var(--primary);">{{goal.name}}</span></li>
          <li><span class="meta-key">Domisili</span> <span class="meta-val">{{client.city}}</span></li>
          <li><span class="meta-key">Target Pencapaian</span> <span class="meta-val">{{goal.targetDate}}</span></li>
        </ul>
      </div>
      <div class="card">
        <div style="font-size:10px; font-weight:800; color:var(--primary); margin-bottom:12px; text-transform:uppercase;">Parameter Ekonomi</div>
        <ul class="meta-list">
          <li><span class="meta-key">Durasi Investasi</span> <span class="meta-val">{{calc.yearsDuration}} Tahun ({{calc.monthsDuration}} Bln)</span></li>
          <li><span class="meta-key">Estimasi Inflasi</span> <span class="meta-val">{{goal.inflationRate}}% / Tahun</span></li>
          <li><span class="meta-key">Target Return</span> <span class="meta-val" style="color:var(--success);">{{goal.returnRate}}% / Tahun</span></li>
          <li><span class="meta-key">Modal Awal</span> <span class="meta-val">{{goal.currentSaving}}</span></li>
        </ul>
      </div>
    </div>

    <!-- Inflation Visual -->
    <div class="section-title">02. Analisa Nilai Masa Depan (FV)</div>
    <p style="font-size:10px; color:var(--text-mute); margin-top:-5px; margin-bottom:15px;">
      Mempertimbangkan kenaikan harga barang/jasa akibat inflasi selama periode target waktu.
    </p>

    <div class="reality-container">
      <div class="reality-item">
        <div class="reality-label">Harga Saat Ini (PV)</div>
        <div class="reality-val">{{goal.targetAmount}}</div>
      </div>
      <div class="reality-arrow">➜</div>
      <div class="reality-item">
        <div class="reality-label">Harga Masa Depan (FV)</div>
        <div class="reality-val future-highlight">{{calc.futureTargetAmount}}</div>
        <div class="inflation-badge">Kenaikan Akibat Inflasi</div>
      </div>
    </div>

    <!-- Gap & Solution -->
    <div class="grid-2" style="align-items: stretch;">
      <div>
        <div class="section-title">03. Analisa Kekurangan Dana</div>
        <div class="card" style="background:white;">
          <table class="strategy-table">
            <tr>
              <td>
                <span style="font-weight:600;">Total Dana Dibutuhkan</span>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:100%; background:var(--danger);"></div></div>
              </td>
              <td style="text-align:right; font-weight:700;">{{calc.futureTargetAmount}}</td>
            </tr>
            <tr>
              <td>
                <span style="font-weight:600;">Proyeksi Modal Awal</span>
                <div style="font-size:9px; color:var(--text-mute);">(Tumbuh {{goal.returnRate}}% / Thn)</div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:{{calc.existingPercentage}}%; background:var(--success);"></div></div>
              </td>
              <td style="text-align:right; font-weight:700; color:var(--success);">- {{calc.futureExistingFund}}</td>
            </tr>
            <tr>
              <td style="padding-top:20px; font-weight:800; color:var(--primary); font-size:12px;">KEKURANGAN (NET GAP)</td>
              <td style="text-align:right; padding-top:20px; font-weight:800; color:var(--primary); font-size:12px;">{{calc.netTarget}}</td>
            </tr>
          </table>
        </div>
      </div>

      <div>
        <div class="section-title">04. Strategi Investasi</div>
        <div class="solution-hero">
          <div class="sol-label">Tabungan Rutin / Bulan</div>
          <div class="sol-amount">{{calc.monthlySaving}}</div>
          <div class="sol-period">
            Mulai hari ini s/d {{goal.targetDate}}<br>
            ({{calc.monthsDuration}} Kali Setoran)
          </div>
          <div class="sol-badge">Investasi di Instrumen Return {{goal.returnRate}}%</div>
        </div>
        <p style="font-size:9px; color:var(--text-mute); margin-top:15px; line-height:1.4;">
          *Ilustrasi menggunakan metode bunga majemuk. Hasil investasi masa depan tidak dijamin. Lakukan evaluasi portofolio secara berkala.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="page-footer">
      <div>
        <strong>KeuanganKu Agent System</strong> &bull; Perencana: {{agent.name}}
      </div>
      <div>
        CONFIDENTIAL &bull; Halaman 1 dari 1
      </div>
    </div>

  </div>

</body>
</html>
`;