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

const ASSET_BASE_PATH = path.join(process.cwd(), 'src/assets/images');

const assets = {
  logoMaxiPro: getImageBase64(path.join(ASSET_BASE_PATH, 'logokeuanganku.png')),
  headerImg1: getImageBase64(path.join(ASSET_BASE_PATH, 'rancanganggaran1.webp')),
  headerImg2: getImageBase64(path.join(ASSET_BASE_PATH, 'rancanganggaran2.webp'))
};

/**
 * ------------------------------------------------------------------
 * 2. VIEW LAYER: HTML TEMPLATE (PREMIUM DESIGN + ANTI-SPLIT)
 * ------------------------------------------------------------------
 */
export const budgetReportTemplate = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Budget Plan Report - Keuanganku</title>
  <style>
    :root {
      --primary: #0f172a;      /* Deep Slate */
      --accent: #0d9488;       /* Teal 600 */
      --secondary: #64748b;    /* Slate 500 */
      --text-main: #334155;    /* Slate 700 */
      --border: #f1f5f9;       /* Slate 100 */
      --bg-light: #f8fafc;     /* Slate 50 */
      --white: #ffffff;
      
      /* Allocation Colors */
      --c-productive: #0ea5e9;
      --c-consumptive: #f43f5e;
      --c-insurance: #8b5cf6;
      --c-saving: #10b981;
      --c-living: #f59e0b;

      --page-width: 210mm;
      --page-height: 297mm;
    }

    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; }

    body {
      margin: 0; padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: var(--text-main);
      line-height: 1.5;
      background-color: #f1f5f9;
    }

    .page {
      width: var(--page-width);
      min-height: var(--page-height);
      background: var(--white);
      margin: 0 auto;
      padding: 15mm;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    @media print {
      body { background: none; }
      .page { margin: 0; box-shadow: none; page-break-after: always; }
    }

    /* --- ANTI-SPLIT LOGIC --- */
    .section-group {
      page-break-inside: avoid; /* Mencegah judul terpisah dari konten */
      break-inside: avoid;
      display: block;
      width: 100%;
      margin-bottom: 30px;
    }

    /* --- HEADER DESIGN --- */
    .header-grid {
      display: grid;
      grid-template-columns: 2.2fr 1fr;
      grid-template-rows: 120px 80px;
      gap: 12px;
      margin-bottom: 35px;
    }

    .h-title-box {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: var(--white);
      padding: 30px;
      border-radius: 24px 4px 24px 4px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .main-heading {
      font-size: 36px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -1px;
      line-height: 1;
    }

    .sub-heading {
      text-transform: uppercase;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 3px;
      color: var(--accent);
      margin-bottom: 8px;
    }

    .h-image-right-top {
      background: url('${assets.headerImg1}') center/cover no-repeat;
      border-radius: 4px 24px 4px 24px;
    }

    .h-image-left-bottom {
      background: url('${assets.headerImg2}') center/cover no-repeat;
      border-radius: 4px 24px 4px 24px;
    }

    .h-brand-box {
      background: var(--white);
      border: 1.5px solid var(--border);
      border-radius: 24px 4px 24px 4px;
      padding: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-maxipro { height: 50px; width: auto; }

    /* --- SECTIONS --- */
    .section-header {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
      page-break-after: avoid; /* Double security */
    }

    .section-number {
      background: var(--primary);
      color: var(--white);
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      margin-right: 10px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* --- INFO CARDS --- */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .card {
      background: var(--bg-light);
      border-radius: 16px;
      padding: 20px;
      border: 1px solid var(--border);
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(0,0,0,0.03);
    }

    .info-row:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }

    .label { font-size: 11px; color: var(--secondary); font-weight: 500; }
    .value { font-size: 12px; font-weight: 700; color: var(--primary); }

    .income-highlight {
      background: var(--white);
      padding: 12px;
      border-radius: 12px;
      margin-top: 10px;
      border: 1px solid var(--accent);
    }

    .income-highlight .label { color: var(--accent); font-weight: 700; }
    .income-highlight .value { font-size: 16px; color: var(--accent); }

    /* --- ALLOCATION --- */
    .alloc-item {
      display: flex;
      align-items: center;
      padding: 15px 20px;
      margin-bottom: 12px;
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 14px;
    }

    .alloc-bullet {
      width: 12px;
      height: 12px;
      border-radius: 4px;
      margin-right: 15px;
    }

    .alloc-info { flex: 1; }
    .alloc-name { font-size: 12px; font-weight: 700; color: var(--primary); }
    .alloc-desc { font-size: 10px; color: var(--secondary); margin-top: 2px; }
    .alloc-value { font-size: 14px; font-weight: 800; color: var(--primary); font-family: 'Courier New', Courier, monospace; }

    /* --- SUMMARY --- */
    .summary-card {
      background: linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%);
      border: 1.5px solid #bae6fd;
      border-radius: 20px;
      padding: 25px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }

    .summary-item { display: flex; flex-direction: column; }
    .summary-label { font-size: 10px; font-weight: 700; color: var(--secondary); text-transform: uppercase; margin-bottom: 5px; }
    .summary-value { font-size: 20px; font-weight: 800; color: var(--primary); }
    .summary-value.highlight { color: var(--accent); }

    /* --- FOOTER --- */
    .footer {
      margin-top: auto;
      padding-top: 20px;
      border-top: 1.5px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .footer-text { font-size: 10px; color: var(--secondary); font-weight: 500; }
    .page-number {
      background: var(--bg-light);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
      color: var(--secondary);
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header-grid">
      <div class="h-title-box">
        <div class="sub-heading">Personal Wealth Management</div>
        <h1 class="main-heading">Budget Plan</h1>
      </div>
      <div class="h-image-right-top"></div>
      <div class="h-image-left-bottom"></div>
      <div class="h-brand-box">
        <img src="${assets.logoMaxiPro}" class="logo-maxipro" alt="Keuanganku">
      </div>
    </div>

    <!-- Bagian 1 & 2 (Grid Data) -->
    <div class="section-group">
      <div class="grid-2">
        <!-- Informasi Klien -->
        <section>
          <div class="section-header">
            <div class="section-number">1</div>
            <div class="section-title">Informasi Klien</div>
          </div>
          <div class="card">
            <div class="info-row"><span class="label">NAMA LENGKAP</span><span class="value">{{user.name}}</span></div>
            <div class="info-row"><span class="label">USIA</span><span class="value">{{user.age}} Tahun</span></div>
            <div class="info-row"><span class="label">PERIODE</span><span class="value">{{period}}</span></div>
            <div class="info-row"><span class="label">DIHASILKAN PADA</span><span class="value">{{createdAt}}</span></div>
          </div>
        </section>

        <!-- Arus Kas -->
        <section>
          <div class="section-header">
            <div class="section-number">2</div>
            <div class="section-title">Arus Kas Masuk</div>
          </div>
          <div class="card">
            <div class="info-row"><span class="label">PENGHASILAN TETAP</span><span class="value">{{income.fixed}}</span></div>
            <div class="info-row"><span class="label">PENGHASILAN VARIABEL</span><span class="value">{{income.variable}}</span></div>
            <div class="income-highlight">
              <div class="info-row" style="border:none">
                  <span class="label">TOTAL PENGHASILAN</span>
                  <span class="value">{{income.total}}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Bagian 3 (Alokasi) -->
    <div class="section-group">
      <section>
        <div class="section-header">
          <div class="section-number">3</div>
          <div class="section-title">Alokasi Anggaran Ideal (Metode 45/20/15/10/10)</div>
        </div>
        
        <div class="card" style="padding: 10px; background: transparent; border:none">
          <div class="alloc-item">
            <div class="alloc-bullet" style="background: var(--c-living)"></div>
            <div class="alloc-info">
              <div class="alloc-name">Biaya Hidup & Gaya Hidup</div>
              <div class="alloc-desc">Alokasi maksimal 45% untuk kebutuhan harian & hiburan</div>
            </div>
            <div class="alloc-value">{{allocations.living.value}}</div>
          </div>

          <div class="alloc-item">
            <div class="alloc-bullet" style="background: var(--c-productive)"></div>
            <div class="alloc-info">
              <div class="alloc-name">Cicilan Utang Produktif</div>
              <div class="alloc-desc">Alokasi maksimal 20% untuk aset yang bertumbuh</div>
            </div>
            <div class="alloc-value">{{allocations.productive.value}}</div>
          </div>

          <div class="alloc-item">
            <div class="alloc-bullet" style="background: var(--c-consumptive)"></div>
            <div class="alloc-info">
              <div class="alloc-name">Cicilan Utang Konsumtif</div>
              <div class="alloc-desc">Batas aman maksimal 15% dari penghasilan tetap</div>
            </div>
            <div class="alloc-value">{{allocations.consumptive.value}}</div>
          </div>

          <div class="alloc-item">
            <div class="alloc-bullet" style="background: var(--c-saving)"></div>
            <div class="alloc-info">
              <div class="alloc-name">Tabungan & Investasi</div>
              <div class="alloc-desc">Minimal 10% untuk dana darurat & masa depan</div>
            </div>
            <div class="alloc-value">{{allocations.saving.value}}</div>
          </div>

          <div class="alloc-item">
            <div class="alloc-bullet" style="background: var(--c-insurance)"></div>
            <div class="alloc-info">
              <div class="alloc-name">Premi Asuransi & Proteksi</div>
              <div class="alloc-desc">Minimal 10% untuk perlindungan risiko finansial</div>
            </div>
            <div class="alloc-value">{{allocations.insurance.value}}</div>
          </div>
        </div>
      </section>
    </div>

    <!-- Bagian 4 (Kesimpulan) -->
    <div class="section-group">
      <section>
        <div class="section-header">
          <div class="section-number">4</div>
          <div class="section-title">Ringkasan Eksekutif</div>
        </div>
        <div class="summary-card">
          <div class="summary-item">
            <div class="summary-label">Total Anggaran Dialokasikan</div>
            <div class="summary-value">{{summary.totalBudget}}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Potensi Surplus Investasi</div>
            <div class="summary-value highlight">{{summary.totalSurplus}}</div>
          </div>
        </div>
      </section>
    </div>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-text">
        <strong>Keuanganku</strong> &bull; Laporan Perencanaan Anggaran Mandiri
      </div>
      <div class="page-number">Page 1 of 1</div>
    </footer>
  </div>
</body>
</html>
`;