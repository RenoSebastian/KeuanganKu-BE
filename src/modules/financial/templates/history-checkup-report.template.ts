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
  headerImg1: getImageBase64(path.join(ASSET_BASE_PATH, 'financialcheckup1.webp')),
  headerImg2: getImageBase64(path.join(ASSET_BASE_PATH, 'financialcheckup2.webp'))
};

export const historyCheckupReportTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Historical Checkup Report</title>
  <style>
    /* [OPTIMISASI] Hapus font eksternal */
    /* @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans...'); */
    
    :root {
      --white: #ffffff;
      --primary: #0e7490;      
      --primary-dark: #155e75; 
      --secondary: #64748b;    
      --dark: #0f172a;         
      --border: #e2e8f0;       
      --bg-soft: #f8fafc;
      --success: #15803d;      
      --danger: #b91c1c;       
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

    /* --- PAGE CONTAINER (A4 Fixed) --- */
    .page {
      width: var(--page-width);
      height: var(--page-height);
      background: #ffffff;
      margin: 20px auto;
      padding: var(--page-padding);
      position: relative; /* Penting untuk footer absolute */
      overflow: hidden;
      display: flex;
      flex-direction: column;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }

    @media print {
      body { background: none; }
      .page { margin: 0; box-shadow: none; height: var(--page-height); width: var(--page-width); }
    }

    /* --- UTILS --- */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    .font-bold { font-weight: 700; }
    .text-secondary { color: var(--secondary); }
    
    /* --- HEADER GRID (Hanya Hal 1) --- */
    .header-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 110px 70px;
      gap: 8px;
      margin-bottom: 24px;
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
      font-size: 11px; font-weight: 800; color: var(--secondary);
      text-transform: uppercase; letter-spacing: 1px;
      border-bottom: 2px solid var(--border); padding-bottom: 6px; margin-bottom: 16px; margin-top: 20px;
    }
    .section-title:first-child { margin-top: 0; }

    /* --- PROFILE BOX --- */
    .profile-box {
      background: var(--bg-soft); border: 1px solid var(--border);
      border-radius: 12px; padding: 15px 20px; margin-bottom: 20px;
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
    }
    .profile-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
    .profile-row label { color: var(--secondary); }
    .profile-row span { font-weight: 600; color: var(--dark); }

    /* --- REVIEW CARDS --- */
    .review-card {
      border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 16px;
    }
    .review-header {
      padding: 10px 15px; color: white; font-weight: 700; font-size: 11px; text-transform: uppercase;
    }
    .bg-neraca { background: #059669; }
    .bg-arus { background: #0284c7; }
    
    .review-body { padding: 12px 15px; font-size: 10px; }
    .r-item { display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px dashed #f1f5f9; padding-bottom: 2px; }
    .r-val { font-family: monospace; font-weight: 700; color: var(--dark); }
    .r-col-title { font-weight: 800; color: var(--secondary); margin-bottom: 8px; text-transform: uppercase; }

    .card-footer {
      background: #f8fafc; border-top: 1px solid var(--border);
      padding: 10px 15px; text-align: center;
    }
    .footer-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--secondary); }
    .footer-val { font-size: 16px; font-weight: 800; font-family: monospace; }
    .val-green { color: var(--success); } .val-red { color: var(--danger); }

    /* --- SCORE & RATIOS --- */
    .hero-score {
      background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
      border-radius: 16px; padding: 20px 30px; color: white;
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px;
    }
    .score-circle {
      width: 70px; height: 70px; border-radius: 50%; border: 5px solid {{scoreColor}};
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; font-weight: 800; background: rgba(255,255,255,0.1);
    }
    .summary-box {
      background: #fff7ed; border-left: 4px solid #f97316;
      padding: 15px; border-radius: 8px; margin-bottom: 20px;
      font-size: 11px; line-height: 1.6; color: #7c2d12; text-align: justify;
    }

    .ratio-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .ratio-card {
      border: 1px solid var(--border); border-radius: 10px; padding: 12px;
      background: white; display: flex; flex-direction: column;
    }
    .ratio-head { display: flex; justify-content: space-between; margin-bottom: 6px; align-items: center; }
    .ratio-title { font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--secondary); }
    .ratio-badge { font-size: 8px; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
    .bg-green { background: #dcfce7; color: #166534; }
    .bg-yellow { background: #fef9c3; color: #854d0e; }
    .bg-red { background: #fee2e2; color: #991b1b; }
    
    .ratio-val { font-size: 18px; font-weight: 800; color: var(--dark); font-family: monospace; }
    .ratio-rec { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border); font-size: 9px; color: #475569; line-height: 1.4; }

    /* --- PAGE FOOTER (FIXED POSITION) --- */
    .page-footer {
      position: absolute;
      bottom: 10mm;
      left: var(--page-padding);
      right: var(--page-padding);
      height: 10mm;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: var(--secondary);
      background: white;
    }
  </style>
</head>
<body>

  <div class="page">
    <div class="header-grid">
      <div class="h-title-box">
        <div class="sub-heading">MAXIPRO Financial</div>
        <h1 class="main-heading">Checkup History</h1>
      </div>
      <div class="h-image-right-top"></div>
      <div class="h-image-left-bottom"></div>
      <div class="h-brand-box">
        <img src="${assets.logoMaxiPro}" class="logo-maxipro" alt="Logo">
      </div>
    </div>

    <div class="section-title">01. Profil Klien</div>
    <div class="profile-box">
      <div>
        <div class="profile-row"><label>Nama Lengkap</label> <span>{{user.name}}</span></div>
        <div class="profile-row"><label>Usia</label> <span>{{user.age}} Tahun</span></div>
        <div class="profile-row"><label>Pekerjaan</label> <span>{{user.job}}</span></div>
      </div>
      <div>
        <div class="profile-row"><label>Status</label> <span>{{user.maritalStatus}}</span></div>
        <div class="profile-row"><label>Tgl Laporan</label> <span>{{checkDate}}</span></div>
        {{#if spouse}}
        <div class="profile-row"><label>Pasangan</label> <span>{{spouse.name}}</span></div>
        {{/if}}
      </div>
    </div>

    <div class="section-title">02. Ringkasan Keuangan (Snapshot)</div>

    <div class="review-card">
      <div class="review-header bg-neraca">Laporan Neraca (Balance Sheet)</div>
      <div class="grid-2 review-body">
        <div>
          <div class="r-col-title">Komposisi Aset</div>
          <div class="r-item"><span>Aset Likuid</span> <span class="r-val">{{fin.assetCash}}</span></div>
          <div class="r-item"><span>Aset Investasi</span> <span class="r-val">{{fin.assetInvest}}</span></div>
          <div class="r-item" style="border:none; margin-top:4px; font-weight:800;"><span>TOTAL ASET</span> <span style="color:#059669">{{fin.totalAsset}}</span></div>
        </div>
        <div>
          <div class="r-col-title">Kewajiban</div>
          <div class="r-item"><span>Utang Konsumtif</span> <span class="r-val">{{fin.debtOther}}</span></div>
          <div class="r-item"><span>KPR & KPM</span> <span class="r-val">{{fin.debtKPR}}</span></div>
          <div class="r-item" style="border:none; margin-top:4px; font-weight:800;"><span>TOTAL UTANG</span> <span style="color:#b91c1c">{{fin.totalDebt}}</span></div>
        </div>
      </div>
      <div class="card-footer">
        <div class="footer-label">Kekayaan Bersih (Net Worth)</div>
        <div class="footer-val {{fin.netWorthColor}}">{{fin.netWorth}}</div>
      </div>
    </div>

    <div class="review-card">
      <div class="review-header bg-arus">Laporan Arus Kas (Cashflow Bulanan)</div>
      <div class="grid-2 review-body">
        <div>
          <div class="r-col-title">Pemasukan</div>
          <div class="r-item"><span>Fixed Income</span> <span class="r-val">{{fin.incomeFixed}}</span></div>
          <div class="r-item"><span>Variable Income</span> <span class="r-val">{{fin.incomeVariable}}</span></div>
          <div class="r-item" style="border:none; margin-top:4px; font-weight:800;"><span>TOTAL</span> <span style="color:var(--primary)">{{fin.totalIncome}}</span></div>
        </div>
        <div>
          <div class="r-col-title">Pengeluaran</div>
          <div class="r-item"><span>Cicilan & Asuransi</span> <span class="r-val">{{fin.expenseDebt}}</span></div>
          <div class="r-item"><span>Biaya Hidup</span> <span class="r-val">{{fin.expenseLiving}}</span></div>
          <div class="r-item" style="border:none; margin-top:4px; font-weight:800;"><span>TOTAL</span> <span style="color:#b91c1c">{{fin.totalExpense}}</span></div>
        </div>
      </div>
      <div class="card-footer">
        <div class="footer-label">Sisa Uang (Surplus/Defisit)</div>
        <div class="footer-val {{fin.surplusColor}}">{{fin.surplusDeficit}}</div>
      </div>
    </div>

    <div class="page-footer">
      <div>Generated by KeuanganKu System</div>
      <div>CONFIDENTIAL • Page 1 of 3</div>
    </div>
  </div>

  {{#each ratioPages}}
  <div class="page">
    
    <div style="padding-top: 10mm;"></div>

    {{#if isFirstPage}}
      <div class="hero-score">
        <div>
          <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-bottom: 4px;">Status Kesehatan</div>
          <div style="font-size: 32px; font-weight: 800; line-height: 1;">{{../globalStatus}}</div>
          <div style="font-size: 12px; margin-top: 8px;">Skor: <strong>{{../score}}</strong> / 100</div>
        </div>
        <div class="score-circle">{{../score}}</div>
      </div>

      <div class="section-title">03. Ringkasan Eksekutif</div>
      <div class="summary-box">
        Berdasarkan data pemeriksaan, kondisi finansial Anda berstatus <strong>{{../globalStatus}}</strong>. 
        Sistem mendeteksi <strong>{{../healthyCount}} indikator Sehat</strong>. Fokuskan perbaikan pada rasio berwarna merah untuk meningkatkan ketahanan finansial keluarga.
      </div>
      
      <div class="section-title">04. Analisa Indikator Vital (Bagian 1)</div>
    {{else}}
      <div class="section-title">04. Analisa Indikator Vital (Lanjutan)</div>
    {{/if}}

    <div class="ratio-grid">
      {{#each this.items}}
      <div class="ratio-card">
        <div class="ratio-head">
          <div class="ratio-title">{{this.label}}</div>
          <div class="ratio-badge {{this.cssClass}}">{{this.statusLabel}}</div>
        </div>
        <div class="ratio-val">{{this.valueDisplay}}</div>
        <div style="font-size: 9px; color: var(--secondary); margin-bottom: 8px;">Benchmark: {{this.benchmark}}</div>
        <div class="ratio-rec">
          {{this.recommendation}}
        </div>
      </div>
      {{/each}}
    </div>

    <div class="page-footer">
      <div>Generated by KeuanganKu System</div>
      <div>CONFIDENTIAL • Page {{this.pageNumber}} of 3</div>
    </div>

  </div>
  {{/each}}

</body>
</html>
`;