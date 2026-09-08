/**
 * File: src/modules/email/templates/magic-link.template.ts
 * Tanggung Jawab: Merender HTML email profesional untuk alur pemulihan sandi
 * dengan desain Master Shell KeuanganKu.
 */

export function getMagicLinkTemplate(
    userName: string,
    magicLink: string,
    ttlMinutes: number
): string {
    const currentYear = new Date().getFullYear();
    const baseUrl = (process.env.FRONTEND_URL && process.env.FRONTEND_URL.startsWith('http') && !process.env.FRONTEND_URL.includes('localhost'))
      ? process.env.FRONTEND_URL.replace(/\/$/, '')
      : 'https://keuanganku.id';
    const logoUrl = `${baseUrl}/images/logokeuanganku.png`;
    const brandColor = '#2563eb'; // Blue-600
    const bgColor = '#f8fafc';   // Slate-50

    // Konten Utama Email
    const bodyContent = `
    <div style="font-family: 'Inter', sans-serif;">
      <p style="color: #334155; font-size: 16px; margin-top: 0; margin-bottom: 24px;">
        Halo <strong style="color: #0f172a;">${userName}</strong>,
      </p>
      
      <p style="color: #475569; font-size: 15px; margin-bottom: 32px; line-height: 1.6;">
        Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda di platform <strong>KeuanganKu</strong>. 
        Untuk melanjutkan proses otentikasi ini, silakan klik tombol di bawah:
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
        <tr>
          <td align="center">
            <a href="${magicLink}" target="_blank" style="background-color: ${brandColor}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
              Atur Ulang Kata Sandi
            </a>
          </td>
        </tr>
      </table>

      <!-- Box Peringatan Keamanan -->
      <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 18px; border-radius: 4px 12px 12px 4px; margin-bottom: 32px;">
        <p style="color: #9a3412; font-size: 14px; margin: 0; font-weight: 500; line-height: 1.5;">
          <strong>Peringatan Keamanan:</strong><br>
          Tautan ini bersifat rahasia, hanya berlaku untuk 1x penggunaan, dan akan kedaluwarsa secara otomatis dalam <strong>${ttlMinutes} menit</strong>.
        </p>
      </div>

      <!-- Fallback Link -->
      <p style="color: #64748b; font-size: 12px; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        Kendala tombol? Tempel URL ini di browser:
      </p>
      <div style="background-color: #f1f5f9; padding: 12px; border-radius: 8px; border: 1px dashed #cbd5e1; word-break: break-all;">
        <a href="${magicLink}" style="color: ${brandColor}; text-decoration: none; font-size: 12px; line-height: 1.4;">
          ${magicLink}
        </a>
      </div>

      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
        <p style="color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.6; font-style: italic;">
          Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini. Keamanan akun Anda tetap terjaga.
        </p>
      </div>
    </div>
  `;

    // Gabungkan ke dalam Master Shell
    return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pemulihan Kata Sandi - KeuanganKu</title>
        <style>
            body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
            table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
            img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
            table { border-collapse: collapse !important; }
            body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
            @media screen and (max-width: 600px) {
                .container { width: 100% !important; padding: 10px !important; }
                .content { padding: 30px 25px !important; }
                .logo-img { width: 140px !important; }
            }
        </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: ${bgColor}; font-family: 'Inter', system-ui, -apple-system, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bgColor};">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05);">
                        
                        <!-- Header / Logo -->
                        <tr>
                            <td align="center" style="padding: 48px 0 32px 0;">
                                <img src="${logoUrl}" alt="KeuanganKu" width="180" class="logo-img" style="display: block; width: 180px;"/>
                                <div style="margin-top: 16px; height: 2px; width: 32px; background-color: #e2e8f0; display: inline-block;"></div>
                                <p style="margin: 12px 0 0 0; color: #94a3b8; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
                                    Keamanan Portal Agen
                                </p>
                            </td>
                        </tr>

                        <!-- Body Content -->
                        <tr>
                            <td class="content" style="padding: 20px 60px 40px 60px;">
                                ${bodyContent}
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td align="center" style="background-color: #f8fafc; padding: 40px 30px; border-top: 1px solid #f1f5f9;">
                                <p style="margin: 0; font-weight: 800; color: #1e293b; font-size: 14px;">Tim Keamanan KeuanganKu</p>
                                <p style="margin: 4px 0 24px 0; color: #64748b; font-size: 13px;">Melindungi integritas data finansial Anda.</p>
                                
                                <div style="margin-bottom: 24px;">
                                    <a href="#" style="color: ${brandColor}; text-decoration: none; font-size: 13px; font-weight: 600;">Dashboard</a>
                                    <span style="color: #cbd5e1; margin: 0 8px;">&bull;</span>
                                    <a href="#" style="color: ${brandColor}; text-decoration: none; font-size: 13px; font-weight: 600;">Bantuan</a>
                                </div>
                                
                                <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.6;">
                                    &copy; ${currentYear} <strong>Geocitra KeuanganKu System</strong>.<br>
                                    Jakarta, Indonesia. Hak Cipta Dilindungi.
                                </p>
                            </td>
                        </tr>
                    </table>

                    <!-- Sub-footer -->
                    <table border="0" cellpadding="0" cellspacing="0" width="600" style="margin-top: 24px;">
                        <tr>
                            <td align="center" style="color: #94a3b8; font-size: 12px;">
                                <p>Butuh bantuan cepat? Hubungi <a href="mailto:hello@keuanganku.id" style="color: ${brandColor}; text-decoration: none; font-weight: 700;">hello@keuanganku.id</a></p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;
}