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
            return '';
        }
        const bitmap = fs.readFileSync(filePath);
        const extension = path.extname(filePath).replace('.', '');
        const mimeType = extension === 'svg' ? 'svg+xml' : extension;
        return `data:image/${mimeType};base64,${bitmap.toString('base64')}`;
    } catch (error) {
        console.error(`[Template Error] Failed to load image: ${filePath}`, error);
        return '';
    }
}

// Sesuaikan path ini dengan server environment Anda (Docker/Local)
const ASSET_BASE_PATH = path.join(process.cwd(), 'src/assets/images');

const assets = {
    logoMaxiPro: getImageBase64(path.join(ASSET_BASE_PATH, 'maxipro.webp')),
    headerImg1: getImageBase64(path.join(ASSET_BASE_PATH, 'rancanganggaran1.webp')),
    headerImg2: getImageBase64(path.join(ASSET_BASE_PATH, 'rancanganggaran2.webp'))
};

/**
 * ------------------------------------------------------------------
 * 2. VIEW LAYER: HTML TEMPLATE
 * ------------------------------------------------------------------
 */
export const budgetReportTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Budget Plan Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;1,600&display=swap');
    
    :root {
      --primary: #0e7490;      /* Cyan 700 */
      --primary-dark: #155e75; /* Cyan 800 */
      --secondary: #64748b;    /* Slate 500 */
      --dark: #0f172a;         /* Slate 900 */
      --border: #e2e8f0;       /* Slate 200 */
      --bg-soft: #f8fafc;
      --success: #15803d;      /* Green 700 */
      --danger: #b91c1c;       /* Red 700 */
      --page-width: 210mm;
      --page-height: 297mm;
      --page-padding: 15mm;
    }

    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    body {
      margin: 0; padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
      color: var(--dark);
      background-color: #525252;
    }

    /* --- PAGE CONTAINER --- */
    .page {
      width: var(--page-width);
      min-height: var(--page-height);
      background: #ffffff;
      margin: 20px auto;
      padding: var(--page-padding);
      /* Padding bawah ekstra agar footer tidak tertimpa konten */
      padding-bottom: 25mm; 
      position: relative;
      overflow: hidden;
      display: flex; flex-direction: column;
    }

    @media print {
      body { background: none; }
      .page { margin: 0; box-shadow: none; page-break-after: always; height: auto; min-height: var(--page-height); }
    }

    /* --- UTILS --- */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .text-secondary { color: var(--secondary); }
    
    /* --- HEADER GRID 2x2 --- */
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
      background-image: url('${assets.headerImg1}');
      background-size: cover; background-position: center;
      border-top-right-radius: 20px;
      background-color: var(--dark);
    }
    .h-image-left-bottom {
      background-image: url('${assets.headerImg2}');
      background-size: cover; background-position: center;
      border-bottom-left-radius: 20px;
      background-color: var(--secondary);
    }
    .h-brand-box {
      background-color: var(--primary-dark);
      color: white;
      display: flex; align-items: center; justify-content: center;
      gap: 10px;
      border-bottom-right-radius: 20px;
    }
    .logo-maxipro { height: 24px; width: auto; filter: brightness(0) invert(1); }
    .brand-text { font-weight: 800; letter-spacing: 2px; font-size: 12px; text-transform: uppercase; }
    .main-heading { font-family: 'Playfair Display', serif; font-size: 32px; line-height: 1; margin: 0; }
    .sub-heading { text-transform: uppercase; font-size: 10px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 4px; }

    /* --- SECTION TITLE --- */
    .section-title {
      font-size: 12px; font-weight: 800; color: var(--secondary);
      text-transform: uppercase; letter-spacing: 1px;
      border-bottom: 2px solid var(--border); padding-bottom: 6px; margin-bottom: 8px;
    }

    /* --- INFO BOXES (Top Section) --- */
    .info-container {
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
      margin-bottom: 30px;
    }
    .info-card {
      background: var(--bg-soft); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px;
    }
    .info-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 8px; font-size: 11px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px;
    }
    .info-row:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
    .label { color: var(--secondary); font-weight: 600; }
    .value { font-weight: 700; color: var(--dark); font-family: monospace; font-size: 12px; }

    .total-highlight {
      margin-top: 10px; padding-top: 8px; border-top: 2px solid #cbd5e1;
    }
    .total-highlight .label { font-weight: 800; color: var(--primary-dark); text-transform: uppercase; font-size: 10px; }
    .total-highlight .value { font-size: 14px; color: var(--primary-dark); }

    /* --- ALLOCATION LIST --- */
    .allocation-list {
      list-style: none; padding: 0; margin: 0;
    }
    .allocation-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; margin-bottom: 10px;
      background: white; 
      border: 1px solid var(--border); 
      border-left-width: 4px; /* Color coded border */
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
      page-break-inside: avoid;
    }
    
    /* Warna border variasi (looping nth-child simulation via style inline di body nanti jika perlu, atau hardcode class) */
    .allocation-item:nth-child(1) { border-left-color: #3b82f6; } /* Blue - Utang Prod */
    .allocation-item:nth-child(2) { border-left-color: #ef4444; } /* Red - Utang Kons */
    .allocation-item:nth-child(3) { border-left-color: #f59e0b; } /* Amber - Asuransi */
    .allocation-item:nth-child(4) { border-left-color: #10b981; } /* Emerald - Saving */
    .allocation-item:nth-child(5) { border-left-color: #6366f1; } /* Indigo - Living */

    .alloc-label { font-size: 10px; font-weight: 700; color: var(--dark); text-transform: uppercase; letter-spacing: 0.5px; }
    .alloc-val { font-size: 13px; font-weight: 700; font-family: monospace; color: var(--primary-dark); }

    /* --- SUMMARY / CONCLUSION BOX --- */
    .summary-section {
      margin-top: 30px;
      background: linear-gradient(to right, #f0fdf4, #f8fafc);
      border: 1px solid #bbf7d0; 
      border-radius: 12px;
      padding: 24px;
      position: relative;
      overflow: hidden;
    }
    .summary-section::before {
      content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: #16a34a;
    }
    
    .sum-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 9px; padding-bottom: 12px; border-bottom: 1px dashed #bbf7d0;
    }
    .sum-row:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    
    .sum-label { font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px; }
    .sum-val { font-size: 16px; font-weight: 800; color: #14532d; font-family: monospace; }
    .sum-val.highlight { color: #0ea5e9; font-size: 20px; }

    /* --- FOOTER NOTE --- */
    .footer-note {
      margin-top: 24px; padding: 16px; background: #fff7ed; 
      border: 1px solid #fed7aa; border-radius: 8px;
      color: #9a3412; font-size: 10px; line-height: 1.6;
    }
    .footer-note strong { color: #c2410c; }

    /* --- PAGE FOOTER (Absolute Bottom) --- */
    .page-footer {
      position: absolute; 
      bottom: 0; 
      left: 0; 
      right: 0;
      height: 15mm; 
      padding: 0 15mm;
      border-top: 1px solid var(--border);
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      background: white;
    }
    .footer-text { font-size: 9px; color: var(--secondary); font-weight: 500; letter-spacing: 0.5px; }
  </style>
</head>
<body>

  <div class="page">
    
    <div class="header-grid">
      <div class="h-title-box">
        <div class="sub-heading">PamJaya Financial</div>
        <h1 class="main-heading">Budget Plan</h1>
      </div>
      <div class="h-image-right-top"></div>
      <div class="h-image-left-bottom"></div>
      <div class="h-brand-box">
        <img src="${assets.logoMaxiPro}" class="logo-maxipro" alt="Logo">
        <span class="brand-text">KEUANGANKU</span>
      </div>
    </div>

    <div class="info-container">
      
      <div>
        <div class="section-title">01. Data Diri</div>
        <div class="info-card">
          <div class="info-row">
            <span class="label">Nama Lengkap</span>
            <span class="value">{{user.name}}</span>
          </div>
          <div class="info-row">
            <span class="label">Usia</span>
            <span class="value">{{user.age}} Tahun</span>
          </div>
          <div class="info-row">
            <span class="label">Periode Anggaran</span>
            <span class="value">{{period}}</span>
          </div>
          <div class="info-row">
            <span class="label">Tanggal Dibuat</span>
            <span class="value">{{createdAt}}</span>
          </div>
        </div>
      </div>

      <div>
        <div class="section-title">02. Penghasilan Per Bulan</div>
        <div class="info-card">
          <div class="info-row">
            <span class="label">• Penghasilan Tetap</span>
            <span class="value">{{income.fixed}}</span>
          </div>
          <div class="info-row">
            <span class="label">• Penghasilan Tidak Tetap</span>
            <span class="value">{{income.variable}}</span>
          </div>
          <div class="info-row total-highlight">
            <span class="label">TOTAL PENGHASILAN</span>
            <span class="value">{{income.total}}</span>
          </div>
        </div>
      </div>

    </div>

    <div class="section-title">03. Anggaran Yang Disarankan</div>
    <div style="margin-bottom: 12px; font-size: 10px; color: var(--secondary); font-style: italic;">
      *Alokasi dihitung berdasarkan persentase ideal dari <strong>Penghasilan Tetap</strong>.
    </div>
    
    <ul class="allocation-list">
      <li class="allocation-item">
        <span class="alloc-label">1. Utang Produktif (20%)</span>
        <span class="alloc-val">{{allocations.productive.value}}</span>
      </li>
      <li class="allocation-item">
        <span class="alloc-label">2. Utang Konsumtif (15%)</span>
        <span class="alloc-val">{{allocations.consumptive.value}}</span>
      </li>
      <li class="allocation-item">
        <span class="alloc-label">3. Premi Asuransi (10%)</span>
        <span class="alloc-val">{{allocations.insurance.value}}</span>
      </li>
      <li class="allocation-item">
        <span class="alloc-label">4. Tabungan & Investasi (10%)</span>
        <span class="alloc-val">{{allocations.saving.value}}</span>
      </li>
      <li class="allocation-item">
        <span class="alloc-label">5. Biaya Hidup & Gaya Hidup (45%)</span>
        <span class="alloc-val">{{allocations.living.value}}</span>
      </li>
    </ul>

    <div class="section-title" style="margin-top: 20px;">04. Kesimpulan Akhir</div>
    <div class="summary-section">
      <div class="sum-row">
        <span class="sum-label">Total Anggaran (Fixed Income)</span>
        <span class="sum-val">{{summary.totalBudget}}</span>
      </div>
      <div class="sum-row">
        <span class="sum-label" style="color: #0369a1;">Total Surplus (Variable Income)</span>
        <span class="sum-val highlight">{{summary.totalSurplus}}</span>
      </div>
    </div>

    <div class="page-footer">
      <div class="footer-text">Generated by KeuanganKu System</div>
      <div class="footer-text">CONFIDENTIAL • Page 1 of 1</div>
    </div>

  </div>
</body>
</html>
`;