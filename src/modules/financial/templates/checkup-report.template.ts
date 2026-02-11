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

// Sesuaikan path ini dengan server environment Anda (Docker/Local)
const ASSET_BASE_PATH = path.join(process.cwd(), 'src/assets/images');

const assets = {
  logoMaxiPro: getImageBase64(path.join(ASSET_BASE_PATH, 'logokeuanganku.png')),
  checkupImg1: getImageBase64(path.join(ASSET_BASE_PATH, 'financialcheckup1.webp')), // Kanan Atas
  checkupImg2: getImageBase64(path.join(ASSET_BASE_PATH, 'financialcheckup2.webp'))  // Kiri Bawah
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
      font-family: Helvetica, Arial, sans-serif;
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
      padding-bottom: 20mm; 
      position: relative;
      overflow: hidden;
      display: flex; flex-direction: column;
    }

    @media print {
      body { background: none; }
      .page { margin: 0; box-shadow: none; page-break-after: always; height: auto; min-height: var(--page-height); border: none; }
    }

    /* --- UTILS --- */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .mb-4 { margin-bottom: 16px; }
    
    /* --- HEADER GRID 2x2 (PERUSAHAAN) --- */
    .header-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 100px 60px;
      gap: 10px;
      margin-bottom: 30px;
    }
    .h-title-box {
      background-color: var(--primary);
      color: white;
      padding: 15px 25px;
      border-top-left-radius: 20px;
      display: flex; flex-direction: column; justify-content: center;
      position: relative;
    }
    /* Agent Badge in Header */
    .agent-badge {
      position: absolute; top: 10px; right: 10px;
      font-size: 8px; background: rgba(255,255,255,0.2); 
      padding: 2px 8px; border-radius: 4px; text-transform: uppercase;
    }

    .h-image-right-top {
      background-image: url('${assets.checkupImg1}');
      background-size: cover; background-position: center;
      border-top-right-radius: 20px;
      background-color: var(--dark);
    }
    .h-image-left-bottom {
      background-image: url('${assets.checkupImg2}');
      background-size: cover; background-position: center;
      border-bottom-left-radius: 20px;
      background-color: var(--secondary);
    }
    .h-brand-box {
        background-color: white;
        border: 1px solid var(--border);
        color: var(--dark);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        border-bottom-right-radius: 20px;
        padding: 10px;
    }
   
    .logo-maxipro { 
      height: 60px; /* Adjusted size */
      width: auto; 
      display: block;
    }

    .main-heading { 
      font-size: 28px; font-weight: 800; line-height: 1.1; margin: 0; 
    }
    .sub-heading { text-transform: uppercase; font-size: 10px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 4px; }
    .agent-name { font-size: 11px; font-weight: 600; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 8px; display: inline-block;}

    /* --- SECTION TITLE --- */
    .section-title {
      font-size: 11px; font-weight: 800; color: var(--secondary);
      text-transform: uppercase; letter-spacing: 1.5px;
      border-bottom: 2px solid var(--border); padding-bottom: 5px; margin-bottom: 15px; margin-top: 25px;
    }
    .section-title:first-of-type { margin-top: 0; }

    /* --- PROFILE BOX (FULL DETAIL) --- */
    .profile-card {
      border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 20px;
    }
    .profile-header {
      background: var(--bg-soft); padding: 10px 15px; border-bottom: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
    }
    .profile-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--primary); }
    
    .profile-content { padding: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; font-size: 10px; }
    
    .data-group { margin-bottom: 10px; }
    .group-title { font-weight: 700; color: var(--dark); margin-bottom: 5px; border-bottom: 1px dashed var(--border); padding-bottom: 2px; }
    
    .data-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .data-key { color: var(--secondary); }
    .data-val { font-weight: 600; color: var(--dark); text-align: right; }

    /* --- FINANCIAL REVIEW CARDS --- */
    .review-card {
      border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
      margin-bottom: 15px; page-break-inside: avoid;
    }
    
    .review-header {
      padding: 8px 15px; color: white; font-weight: 700; font-size: 10px; text-transform: uppercase;
      display: flex; justify-content: space-between; align-items: center;
    }
    .bg-neraca { background: #059669; }
    .bg-arus { background: #0284c7; }
    
    .review-body { padding: 12px 15px; font-size: 10px; }
    
    .r-col-title { 
      font-weight: 800; color: var(--secondary); 
      margin-bottom: 8px; 
      text-transform: uppercase; 
      display: flex; align-items: center; gap: 6px;
      font-size: 9px;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot-green { background: var(--success); }
    .dot-red { background: var(--danger); }

    .r-item { 
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 4px; border-bottom: 1px dashed #f1f5f9; padding-bottom: 2px; 
    }
    .r-item:last-child { border-bottom: none; }
    .r-val { font-family: monospace; font-weight: 700; color: var(--dark); }

    .r-subtotal {
      margin-top: 8px; padding-top: 6px; border-top: 2px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      font-weight: 800; color: var(--dark);
    }

    .card-footer {
      background: #f8fafc; border-top: 1px solid var(--border);
      padding: 8px 15px; display: flex; justify-content: space-between; align-items: center;
    }
    .footer-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--dark); letter-spacing: 1px; }
    .footer-val { font-size: 14px; font-weight: 800; font-family: monospace; color: var(--dark); }
    .val-green { color: var(--success); }
    .val-red { color: var(--danger); }

    /* --- PAGE 2: SCORE & RATIOS --- */
    .hero-score {
      background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
      border-radius: 16px; padding: 20px 25px; color: white;
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.2);
      page-break-inside: avoid;
    }
    .score-circle {
      width: 60px; height: 60px; border-radius: 50%;
      border: 4px solid {{scoreColor}};
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 800; background: rgba(255,255,255,0.1);
    }
    
    .summary-box {
      background: #fff7ed; border-left: 4px solid #f97316;
      padding: 12px; border-radius: 6px; margin-bottom: 20px;
      font-size: 10px; line-height: 1.5; color: #7c2d12; text-align: justify;
      page-break-inside: avoid;
    }

    .ratio-container {
      /* Logika Page Break Otomatis */
      display: block; 
    }

    .ratio-grid { 
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px; 
    }
    
    .ratio-card {
      border: 1px solid var(--border); border-radius: 8px; padding: 10px;
      background: white; 
      page-break-inside: avoid; /* Mencegah kartu terpotong */
      break-inside: avoid;
    }
    
    .ratio-head { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .ratio-title { font-size: 8px; font-weight: 700; text-transform: uppercase; color: var(--secondary); }
    .ratio-badge { font-size: 7px; padding: 2px 5px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
    .bg-green { background: #dcfce7; color: #166534; }
    .bg-yellow { background: #fef9c3; color: #854d0e; }
    .bg-red { background: #fee2e2; color: #991b1b; }
    
    .ratio-val { font-size: 16px; font-weight: 800; color: var(--dark); margin-bottom: 2px; }
    .ratio-target { font-size: 8px; color: var(--secondary); font-style: italic; }
    .ratio-rec { margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border); font-size: 8px; color: #475569; line-height: 1.3; }

    /* --- PAGE FOOTER --- */
    .page-footer {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 12mm; padding: 0 15mm;
      border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      font-size: 8px; color: var(--secondary); background: white;
    }
  </style>
</head>
<body>

  <div class="page">
    
    <div class="header-grid">
      <div class="h-title-box">
        <div class="agent-badge">{{agent.level}}</div>
        <div class="sub-heading">{{agent.company}} - {{agent.agency}}</div>
        <h1 class="main-heading">Financial<br>Checkup</h1>
        <div class="agent-name">Prepared by: {{agent.name}}</div>
      </div>
      <div class="h-image-right-top"></div>
      <div class="h-image-left-bottom"></div>
      <div class="h-brand-box">
        <img src="{{logoUrl}}" class="logo-maxipro" alt="Logo">
      </div>
    </div>

    <div class="section-title">01. Profil Keluarga Nasabah</div>
    <div class="profile-card">
      <div class="profile-header">
        <div class="profile-label">Kepala Keluarga</div>
        <div class="profile-label" style="color:var(--dark);">{{checkDate}}</div>
      </div>
      <div class="profile-content">
        <div>
          <div class="data-group">
            <div class="group-title">Data Pribadi</div>
            <div class="data-row"><span class="data-key">Nama</span> <span class="data-val">{{client.name}}</span></div>
            <div class="data-row"><span class="data-key">Usia / DOB</span> <span class="data-val">{{client.age}} Th / {{client.dob}}</span></div>
            <div class="data-row"><span class="data-key">Agama</span> <span class="data-val">{{client.religion}}</span></div>
            <div class="data-row"><span class="data-key">Pekerjaan</span> <span class="data-val">{{client.job}}</span></div>
          </div>
          <div class="data-group">
            <div class="group-title">Kontak</div>
            <div class="data-row"><span class="data-key">Kota</span> <span class="data-val">{{client.city}}</span></div>
            <div class="data-row"><span class="data-key">No HP</span> <span class="data-val">{{client.phone}}</span></div>
          </div>
        </div>
        
        <div>
          <div class="data-group">
            <div class="group-title">Status Keluarga</div>
            <div class="data-row"><span class="data-key">Status</span> <span class="data-val">{{client.maritalStatus}}</span></div>
            <div class="data-row"><span class="data-key">Jml Anak</span> <span class="data-val">{{client.childrenCount}} Orang</span></div>
            <div class="data-row"><span class="data-key">Tanggungan Lain</span> <span class="data-val">{{client.dependentParents}} Orang</span></div>
          </div>
          
          {{#if spouse.hasSpouse}}
          <div class="data-group">
            <div class="group-title">Data Pasangan</div>
            <div class="data-row"><span class="data-key">Nama</span> <span class="data-val">{{spouse.name}}</span></div>
            <div class="data-row"><span class="data-key">Usia</span> <span class="data-val">{{spouse.age}} Tahun</span></div>
            <div class="data-row"><span class="data-key">Pekerjaan</span> <span class="data-val">{{spouse.job}}</span></div>
          </div>
          {{/if}}
        </div>
      </div>
    </div>

    <div class="section-title">02. Ringkasan Keuangan</div>

    <div class="review-card">
      <div class="review-header bg-neraca">
        <span>Balance Sheet (Posisi Harta)</span>
        <span>IDR</span>
      </div>
      <div class="grid-2 review-body">
        <div>
          <div class="r-col-title"><span class="dot dot-green"></span> Aset</div>
          <div class="r-item"><span>Likuid (Cash)</span> <span class="r-val">{{fin.assetCash}}</span></div>
          <div class="r-item"><span>Personal (Pakai)</span> <span class="r-val">{{fin.assetPersonal}}</span></div>
          <div class="r-item"><span>Investasi (Tumbuh)</span> <span class="r-val">{{fin.assetInvest}}</span></div>
          <div class="r-subtotal"><span>TOTAL ASET</span> <span style="color:var(--success)">{{fin.totalAsset}}</span></div>
        </div>
        <div>
          <div class="r-col-title"><span class="dot dot-red"></span> Utang</div>
          <div class="r-item"><span>Jangka Pendek</span> <span class="r-val">{{fin.debtShort}}</span></div>
          <div class="r-item"><span>Jangka Panjang</span> <span class="r-val">{{fin.debtLong}}</span></div>
          <div class="r-subtotal"><span>TOTAL UTANG</span> <span style="color:var(--danger)">{{fin.totalDebt}}</span></div>
        </div>
      </div>
      <div class="card-footer">
        <div class="footer-label">Kekayaan Bersih (Net Worth)</div>
        <div class="footer-val {{fin.netWorthColor}}">{{fin.netWorth}}</div>
      </div>
    </div>

    <div class="review-card">
      <div class="review-header bg-arus">
        <span>Cashflow (Aliran Uang Bulanan)</span>
        <span>Estimasi</span>
      </div>
      <div class="grid-2 review-body">
        <div>
          <div class="r-col-title"><span class="dot dot-green"></span> Pemasukan</div>
          <div class="r-item"><span>Gaji Tetap</span> <span class="r-val">{{fin.incomeFixed}}</span></div>
          <div class="r-item"><span>Non-Tetap</span> <span class="r-val">{{fin.incomeVariable}}</span></div>
          <div class="r-subtotal"><span>TOTAL MASUK</span> <span style="color:var(--primary)">{{fin.totalIncome}}</span></div>
        </div>
        <div>
          <div class="r-col-title"><span class="dot dot-red"></span> Pengeluaran</div>
          <div class="r-item"><span>Cicilan Utang</span> <span class="r-val">{{fin.expenseDebt}}</span></div>
          <div class="r-item"><span>Premi Asuransi</span> <span class="r-val">{{fin.expenseInsurance}}</span></div>
          <div class="r-item"><span>Biaya Hidup</span> <span class="r-val">{{fin.expenseLiving}}</span></div>
          <div class="r-subtotal"><span>TOTAL KELUAR</span> <span style="color:var(--danger)">{{fin.totalExpense}}</span></div>
        </div>
      </div>
      <div class="card-footer">
        <div class="footer-label">Sisa Uang (Surplus / Defisit)</div>
        <div class="footer-val {{fin.surplusColor}}">{{fin.surplusDeficit}}</div>
      </div>
    </div>

    <div class="page-footer">
      <div>Financial Checkup Report</div>
      <div>{{agent.company}} • Confidential</div>
    </div>
  </div>

  <div class="page" style="page-break-before: always;">
    
    <div class="hero-score">
      <div>
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; opacity: 0.8;">Hasil Diagnosa</div>
        <div style="font-size: 28px; font-weight: 800; margin-bottom: 4px;">{{globalStatus}}</div>
        <div style="font-size: 10px;">Skor Kesehatan: <strong>{{score}}</strong> / 100</div>
      </div>
      <div class="score-circle">
        {{score}}
      </div>
    </div>

    <div class="section-title">
      03. Ringkasan Eksekutif
    </div>
    <div class="summary-box">
      Kondisi keuangan saat ini berstatus <strong>{{globalStatus}}</strong>. 
      Terdapat <strong>{{healthyCount}} indikator Sehat</strong> dan <strong>{{warningCount}} indikator Perlu Perhatian</strong>. 
      Segera konsultasikan dengan agen Anda untuk memperbaiki rasio yang berwarna merah/kuning di bawah ini.
    </div>

    <div class="section-title">
      04. Analisa 8 Indikator Vital
    </div>

    <div class="ratio-container">
      <div class="ratio-grid">
        {{#each ratios}}
        <div class="ratio-card">
          <div class="ratio-head">
            <div class="ratio-title">{{this.label}}</div>
            <div class="ratio-badge {{this.cssClass}}">{{this.statusLabel}}</div>
          </div>
          <div class="ratio-val">{{this.valueDisplay}}</div>
          <div class="ratio-target">Ideal: {{this.benchmark}}</div>
          <div class="ratio-rec">
            {{this.recommendation}}
          </div>
        </div>
        {{/each}}
      </div>
    </div>

    <div class="page-footer">
      <div>Financial Checkup Report</div>
      <div>{{agent.company}} • Confidential</div>
    </div>

  </div>

</body>
</html>
`;