import { generateBaseEmailTemplate } from './base-email.template';

/**
 * Factory penanda HTML untuk email Verifikasi OTP.
 * @param fullName Nama lengkap agen
 * @param otpCode 6-digit kode OTP
 * @param isResend Flag boolean untuk permintaan kirim ulang
 * @param type Jenis verifikasi: 'REGISTER' atau 'LOGIN'
 * @returns String HTML utuh
 */
export const generateOtpEmailTemplate = (
    fullName: string,
    otpCode: string,
    isResend: boolean = false,
    type: 'REGISTER' | 'LOGIN' = 'REGISTER'
): string => {

    // 1. Narasi Cerdas berdasarkan Konteks (Touchpoint)
    const isLogin = type === 'LOGIN';

    const contextTitle = isLogin
        ? (isResend ? 'Pengingat Kode Keamanan Login' : 'Kode Keamanan Akses Portal')
        : (isResend ? 'Langkah Terakhir Aktivitas Registrasi' : 'Selamat Bergabung, Rekan Agen!');

    const greeting = isLogin
        ? `Halo Rekan <strong>${fullName}</strong>, kami mendeteksi permintaan masuk ke akun Anda.`
        : `Halo Rekan <strong>${fullName}</strong>, selamat datang di ekosistem digital KeuanganKu!`;

    const instructions = isLogin
        ? `Gunakan kode rahasia di bawah ini untuk memverifikasi identitas Anda dan melanjutkan ke Dashboard Pro-Agent.`
        : `Langkah kecil lagi untuk mengaktifkan portal perencanaan keuangan Anda. Silakan masukkan kode OTP berikut:`;

    const securityWarning = isLogin
        ? `Jika ini bukan Anda, segera hubungi tim IT kami. Seseorang mungkin mencoba mengakses akun Anda.`
        : `Jangan bagikan kode ini kepada siapa pun, termasuk tim kami. Keamanan data klien Anda dimulai dari keamanan akun Anda.`;

    // 2. Desain Konten (Visual Logic)
    const emailContent = `
        <div style="text-align: left;">
            <h2 style="color: #1e293b; margin-top: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                ${contextTitle}
            </h2>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                ${greeting}
            </p>

            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
                ${instructions}
            </p>
            
            <div style="background-color: #f8fafc; padding: 40px 20px; margin: 30px 0; text-align: center; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: inset 0 2px 4px 0 rgba(0,0,0,0.02);">
                <div style="margin-bottom: 12px; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; font-weight: 800; color: #94a3b8;">
                    Kode Verifikasi Rahasia
                </div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 46px; font-weight: 800; letter-spacing: 14px; color: #2563eb; display: inline-block; margin-left: 14px;">
                    ${otpCode}
                </div>
                <div style="margin-top: 15px; font-size: 12px; color: #64748b;">
                    Berlaku selama <span style="color: #ef4444; font-weight: 700;">5 menit</span>
                </div>
            </div>
            
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 30px;">
                <p style="color: #92400e; font-size: 13px; line-height: 1.5; margin: 0;">
                    <strong>Peringatan Keamanan:</strong> ${securityWarning}
                </p>
            </div>

            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; border-top: 1px solid #f1f5f9; padding-top: 25px;">
                Anda menerima email ini karena adanya aktivitas registrasi atau login pada sistem KeuanganKu menggunakan alamat email ini.
            </p>
        </div>
    `;

    // Bungkus dengan Master Shell (Base Template)
    return generateBaseEmailTemplate(contextTitle, emailContent);
};