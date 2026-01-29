import * as fs from 'fs';
import * as path from 'path';

function getImageBase64(filePath: string): string {
    try {
        if (!fs.existsSync(filePath)) return '';
        const bitmap = fs.readFileSync(filePath);
        const extension = path.extname(filePath).replace('.', '');
        const mimeType = extension === 'svg' ? 'svg+xml' : extension;
        return `data:image/${mimeType};base64,${bitmap.toString('base64')}`;
    } catch (error) {
        return '';
    }
}

const ASSET_BASE_PATH = path.join(process.cwd(), 'src/assets/images');
const assets = {
    logoMaxiPro: getImageBase64(path.join(ASSET_BASE_PATH, 'maxipro.webp')),
    headerImg1: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangdanapendidikan1.webp')),
    headerImg2: getImageBase64(path.join(ASSET_BASE_PATH, 'rancangdanapendidikan2.webp'))
};

export const educationReportTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Education Plan Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;1,600&display=swap');
    
    :root {
      --primary: #0e7490;
      --primary-dark: #155e75;
      --secondary: #64748b;
      --dark: #0f172a;
      --border: #e2e8f0;
      --bg-soft: #f8fafc;
      --accent: #f59e0b; /* Amber 500 */
    }

    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    body {
      margin: 0; padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
      color: var(--dark);
      background-color: #fff;
    }

    @page {
      size: A4;
      margin: 15mm 15mm 25mm 15mm;
    }

    /* HEADER */
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
      background-color: var(--dark); color: white;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      border-bottom-right-radius: 20px;
    }
    .logo-maxipro { height: 24px; width: auto; filter: brightness(0) invert(1); }
    .brand-text { font-weight: 800; letter-spacing: 2px; font-size: 12px; text-transform: uppercase; }
    .main-heading { font-family: 'Playfair Display', serif; font-size: 32px; line-height: 1; margin: 0; }
    .sub-heading { text-transform: uppercase; font-size: 10px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 4px; }

    /* FOOTER */
    .page-footer {
      position: fixed; bottom: 0; left: 0; right: 0;
      height: 10mm; border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      font-size: 9px; color: var(--secondary); background: white; padding-top: 2mm;
    }

    /* --- CHILD CONTAINER --- */
    .child-section {
      margin-bottom: 40px;
      page-break-after: always; /* Ganti halaman tiap anak */
    }
    .child-section:last-child { page-break-after: auto; }

    .child-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      border-bottom: 3px solid var(--accent); padding-bottom: 12px; margin-bottom: 20px;
    }
    .child-name { font-size: 24px; font-weight: 800; color: var(--dark); text-transform: uppercase; line-height: 1; }
    .child-info { font-size: 11px; color: var(--secondary); margin-top: 4px; font-weight: 500; }
    
    .total-badge {
      text-align: right; background: var(--bg-soft); padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border);
    }
    .total-label { font-size: 9px; text-transform: uppercase; font-weight: 700; color: var(--secondary); }
    .total-value { font-size: 18px; font-weight: 800; color: var(--accent); font-family: monospace; }

    /* --- SUMMARY STATS --- */
    .stats-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px;
    }
    .stat-card {
      border: 1px solid var(--border); border-radius: 8px; padding: 12px;
      display: flex; align-items: center; gap: 10px;
    }
    .stat-val { font-weight: 700; color: var(--dark); font-size: 13px; }
    .stat-lbl { font-size: 9px; color: var(--secondary); text-transform: uppercase; margin-top: 2px; }

    /* --- LEVEL CARD (Grouping) --- */
    .level-card {
      border: 1px solid var(--border); border-radius: 12px; 
      margin-bottom: 20px; overflow: hidden;
      page-break-inside: avoid; /* Jangan potong card di tengah halaman */
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    
    .level-header {
      background: var(--dark); color: white;
      padding: 10px 15px; display: flex; justify-content: space-between; align-items: center;
    }
    .level-title { font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
    .level-summary { font-size: 10px; font-weight: 500; opacity: 0.9; }

    /* TABLE INSIDE CARD */
    .level-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .level-table th { 
      text-align: left; padding: 8px 15px; background: var(--bg-soft); 
      color: var(--secondary); font-weight: 700; text-transform: uppercase; font-size: 9px;
      border-bottom: 1px solid var(--border);
    }
    .level-table td { padding: 10px 15px; border-bottom: 1px dashed var(--border); color: var(--dark); }
    .level-table tr:last-child td { border-bottom: none; }
    
    .col-money { text-align: right; font-family: monospace; font-weight: 600; }
    .text-fv { color: var(--primary-dark); }
    .text-save { color: var(--accent); font-weight: 700; }

  </style>
</head>
<body>

  <div class="page-footer">
    <div>Generated by KeuanganKu System</div>
    <div>CONFIDENTIAL • Education Planning</div>
  </div>

  <div class="header-grid">
    <div class="h-title-box">
      <div class="sub-heading">PamJaya Financial</div>
      <h1 class="main-heading">Education Plan</h1>
    </div>
    <div class="h-image-right-top"></div>
    <div class="h-image-left-bottom"></div>
    <div class="h-brand-box">
      <img src="${assets.logoMaxiPro}" class="logo-maxipro" alt="Logo">
      <span class="brand-text">KEUANGANKU</span>
    </div>
  </div>

  {{#each plans}}
  <div class="child-section">
    
    <div class="child-header">
      <div>
        <div class="child-name">{{this.childName}}</div>
        <div class="child-info">
          Usia Saat Ini: {{this.childAge}} Tahun • Masuk Kuliah: Thn {{this.uniYear}}
        </div>
      </div>
      <div class="total-badge">
        <div class="total-label">Total Dana Dibutuhkan</div>
        <div class="total-value">{{this.totalFutureCost}}</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div style="font-size:24px;">💰</div>
        <div>
          <div class="stat-val">{{this.monthlySaving}} /bln</div>
          <div class="stat-lbl">Total Investasi Rutin</div>
        </div>
      </div>
      <div class="stat-card">
        <div style="font-size:24px;">📈</div>
        <div>
          <div class="stat-val">Inflasi {{this.inflationRate}}% | Return {{this.returnRate}}%</div>
          <div class="stat-lbl">Asumsi Ekonomi</div>
        </div>
      </div>
      <div class="stat-card">
        <div style="font-size:24px;">🧮</div>
        <div>
          <div class="stat-val">{{this.method}}</div>
          <div class="stat-lbl">Metode Perhitungan</div>
        </div>
      </div>
    </div>

    {{#each this.groupedStages}}
    <div class="level-card">
      <div class="level-header">
        <div class="level-title">{{this.levelName}}</div>
        <div class="level-summary">
           Mulai dlm {{this.startIn}} Tahun • Total FV: {{this.subTotalCost}}
        </div>
      </div>
      <table class="level-table">
        <thead>
          <tr>
            <th width="30%">Jenis Biaya</th>
            <th width="20%" class="col-money">Biaya Saat Ini</th>
            <th width="25%" class="col-money">Biaya Nanti (FV)</th>
            <th width="25%" class="col-money">Tabungan / Bln</th>
          </tr>
        </thead>
        <tbody>
          {{#each this.items}}
          <tr>
            <td>{{this.costType}}</td>
            <td class="col-money">{{this.currentCost}}</td>
            <td class="col-money text-fv">{{this.futureCost}}</td>
            <td class="col-money text-save">{{this.monthlySaving}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
    </div>
    {{/each}}

  </div>
  {{/each}}

</body>
</html>
`;