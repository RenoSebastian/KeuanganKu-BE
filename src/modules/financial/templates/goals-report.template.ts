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
  headerImg1: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangtujuanlainnya1.webp')),
  headerImg2: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangtujuanlainnya2.webp'))
};

export const goalReportTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Financial Goal Report</title>
  <style>
    /* [OPTIMISASI] Hapus font eksternal */
    /* @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans...'); */
    
    :root {
      --white: #ffffff;
      --primary: #0e7490;      
      --secondary: #64748b;    
      --dark: #0f172a;         
      --border: #e2e8f0;       
      --bg-soft: #f8fafc;
      --accent: #7c3aed;       /* Violet 600 - Theme for Goals */
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
    .flex { display: flex; } .justify-between { justify-content: space-between; } .items-center { align-items: center; }
    .text-right { text-align: right; } .font-bold { font-weight: 700; }
    .text-secondary { color: var(--secondary); } 

    /* --- HEADER GRID 2x2 --- */
    .header-grid {
      display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: 110px 70px; gap: 8px; margin-bottom: 30px;
    }
    .h-title-box {
      background-color: var(--accent); color: white; padding: 20px 30px;
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

    /* --- PROFILE CARD --- */
    .profile-card {
      background: var(--bg-soft); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px; margin-bottom: 24px;
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
    .meta-row label { color: var(--secondary); }
    .meta-row span { color: var(--dark); font-weight: 700; }

    /* --- GOAL VISUAL --- */
    .goal-visual {
      border: 1px solid var(--border); border-radius: 12px; padding: 20px;
      margin-bottom: 24px; background: white;
    }
    .gv-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; }
    .gv-label { font-size: 11px; font-weight: 700; color: var(--secondary); text-transform: uppercase; }
    .gv-val { font-family: monospace; font-size: 16px; font-weight: 800; color: var(--dark); }
    
    .bar-container { position: relative; height: 30px; background: #f1f5f9; border-radius: 6px; margin: 10px 0; overflow:hidden; }
    .bar-fill { height: 100%; background: linear-gradient(to right, #a78bfa, #7c3aed); border-radius: 6px; display:flex; align-items:center; justify-content:flex-end; padding-right:10px; color:white; font-size:10px; font-weight:700; }
    
    .inflation-badge {
      display: inline-block; padding: 4px 8px; border-radius: 4px; 
      background: #fff7ed; color: #c2410c; font-size: 9px; font-weight: 700; border: 1px solid #fed7aa;
    }

    /* --- CALCULATION DETAILS --- */
    .calc-box {
      background: white; border: 1px solid var(--border); border-radius: 12px; padding: 16px;
    }
    .calc-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 0; border-bottom: 1px dashed var(--border); font-size: 11px;
    }
    .calc-row:last-child { border-bottom: none; }
    .calc-val { font-weight: 700; color: var(--dark); }

    /* --- RESULT CARD --- */
    .result-card {
      background: linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%); /* Violet Theme */
      color: white; padding: 30px; border-radius: 16px; text-align: center;
      margin-top: 10px; margin-bottom: 30px;
      box-shadow: 0 10px 20px -5px rgba(109, 40, 217, 0.3);
    }
    .rb-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-bottom: 10px; }
    .rb-amount { font-size: 38px; font-weight: 800; margin-bottom: 12px; font-family: monospace; }
    .rb-desc { font-size: 11px; opacity: 0.95; line-height: 1.5; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; max-width: 80%; margin: 0 auto; }

    /* --- FOOTER --- */
    .page-footer {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 15mm; padding: 0 15mm;
      border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      font-size: 9px; color: var(--secondary); background: white;
    }
    .kosong{ margin-top: 30px; margin-bottom: 30px;}
  </style>
</head>
<body>

  <div class="page">
    
    <div class="header-grid">
      <div class="h-title-box">
        <div class="sub-heading">MAXIPRO Financial</div>
        <h1 class="main-heading">Financial Goals</h1>
      </div>
      <div class="h-image-right-top"></div>
      <div class="h-image-left-bottom"></div>
      <div class="h-brand-box">
        <img src="${assets.logoMaxiPro}" class="logo-maxipro" alt="Logo">
      </div>
    </div>

    <div class="section-title">01. Informasi Tujuan</div>
    <div class="profile-card">
      <div>
        <div class="meta-row"><label>Nama Klien</label> <span>{{user.name}}</span></div>
        <div class="meta-row"><label>Nama Tujuan</label> <span style="color:var(--accent);">{{goal.name}}</span></div>
        <div class="meta-row"><label>Tanggal Laporan</label> <span>{{createdAt}}</span></div>
      </div>
      <div>
        <div class="meta-row"><label>Jangka Waktu</label> <span>{{goal.years}} Tahun</span></div>
        <div class="meta-row"><label>Asumsi Inflasi</label> <span>{{goal.inflationRate}}%</span></div>
        <div class="meta-row"><label>Asumsi Return Investasi</label> <span>{{goal.returnRate}}%</span></div>
      </div>
    </div>

    <div class="section-title">02. Proyeksi Kenaikan Harga (Inflasi)</div>
    
    <div class="goal-visual">
      <div class="gv-row">
        <div>
          <div class="gv-label">Harga Barang Saat Ini</div>
          <div style="font-size:10px; color:var(--secondary);">Present Value (PV)</div>
        </div>
        <div class="gv-val">{{goal.currentCost}}</div>
      </div>

      <div class="bar-container">
        <div style="position:absolute; left:0; top:0; bottom:0; width:60%; background:#e2e8f0; border-right:2px dashed #94a3b8;"></div>
        <div style="position:absolute; left:60%; top:50%; transform:translate(-50%, -50%); color:#64748b; font-size:10px; font-weight:700; background:white; padding:2px 6px; border-radius:4px; border:1px solid #e2e8f0;">
          + {{goal.inflationEffect}} (Inflasi)
        </div>
      </div>

      <div class="gv-row">
        <div>
          <div class="gv-label" style="color:var(--accent);">Harga Masa Depan</div>
          <div style="font-size:10px; color:var(--secondary);">Future Value (FV) - {{goal.years}} Thn Lagi</div>
        </div>
        <div class="gv-val" style="color:var(--accent); font-size:20px;">{{calc.futureValue}}</div>
      </div>
    </div>

    <div class="section-title">03. Strategi Pencapaian</div>
    
    <div class="grid-2">
      <div class="calc-box">
        <div style="font-size:10px; font-weight:800; color:var(--secondary); text-transform:uppercase; margin-bottom:10px;">
          Parameter Hitungan
        </div>
        <div class="calc-row">
          <span>Target Dana (FV)</span> <span class="calc-val">{{calc.futureValue}}</span>
        </div>
        <div class="calc-row">
          <span>Tenor Investasi</span> <span class="calc-val">{{goal.years}} Tahun ({{calc.months}} Bulan)</span>
        </div>
        <div class="calc-row">
          <span>Rate Investasi</span> <span class="calc-val">{{goal.returnRate}}% p.a</span>
        </div>
      </div>

      <div class="calc-box" style="background:#f5f3ff; border-color:#ddd6fe;">
        <div style="font-size:10px; font-weight:800; color:#7c3aed; text-transform:uppercase; margin-bottom:10px;">
          Kekuatan Bunga Berbunga
        </div>
        <div style="font-size:11px; line-height:1.6; color:#5b21b6;">
          Dengan menyisihkan dana secara rutin dan disiplin, Anda memanfaatkan efek <strong>Compounding Interest</strong> untuk mengejar kenaikan harga akibat inflasi.
        </div>
      </div>
    </div>

    <div class="kosong"> </div>
    <div class="kosong"> </div>
    <div class="kosong"> </div>
    <div class="kosong"> </div>

    <div class="section-title">04. Rekomendasi Investasi</div>

    <div class="result-card">
      <div class="rb-label">Tabungan Rutin Per Bulan</div>
      <div class="rb-amount">{{calc.monthlySaving}}</div>
      <div class="rb-desc">
        Nominal ini harus disisihkan setiap bulan ke instrumen investasi dengan return rata-rata <strong>{{goal.returnRate}}%</strong> untuk mencapai target <strong>{{calc.futureValue}}</strong> dalam <strong>{{goal.years}} tahun</strong>.
      </div>
    </div>

    <div class="page-footer">
      <div>Generated by KeuanganKu System</div>
      <div>CONFIDENTIAL • Goal Planning</div>
    </div>

  </div>

</body>
</html>
`;