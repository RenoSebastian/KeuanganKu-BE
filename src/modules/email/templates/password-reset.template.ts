/**
 * File: src/modules/email/templates/password-reset-otp.template.ts
 * Desain: Fokus Keamanan & Instruksi Jelas (Anti-Fraud)
 */

export const getPasswordResetOtpTemplate = (
    userName: string,
    otpCode: string,
    ttlMinutes: number = 5,
): string => {
    const currentYear = new Date().getFullYear();
    const baseUrl = (process.env.FRONTEND_URL && process.env.FRONTEND_URL.startsWith('http') && !process.env.FRONTEND_URL.includes('localhost'))
      ? process.env.FRONTEND_URL.replace(/\/$/, '')
      : 'https://keuanganku.id';
    const logoUrl = `${baseUrl}/images/logokeuanganku.png`;
    const brandColor = '#2563eb';
    const bgColor = '#f8fafc';

    const bodyContent = `
    <div style="font-family: 'Inter', sans-serif;">
      <p style="color: #334155; font-size: 16px; margin-top: 0; margin-bottom: 24px;">
        Halo <strong style="color: #0f172a;">${userName}</strong>,
      </p>
      
      <p style="color: #475569; font-size: 15px; margin-bottom: 32px; line-height: 1.6;">
        Kami menerima permintaan untuk pengaturan ulang kata sandi akun KeuanganKu Anda. 
        Gunakan kode OTP di bawah ini untuk memverifikasi identitas Anda:
      </p>

      <!-- OTP BOX -->
      <div style="background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 32px;">
        <span style="display: block; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">
          Kode Verifikasi (OTP)
        </span>
        <span style="display: block; font-size: 42px; font-weight: 800; color: #0f172a; letter-spacing: 12px; font-family: 'Courier New', Courier, monospace;">
          ${otpCode}
        </span>
        <p style="color: #ef4444; font-size: 13px; margin: 16px 0 0 0; font-weight: 600;">
          Berlaku hingga ${ttlMinutes} menit kedepan.
        </p>
      </div>

      <!-- SECURITY NARRATION BOX -->
      <div style="background-color: #fff7ed; border-radius: 12px; padding: 20px; border: 1px solid #ffedd5; margin-bottom: 32px;">
        <h4 style="color: #9a3412; margin: 0 0 10px 0; font-size: 14px; font-weight: 700; text-transform: uppercase;">
          ⚠️ Protokol Keamanan Penting
        </h4>
        <ul style="margin: 0; padding-left: 20px; color: #c2410c; font-size: 13px; line-height: 1.6;">
          <li style="margin-bottom: 8px;">
            <strong>Jangan Berikan Kode Ini:</strong> Staf atau Admin <strong>KeuanganKu tidak akan pernah</strong> meminta kode OTP Anda melalui telepon, chat, atau media sosial apa pun.
          </li>
          <li style="margin-bottom: 8px;">
            <strong>Waspada Penipuan:</strong> Segera hubungi kami jika ada pihak yang mengaku dari KeuanganKu dan meminta data pribadi Anda.
          </li>
          <li>
            <strong>Bukan Aktivitas Anda?</strong> Jika Anda tidak merasa melakukan permintaan ini, silakan <strong>abaikan email ini</strong> dengan aman. Akun Anda tetap terlindungi selama kode ini tidak dibagikan.
          </li>
        </ul>
      </div>

      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
        <p style="color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.6; font-style: italic;">
          Sistem kami mendeteksi permintaan ini dari alamat IP yang terkait dengan akun Anda. Jika Anda ragu, segera hubungi Pusat Bantuan Agen.
        </p>
      </div>
    </div>
  `;

    return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OTP Pemulihan - KeuanganKu</title>
        <style>
            body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
            table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
            img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
            table { border-collapse: collapse !important; }
            body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
            @media screen and (max-width: 600px) {
                .container { width: 100% !important; padding: 10px !important; }
                .content { padding: 40px 25px !important; }
                .logo-img { width: 140px !important; }
            }
        </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: ${bgColor}; font-family: 'Inter', system-ui, -apple-system, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bgColor};">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05);">
                        
                        <tr>
                            <td align="center" style="padding: 48px 0 32px 0;">
                                <img src="${logoUrl}" alt="KeuanganKu" width="180" class="logo-img" style="display: block; width: 180px;"/>
                                <div style="margin-top: 16px; height: 2px; width: 32px; background-color: #e2e8f0; display: inline-block;"></div>
                                <p style="margin: 12px 0 0 0; color: #94a3b8; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
                                    Portal Keamanan Agen
                                </p>
                            </td>
                        </tr>

                        <tr>
                            <td class="content" style="padding: 20px 60px 40px 60px;">
                                ${bodyContent}
                            </td>
                        </tr>

                        <tr>
                            <td align="center" style="background-color: #f8fafc; padding: 40px 30px; border-top: 1px solid #f1f5f9;">
                                <p style="margin: 0; font-weight: 800; color: #1e293b; font-size: 14px;">Tim Analis KeuanganKu</p>
                                <p style="margin: 4px 0 24px 0; color: #64748b; font-size: 13px;">Memberikan Anda kendali penuh atas data finansial.</p>
                                
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

                    <table border="0" cellpadding="0" cellspacing="0" width="600" style="margin-top: 24px;">
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