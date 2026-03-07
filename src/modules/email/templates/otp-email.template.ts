import { generateBaseEmailTemplate } from './base-email.template';

/**
 * Factory penanda HTML untuk email Verifikasi OTP.
 * Menghasilkan template yang utuh (sudah dibungkus oleh base template).
 * * @param fullName Nama lengkap agen
 * @param otpCode 6-digit kode OTP
 * @param isResend Flag boolean, true jika ini adalah permintaan kirim ulang
 * @returns String HTML utuh yang siap dikirim via SMTP
 */
export const generateOtpEmailTemplate = (
    fullName: string,
    otpCode: string,
    isResend: boolean = false
): string => {
    // Determinasi narasi berdasarkan status pengiriman
    const title = isResend
        ? 'Kirim Ulang: Verifikasi Registrasi KeuanganKu'
        : 'Verifikasi Registrasi Agen KeuanganKu';

    const introText = isResend
        ? 'Sesuai permintaan Anda, ini adalah pengingat untuk kode verifikasi OTP Anda. Kode ini tetap akan hangus dalam waktu <strong>5 menit</strong> sejak pendaftaran awal.'
        : 'Terima kasih telah mendaftar di portal SaaS KeuanganKu. Berikut adalah kode verifikasi OTP Anda. Kode ini akan hangus dalam waktu <strong>5 menit</strong>.';

    const emailContent = `
    <h2 style="color: #0d9488; margin-top: 0; font-size: 24px;">${title}</h2>
    <p style="color: #374151; font-size: 16px; line-height: 1.5;">Halo, <strong>${fullName}</strong>!</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.5;">${introText}</p>
    
    <div style="background-color: #f8fafc; padding: 32px 16px; margin: 32px 0; text-align: center; border-radius: 12px; border: 1px dashed #cbd5e1;">
      <span style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #0f172a; display: inline-block; margin-left: 12px;">
        ${otpCode}
      </span>
    </div>
    
    <p style="color: #64748b; font-size: 14px; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 20px;">
      <strong>Peringatan Keamanan:</strong> Jangan berikan kode ini kepada siapa pun. Jika Anda tidak merasa melakukan pendaftaran di sistem KeuanganKu, abaikan email ini. Keamanan data Anda adalah prioritas kami.
    </p>
  `;

    // Bungkus konten dinamis ke dalam Master Template
    return generateBaseEmailTemplate(title, emailContent);
};