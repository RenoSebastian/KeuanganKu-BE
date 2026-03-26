/**
 * Fungsi murni (Pure Function) untuk merender HTML email.
 * Memisahkan logika rendering visual dari layanan pengiriman email (Low Coupling).
 */
export const getPasswordResetOtpTemplate = (
    userName: string,
    otpCode: string,
    ttlMinutes: number = 5,
): string => {
    return `
  <!DOCTYPE html>
  <html lang="id">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kode Pemulihan Kata Sandi - KeuanganKu</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa; color: #333333;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 0;">
      <tr>
        <td align="center">
          <table width="100%" maxWidth="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden;">
            
            <tr>
              <td style="background-color: #0F172A; padding: 30px 40px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 1px;">KeuanganKu</h1>
              </td>
            </tr>

            <tr>
              <td style="padding: 40px 40px 30px;">
                <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5;">Halo, <strong>${userName}</strong>,</p>
                <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5;">Kami menerima permintaan untuk mereset kata sandi pada akun KeuanganKu Anda. Silakan gunakan kode OTP (One-Time Password) di bawah ini untuk melanjutkan proses pemulihan:</p>
                
                <div style="background-color: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 6px; padding: 24px; text-align: center; margin: 30px 0;">
                  <span style="display: inline-block; font-size: 36px; font-weight: 700; color: #0F172A; letter-spacing: 8px;">
                    ${otpCode}
                  </span>
                </div>

                <p style="margin: 0 0 10px; font-size: 14px; color: #DC2626; font-weight: 600; text-align: center;">
                  PENTING: Kode ini hanya berlaku selama ${ttlMinutes} menit.
                </p>
                <p style="margin: 0 0 30px; font-size: 14px; line-height: 1.5; color: #64748B; text-align: center;">
                  Jangan pernah membagikan kode ini kepada siapapun, termasuk staf atau admin KeuanganKu.
                </p>

                <div style="border-top: 1px solid #E2E8F0; padding-top: 20px;">
                  <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94A3B8;">
                    <strong>Keamanan Akun:</strong> Jika Anda tidak merasa meminta pengaturan ulang kata sandi, abaikan email ini. Kata sandi dan akun Anda akan tetap aman selama Anda tidak membagikan kode OTP di atas.
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <td style="background-color: #F8FAFC; padding: 20px 40px; text-align: center; border-top: 1px solid #E2E8F0;">
                <p style="margin: 0; font-size: 12px; color: #64748B;">
                  &copy; ${new Date().getFullYear()} KeuanganKu. Sistem Analitik Finansial.
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