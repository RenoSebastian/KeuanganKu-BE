/**
 * Utility HTML Template Generator
 * Pattern: Polymorphism & Pure Fabrication (GRASP)
 * Menyediakan struktur dasar email yang konsisten. 
 * Membungkus konten dinamis (bodyContent) ke dalam layout standar KeuanganKu.
 */

export const generateBaseEmailTemplate = (
    title: string,
    bodyContent: string,
): string => {
    const currentYear = new Date().getFullYear();

    // URL Logo dapat diganti dengan URL absolut menuju cloud storage (S3/GCS) 
    // atau endpoint statis backend Anda (contoh: https://api.domain.com/uploads/logokeuanganku.png)
    const logoUrl = 'https://via.placeholder.com/150x40?text=KeuanganKu+Logo';
    const primaryColor = '#0d9488'; // Warna brand utama (Teal)

    return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        /* CSS Reset Dasar untuk Klien Email */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f7f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f7f6; padding: 20px 0;">
        <tr>
          <td align="center">
            
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
              
              <tr>
                <td align="center" style="background-color: ${primaryColor}; padding: 30px 20px;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px;">KeuanganKu</h1>
                </td>
              </tr>
              
              <tr>
                <td style="padding: 40px 30px; color: #333333; line-height: 1.6; font-size: 16px;">
                  ${bodyContent}
                </td>
              </tr>
              
              <tr>
                <td align="center" style="background-color: #f9fafb; padding: 20px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #6b7280; font-size: 13px;">
                    &copy; ${currentYear} KeuanganKu System. Hak Cipta Dilindungi.
                  </p>
                  <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px; font-style: italic;">
                    Email ini dihasilkan secara otomatis oleh sistem. Mohon untuk tidak membalas email ini karena kotak masuk tidak dipantau.
                  </p>
                </td>
              </tr>
              
            </table>
            </td>
        </tr>
      </table>
      
    </body>
    </html>
  `;
};