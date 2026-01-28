// src/modules/financial/templates/checkup-report.template.ts

import * as fs from 'fs';
import * as path from 'path';

/**
 * ------------------------------------------------------------------
 * 1. LOGIC LAYER: ASSET HANDLING
 * ------------------------------------------------------------------
 */

/**
 * Helper untuk mengonversi file gambar lokal menjadi string Base64.
 * Ini memastikan gambar tetap muncul di PDF tanpa tergantung path server.
 */
function getImageBase64(filePath: string): string {
    try {
        // Cek apakah file ada sebelum dibaca
        if (!fs.existsSync(filePath)) {
            console.warn(`[Template Warning] Image not found at: ${filePath}`);
            return ''; // Return empty string agar tidak error, hanya gambar blank
        }

        const bitmap = fs.readFileSync(filePath);
        const extension = path.extname(filePath).replace('.', '');
        // Handle svg jika ada, sisanya default
        const mimeType = extension === 'svg' ? 'svg+xml' : extension;

        return `data:image/${mimeType};base64,${bitmap.toString('base64')}`;
    } catch (error) {
        console.error(`[Template Error] Failed to load image: ${filePath}`, error);
        return '';
    }
}

// Konfigurasi Path Aset (Sesuaikan base path jika deploy ke server berbeda)
const ASSET_BASE_PATH = "C:\\Users\\PC\\Documents\\KeuanganKu\\Backend\\keuanganku-be\\src\\assets\\images";

// Load Assets ke Memory sebagai Base64
const assets = {
    logoMaxiPro: getImageBase64(path.join(ASSET_BASE_PATH, 'maxipro.webp')),
    checkupImg1: getImageBase64(path.join(ASSET_BASE_PATH, 'financialcheckup1.webp')), // Untuk Kanan Atas
    checkupImg2: getImageBase64(path.join(ASSET_BASE_PATH, 'financialcheckup2.webp'))  // Untuk Kiri Bawah
};

/**
 * ------------------------------------------------------------------
 * 2. VIEW LAYER: HTML TEMPLATE
 * ------------------------------------------------------------------
 */
export const checkupReportTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Financial Health Report</title>
  <style>
    /* --- FONTS & RESET --- */
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;1,600&display=swap');
    
    :root {
      --primary: #0e7490;      /* Cyan 700 */
      --primary-dark: #155e75; /* Cyan 800 */
      --secondary: #64748b;    /* Slate 500 */
      --dark: #0f172a;         /* Slate 900 */
      --border: #e2e8f0;       /* Slate 200 */
      --page-width: 210mm;
      --page-height: 297mm;
      --page-padding: 15mm;
    }

    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    body {
      margin: 0; padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
      color: var(--dark);
      background-color: #525252; /* Warna background browser preview */
    }

    /* --- PAGE CONTAINER SETUP --- */
    .page {
      width: var(--page-width);
      min-height: var(--page-height);
      background: #ffffff;
      margin: 20px auto;
      padding: var(--page-padding);
      /* Padding bawah ekstra untuk footer safety area */
      padding-bottom: 20mm; 
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    @media print {
      body { background: none; }
      .page { 
        margin: 0; 
        box-shadow: none; 
        page-break-after: always;
        height: auto; 
        min-height: var(--page-height);
        overflow: visible;
      }
    }

    /* --- UTILITIES --- */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    .mb-4 { margin-bottom: 16px; }
    .mb-8 { margin-bottom: 32px; }
    
    /* Smart Break Logic */
    .no-break { page-break-inside: avoid; break-inside: avoid; }
    .force-break { page-break-before: always; }

    /* --- HEADER GRID (2x2) --- */
    .header-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 110px 70px;
      gap: 8px;
      margin-bottom: 32px;
    }

    /* Q1: Title */
    .h-title-box {
      background-color: var(--primary);
      color: white;
      padding: 24px 30px;
      border-top-left-radius: 20px;
      display: flex; flex-direction: column; justify-content: center;
    }

    /* Q2: Image Kanan Atas */
    .h-image-right-top {
      background-image: url('${assets.checkupImg1}');
      background-size: cover;
      background-position: center;
      border-top-right-radius: 20px;
      background-color: var(--dark);
    }

    /* Q3: Image Kiri Bawah */
    .h-image-left-bottom {
      background-image: url('${assets.checkupImg2}');
      background-size: cover;
      background-position: center;
      border-bottom-left-radius: 20px;
      background-color: var(--secondary);
    }

    /* Q4: Brand & Logo */
    .h-brand-box {
      background-color: var(--primary-dark);
      color: white;
      display: flex; align-items: center; justify-content: center;
      gap: 12px;
      border-bottom-right-radius: 20px;
      padding: 0 20px;
    }

    .logo-maxipro {
      height: 28px; width: auto; object-fit: contain;
      filter: brightness(0) invert(1); /* Logo jadi putih */
    }

    .brand-text {
      font-weight: 800; letter-spacing: 0.15em; font-size: 13px; text-transform: uppercase;
    }

    .main-heading { font-family: 'Playfair Display', serif; font-size: 36px; line-height: 1; margin: 4px 0 0 0; }
    .sub-heading { text-transform: uppercase; font-size: 11px; letter-spacing: 2px; opacity: 0.9; font-weight: 600; }

    /* --- METADATA STRIP --- */
    .meta-strip {
      display: flex; justify-content: space-between;
      border-bottom: 2px solid var(--border);
      padding-bottom: 16px; margin-bottom: 32px;
    }
    .meta-item label { display: block; font-size: 9px; color: var(--secondary); text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
    .meta-item div { font-size: 13px; font-weight: 600; color: var(--dark); }

    /* --- PROFILE SECTION --- */
    .profile-container {
      background: white; border: 1px solid var(--border); border-radius: 16px;
      padding: 20px 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .profile-header {
      font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 1px;
      border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 12px;
    }
    .data-point { margin-bottom: 6px; font-size: 12px; display: flex; justify-content: space-between; }
    .data-point span:first-child { color: var(--secondary); }
    .data-point span:last-child { font-weight: 600; color: var(--dark); text-align: right; }

    /* --- HERO SCORE CARD --- */
    .hero-card {
      background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
      border-radius: 20px; padding: 32px; color: white;
      position: relative; overflow: hidden; margin-bottom: 32px;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.3);
    }
    .hero-card::after {
      content: ""; position: absolute; top: 0; right: 0; width: 200px; height: 100%;
      background: linear-gradient(to left, rgba(255,255,255,0.05), transparent);
    }
    .score-ring {
      width: 80px; height: 80px; border-radius: 50%;
      border: 6px solid {{scoreColor}};
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 800; background: rgba(0,0,0,0.2);
    }

    /* --- SUMMARY BOX --- */
    .summary-section {
      background-color: #fff7ed; border-left: 6px solid #f97316;
      border-radius: 0 12px 12px 0; padding: 24px; margin-bottom: 20px;
    }
    .summary-title { color: #9a3412; font-weight: 700; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
    .summary-content { font-size: 13px; line-height: 1.8; color: #431407; text-align: justify; }

    /* --- RATIO GRID (Page 2) --- */
    .page-title {
      font-size: 18px; font-weight: 800; color: var(--dark);
      margin-bottom: 24px; padding-left: 16px; border-left: 4px solid var(--primary);
    }
    .ratio-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    }
    .ratio-card {
      background: white; border: 1px solid var(--border); border-radius: 16px;
      padding: 20px; display: flex; flex-direction: column;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
      page-break-inside: avoid; /* KUNCI: Mencegah kartu terpotong */
    }
    .ratio-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .ratio-label { font-size: 11px; font-weight: 700; color: var(--secondary); text-transform: uppercase; letter-spacing: 0.5px; }
    .ratio-tag { font-size: 9px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; }
    .ratio-val { font-size: 24px; font-weight: 800; color: var(--dark); letter-spacing: -0.5px; margin-bottom: 4px; }
    .ratio-sub { font-size: 11px; color: var(--secondary); font-weight: 500; }
    .ratio-desc {
      margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--border);
      font-size: 11px; line-height: 1.6; color: #475569;
    }

    /* Status Colors */
    .bg-green { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .bg-yellow { background: #fef9c3; color: #a16207; border: 1px solid #fde047; }
    .bg-red { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }

    /* --- FOOTER --- */
    .footer {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 15mm; padding: 0 15mm;
      border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      background: white;
      font-size: 9px; color: var(--secondary); font-weight: 500; letter-spacing: 0.5px;
    }
  </style>
</head>
<body>

  <div class="page">
    
    <div class="header-grid">
      <div class="h-title-box">
        <div class="sub-heading">PamJaya Financial</div>
        <h1 class="main-heading">Health Checkup</h1>
      </div>
      <div class="h-image-right-top"></div>
      <div class="h-image-left-bottom"></div>
      <div class="h-brand-box">
        <img src="${assets.logoMaxiPro}" class="logo-maxipro" alt="MaxiPro">
        <span class="brand-text">KEUANGANKU</span>
      </div>
    </div>

    <div class="meta-strip">
      <div class="meta-item">
        <label>Report Date</label>
        <div>{{checkDate}}</div>
      </div>
      <div class="meta-item">
        <label>Client Name</label>
        <div>{{user.name}}</div>
      </div>
      <div class="meta-item">
        <label>Prepared By</label>
        <div>{{preparedBy}}</div>
      </div>
      <div class="meta-item" style="text-align: right;">
        <label>Store Manager</label>
        <div>{{managerName}}</div>
      </div>
    </div>

    <div class="grid-2 mb-8">
      <div class="profile-container no-break">
        <div class="profile-header">Primary Applicant</div>
        <div class="data-point"><span>Name</span> <span>{{user.name}}</span></div>
        <div class="data-point"><span>Age</span> <span>{{user.age}} Years</span></div>
        <div class="data-point"><span>Occupation</span> <span>{{user.job}}</span></div>
        <div class="data-point"><span>Domicile</span> <span>{{user.domicile}}</span></div>
        <div class="data-point"><span>Dependents</span> <span>{{user.dependents}} Person(s)</span></div>
      </div>

      <div class="profile-container no-break">
        <div class="profile-header">Spouse / Partner</div>
        {{#if spouse}}
        <div class="data-point"><span>Name</span> <span>{{spouse.name}}</span></div>
        <div class="data-point"><span>Age</span> <span>{{spouse.age}} Years</span></div>
        <div class="data-point"><span>Occupation</span> <span>{{spouse.job}}</span></div>
        <div class="data-point"><span>Domicile</span> <span>{{spouse.domicile}}</span></div>
        {{else}}
        <div style="height: 100px; display: flex; align-items: center; justify-content: center; color: var(--border); font-style: italic; font-size: 12px;">
          No Spouse Data
        </div>
        {{/if}}
      </div>
    </div>

    <div class="hero-card no-break">
      <div class="flex justify-between items-center">
        <div>
          <div style="font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Overall Financial Status</div>
          <div style="font-size: 42px; font-weight: 800; line-height: 1; margin-bottom: 8px;">{{globalStatus}}</div>
          <div style="background: rgba(255,255,255,0.15); display: inline-block; padding: 6px 12px; border-radius: 8px; font-size: 12px;">
            Total Net Worth: <strong>{{netWorth}}</strong>
          </div>
        </div>
        <div class="score-ring">
          {{score}}
        </div>
      </div>
    </div>

    <div class="summary-section no-break">
      <div class="summary-title">Executive Summary & Recommendation</div>
      <div class="summary-content">
        Berdasarkan analisis algoritma kami, kesehatan keuangan Anda saat ini berada pada level <strong>{{globalStatus}}</strong>. 
        Terdapat surplus arus kas sebesar <strong>{{monthlySurplus}}</strong> yang idealnya dapat dialokasikan untuk percepatan dana pensiun. 
        Kami menyarankan untuk meninjau kembali <strong>{{warningCount}} indikator</strong> yang berada di zona merah pada halaman berikutnya untuk mitigasi risiko jangka panjang.
      </div>
    </div>

    <div class="footer">
      <div>Generated by KeuanganKu System</div>
      <div>CONFIDENTIAL DOCUMENT • Page 1 of 2</div>
    </div>

  </div> 
  
  <div class="page force-break">
    
    <div class="page-title">Detailed Ratio Analysis</div>
    
    <div class="ratio-grid">
      {{#each ratios}}
      <div class="ratio-card">
        <div class="ratio-head">
          <div class="ratio-label">{{this.label}}</div>
          <div class="ratio-tag {{this.cssClass}}">{{this.statusLabel}}</div>
        </div>
        
        <div>
          <div class="ratio-val">{{this.valueDisplay}}</div>
          <div class="ratio-sub">Target Benchmark: {{this.benchmark}}</div>
        </div>

        <div class="ratio-desc">
          {{this.recommendation}}
        </div>
      </div>
      {{/each}}
    </div>

    <div class="footer">
      <div>Generated by KeuanganKu System</div>
      <div>CONFIDENTIAL DOCUMENT • Page 2 of 2</div>
    </div>

  </div> 

</body>
</html>
`;