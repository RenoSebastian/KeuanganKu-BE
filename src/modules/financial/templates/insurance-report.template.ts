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
    // Menggunakan gambar header default (bisa diganti gambar asuransi spesifik)
    headerImg1: getImageBase64(path.join(ASSET_BASE_PATH, 'financialcheckup1.webp')),
    headerImg2: getImageBase64(path.join(ASSET_BASE_PATH, 'financialcheckup2.webp'))
};

export const insuranceReportTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Insurance Protection Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;1,600&display=swap');
    
    :root {
      --primary: #0e7490;      /* Cyan 700 - Brand Base */
      --primary-dark: #155e75; 
      --secondary: #64748b;    
      --dark: #0f172a;         
      --border: #e2e8f0;       
      --bg-soft: #fff1f2;      /* Red/Rose Tint for Insurance */
      --accent: #0044ff;       /* Rose 600 */
      --page-width: 210mm;
      --page-height: 297mm;
      --page-padding: 15mm;
    }

    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; color: var(--dark); background-color: #525252; }

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
    .text-accent { color: var(--accent); }

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
      background-color: var(--dark); color: white;
      display: flex; align-items: center; justify-content: center; gap: 10px;
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
      border-bottom: 2px solid var(--border); padding-bottom: 6px; margin-bottom: 16px; margin-top: 24px;
    }
    .section-title:first-child { margin-top: 0; }

    /* --- PROFILE CARD --- */
    .profile-card {
      background: #fafafa; border: 1px solid var(--border);
      border-radius: 12px; padding: 16px; margin-bottom: 24px;
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
    .meta-row label { color: var(--secondary); }
    .meta-row span { color: var(--dark); font-weight: 700; }

    /* --- BREAKDOWN CARDS --- */
    .breakdown-card {
      border: 1px solid var(--border); border-radius: 12px; padding: 16px;
      background: white; margin-bottom: 20px;
    }
    .bd-header {
      font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--secondary);
      margin-bottom: 12px; letter-spacing: 1px;
    }
    .bd-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 0; border-bottom: 1px dashed var(--border); font-size: 11px;
    }
    .bd-row:last-child { border-bottom: none; }
    .bd-val { font-family: monospace; font-weight: 700; font-size: 13px; color: var(--dark); }

    /* --- CALCULATION VISUAL --- */
    .calc-visual {
      background: linear-gradient(to right, #fff1f2, #fff);
      border-left: 4px solid var(--accent);
      padding: 20px; border-radius: 8px; margin-bottom: 24px;
    }
    .calc-row {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;
    }
    .calc-row.total {
      margin-top: 12px; padding-top: 12px; border-top: 2px solid var(--border);
    }
    .calc-label { font-size: 11px; font-weight: 600; color: var(--secondary); }
    .calc-amount { font-size: 16px; font-weight: 800; font-family: monospace; color: var(--dark); }
    .calc-amount.big { font-size: 20px; color: var(--accent); }

    /* --- RESULT BOX --- */
    .result-box {
      background: linear-gradient(135deg, #881337 0%, #be123c 100%); /* Rose 900 -> 700 */
      color: white; padding: 30px; border-radius: 16px; text-align: center;
      margin-top: 10px; margin-bottom: 30px;
      box-shadow: 0 10px 20px -5px rgba(190, 18, 60, 0.3);
    }
    .rb-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-bottom: 8px; }
    .rb-amount { font-size: 38px; font-weight: 800; margin-bottom: 12px; font-family: monospace; }
    .rb-desc { font-size: 11px; opacity: 0.95; line-height: 1.5; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; }

    .kosong{
    margin-top: 30px; margin-bottom: 40px;
    }

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
        <h1 class="main-heading">Insurance Plan</h1>
      </div>
      <div class="h-image-right-top"></div>
      <div class="h-image-left-bottom"></div>
      <div class="h-brand-box">
        <img src="${assets.logoMaxiPro}" class="logo-maxipro" alt="Logo">
        <span class="brand-text">KEUANGANKU</span>
      </div>
    </div>

    <div class="section-title">01. Profil Risiko & Tanggungan</div>
    <div class="profile-card">
      <div>
        <div class="meta-row"><label>Nama Pemohon</label> <span>{{user.name}}</span></div>
        <div class="meta-row"><label>Jenis Proteksi</label> <span style="color:var(--accent);">{{plan.typeLabel}}</span></div>
        <div class="meta-row"><label>Jumlah Tanggungan</label> <span>{{plan.dependentCount}} Orang</span></div>
        <div class="meta-row"><label>Tanggal Laporan</label> <span>{{createdAt}}</span></div>
      </div>
      <div>
        <div class="meta-row"><label>Pengeluaran Bulanan</label> <span>{{plan.monthlyExpense}}</span></div>
        <div class="meta-row"><label>Durasi Proteksi</label> <span>{{plan.protectionDuration}} Tahun</span></div>
        <div class="meta-row"><label>Sisa Hutang Berjalan</label> <span>{{plan.existingDebt}}</span></div>
        <div class="meta-row"><label>UP Asuransi Saat Ini</label> <span>{{plan.existingCoverage}}</span></div>
      </div>
    </div>

    <div class="section-title">02. Analisa Kebutuhan Uang Pertanggungan (UP)</div>
    
    <div class="grid-2">
      <div class="breakdown-card">
        <div class="bd-header" style="color:#0369a1;">A. Income Replacement</div>
        <div style="font-size:10px; color:var(--secondary); margin-bottom:10px; line-height:1.4;">
          Dana yang dibutuhkan keluarga untuk bertahan hidup selama {{plan.protectionDuration}} tahun ke depan jika pencari nafkah tutup usia.
        </div>
        <div class="bd-row">
          <span>Biaya Tahunan</span> <span class="bd-val">{{calc.annualExpense}}</span>
        </div>
        <div class="bd-row">
          <span>Faktor Inflasi/Bunga</span> <span class="bd-val">{{calc.nettRate}}%</span>
        </div>
        <div class="bd-row" style="background:#f0f9ff; margin-top:5px; border:none; padding:8px;">
          <span style="font-weight:700; color:#0369a1;">Total Dana Hidup</span> 
          <span class="bd-val" style="color:#0369a1;">{{calc.incomeReplacementValue}}</span>
        </div>
      </div>

      <div class="breakdown-card">
        <div class="bd-header" style="color:#b91c1c;">B. Debt Clearance</div>
        <div style="font-size:10px; color:var(--secondary); margin-bottom:10px; line-height:1.4;">
          Dana tunai yang wajib tersedia seketika untuk melunasi seluruh sisa hutang agar tidak membebani ahli waris.
        </div>
        <div class="bd-row">
          <span>Sisa Hutang</span> <span class="bd-val">{{plan.existingDebt}}</span>
        </div>
        <div class="bd-row">
          <span>Biaya Final (Pemakaman)</span> <span class="bd-val">Included</span>
        </div>
        <div class="bd-row" style="background:#fef2f2; margin-top:5px; border:none; padding:8px;">
          <span style="font-weight:700; color:#b91c1c;">Total Pelunasan</span> 
          <span class="bd-val" style="color:#b91c1c;">{{calc.debtClearanceValue}}</span>
        </div>
      </div>
    </div>

    <div class="section-title">03. Perhitungan Kekurangan (Gap)</div>
    <div class="calc-visual">
      <div class="calc-row">
        <span class="calc-label">Total Kebutuhan (A + B)</span>
        <span class="calc-amount">{{calc.totalNeeded}}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">Dikurangi: UP Asuransi Saat Ini</span>
        <span class="calc-amount" style="color:#15803d;">- {{plan.existingCoverage}}</span>
      </div>
      <div class="calc-row total">
        <span class="calc-label" style="font-weight:800; color:var(--accent);">KEKURANGAN UP (COVERAGE GAP)</span>
        <span class="calc-amount big">{{calc.coverageGap}}</span>
      </div>
    </div>

    <div class="kosong"></div>
    <div class="kosong"></div>
    <div class="kosong"></div>
    

    <div class="section-title">04. Rekomendasi</div>
    <div class="result-box">
      <div class="rb-label">Nilai Pertanggungan Yang Harus Ditambahkan</div>
      <div class="rb-amount">{{calc.coverageGap}}</div>
      <div class="rb-desc">
        {{plan.recommendation}}
      </div>
    </div>

    <div class="page-footer">
      <div>Generated by KeuanganKu System</div>
      <div>CONFIDENTIAL • Insurance Planning</div>
    </div>

  </div>
</body>
</html>
`;