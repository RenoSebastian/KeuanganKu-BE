  /**
   * Utility HTML Template Generator - Master Shell
   * Design: Modern SaaS / Enterprise Professional
   */

  export const generateBaseEmailTemplate = (
    title: string,
    bodyContent: string,
  ): string => {
    const currentYear = new Date().getFullYear();

    /**
     * PENTING: Gambar di email HARUS menggunakan URL absolut (https://...)
     * Karena file ada di src/assets/images/logokeuanganku.png, pastikan saat deploy
     * file tersebut bisa diakses secara publik, contoh: https://api.keuanganku.id/static/logokeuanganku.png
     */
    const logoUrl = 'https://keuanganku.id/images/logokeuanganku.png';
    const brandColor = '#2563eb'; // Blue-600 (Selaras dengan UI Dashboard)
    const bgColor = '#f8fafc';   // Slate-50 (Latar belakang yang bersih)

    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
              /* Reset dasar untuk memastikan tampilan konsisten di Gmail, Outlook, iOS */
              body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
              table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
              img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
              table { border-collapse: collapse !important; }
              body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }

              /* Menangani link agar tidak berubah warna otomatis di iOS/MacOS */
              a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }

              @media screen and (max-width: 600px) {
                  .container { width: 100% !important; padding: 10px !important; }
                  .content { padding: 30px 20px !important; }
                  .logo-img { width: 150px !important; }
              }
          </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: ${bgColor}; font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bgColor};">
              <tr>
                  <td align="center" style="padding: 40px 0;">
                      
                      <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
                          
                          <tr>
                              <td align="center" style="padding: 45px 0 25px 0;">
                                  <div style="display: block; padding: 0 24px;">
                                      <img 
                                          src="${logoUrl}" 
                                          alt="KeuanganKu Logo" 
                                          width="180" 
                                          class="logo-img"
                                          style="display: block; width: 180px; max-width: 180px; height: auto; border: 0;"
                                      />
                                      <div style="margin-top: 12px; height: 1px; width: 40px; background-color: #e2e8f0; display: inline-block;"></div>
                                      <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
                                          Portal Agen Profesional
                                      </p>
                                  </div>
                              </td>
                          </tr>

                          <tr>
                              <td class="content" style="padding: 20px 60px 50px 60px; color: #334155; line-height: 1.8; font-size: 16px;">
                                  ${bodyContent}
                              </td>
                          </tr>

                          <tr>
                              <td align="center" style="background-color: #f8fafc; padding: 40px 30px; border-top: 1px solid #f1f5f9;">
                                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                      <tr>
                                          <td align="center" style="color: #64748b; font-size: 13px; line-height: 1.6;">
                                              <p style="margin: 0; font-weight: 800; color: #1e293b; font-size: 14px;">Tim Analis KeuanganKu</p>
                                              <p style="margin: 4px 0 20px 0;">Membantu Anda mengelola masa depan finansial klien dengan data.</p>
                                              
                                              <div style="margin-bottom: 20px;">
                                                  <a href="#" style="display: inline-block; margin: 0 8px; color: ${brandColor}; text-decoration: none; font-weight: 600;">Dashboard</a>
                                                  <span style="color: #cbd5e1;">&bull;</span>
                                                  <a href="#" style="display: inline-block; margin: 0 8px; color: ${brandColor}; text-decoration: none; font-weight: 600;">Pusat Edukasi</a>
                                                  <span style="color: #cbd5e1;">&bull;</span>
                                                  <a href="#" style="display: inline-block; margin: 0 8px; color: ${brandColor}; text-decoration: none; font-weight: 600;">Bantuan</a>
                                              </div>
                                              
                                              <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${currentYear} <strong>Geocitra KeuanganKu System</strong>. Hak Cipta Dilindungi.</p>
                                              <p style="margin: 12px 0 0 0; font-size: 11px; color: #cbd5e1; font-style: italic; max-width: 400px;">
                                                  Email ini dihasilkan secara otomatis oleh sistem keamanan kami. Mohon tidak membalas langsung ke alamat ini.
                                              </p>
                                          </td>
                                      </tr>
                                  </table>
                              </td>
                          </tr>
                          
                      </table>
                      <table border="0" cellpadding="0" cellspacing="0" width="600" style="margin-top: 25px;">
                          <tr>
                              <td align="center" style="color: #94a3b8; font-size: 12px;">
                                  <p>Kendala akses? Hubungi tim support kami di <a href="mailto:hello@keuanganku.id" style="color: ${brandColor}; text-decoration: none; font-weight: 700;">hello@keuanganku.id</a></p>
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