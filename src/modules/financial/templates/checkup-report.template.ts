// src/modules/financial/templates/checkup-report.template.ts

export const checkupReportTemplate = `
<!DOCTYPE html>
<html>
<head>
  <style>
    /* RESET & BASE */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
    body { font-family: 'Inter', sans-serif; color: #1e293b; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
    
    /* LAYOUT UTILS */
    .page { padding: 40px; position: relative; height: 100vh; box-sizing: border-box; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .mb-4 { margin-bottom: 16px; }
    .mb-8 { margin-bottom: 32px; }
    .text-right { text-align: right; }
    
    /* COMPONENTS */
    .header { border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px; }
    .brand-logo { font-size: 24px; font-weight: 800; color: #0f172a; }
    .report-meta { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
    
    .score-card { 
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); 
      color: white; padding: 30px; border-radius: 16px; 
      display: flex; align-items: center; justify-content: space-between;
    }
    .score-circle {
      width: 80px; height: 80px; border-radius: 50%;
      border: 6px solid {{scoreColor}};
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; font-weight: 800;
    }
    
    .section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-bottom: 15px; border-left: 4px solid #0f172a; padding-left: 10px; }
    
    .ratio-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .ratio-card { 
      border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; 
      background: #fff; page-break-inside: avoid;
    }
    .ratio-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .ratio-value { font-size: 18px; font-weight: 800; margin: 5px 0; color: #0f172a; }
    .ratio-badge { 
      display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 8px; 
      border-radius: 99px; text-transform: uppercase;
    }
    
    /* DYNAMIC COLORS via Handlebars */
    .bg-green { background-color: #dcfce7; color: #166534; }
    .bg-yellow { background-color: #fef9c3; color: #854d0e; }
    .bg-red { background-color: #fee2e2; color: #991b1b; }

    .summary-box { background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px dashed #cbd5e1; }
    .summary-text { font-size: 12px; line-height: 1.6; color: #475569; }

    .footer { position: absolute; bottom: 30px; left: 40px; right: 40px; border-top: 1px solid #f1f5f9; padding-top: 10px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header flex justify-between items-center">
      <div>
        <div class="brand-logo">PAM JAYA</div>
        <div style="font-size: 12px; color: #64748b;">Financial Health Checkup</div>
      </div>
      <div class="text-right">
        <div class="report-meta">Prepared For</div>
        <div style="font-weight: 700; font-size: 14px;">{{userName}}</div>
        <div class="report-meta" style="margin-top: 5px;">Date: {{checkDate}}</div>
      </div>
    </div>

    <div class="score-card mb-8">
      <div>
        <div style="font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px;">Overall Health Score</div>
        <div style="font-size: 32px; font-weight: 800; margin: 5px 0;">{{globalStatus}}</div>
        <div style="font-size: 11px; opacity: 0.7;">Net Worth: {{netWorth}}</div>
      </div>
      <div class="score-circle">
        {{score}}
      </div>
    </div>

    <div class="mb-8">
      <div class="section-title">Executive Summary</div>
      <div class="summary-box">
        <p class="summary-text">
          Berdasarkan analisa sistem, kondisi keuangan Anda saat ini berstatus <strong>{{globalStatus}}</strong>. 
          Anda memiliki surplus bulanan sebesar <strong>{{monthlySurplus}}</strong> yang dapat dioptimalkan.
          Terdapat <strong>{{healthyCount}}</strong> indikator sehat dan <strong>{{warningCount}}</strong> indikator yang memerlukan perhatian khusus.
        </p>
      </div>
    </div>

    <div class="section-title">Detailed Analysis (8 Ratios)</div>
    <div class="ratio-grid">
      {{#each ratios}}
      <div class="ratio-card">
        <div class="flex justify-between items-center mb-2">
          <div class="ratio-label">{{this.label}}</div>
          <div class="ratio-badge {{this.cssClass}}">{{this.statusLabel}}</div>
        </div>
        <div class="ratio-value">{{this.valueDisplay}}</div>
        <div style="font-size: 10px; color: #64748b;">Target: {{this.benchmark}}</div>
        <div style="margin-top: 8px; font-size: 10px; line-height: 1.4; color: #475569; border-top: 1px solid #f1f5f9; padding-top: 8px;">
          {{this.recommendation}}
        </div>
      </div>
      {{/each}}
    </div>

    <div class="footer">
      <div>Generated by KeuanganKu AI Engine</div>
      <div>Confidential Document</div>
    </div>
  </div>
</body>
</html>
`;