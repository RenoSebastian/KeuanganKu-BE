// File: src/common/utils/phone-formatter.util.ts

/**
 * Utility function untuk menyanitasi dan memformat input nomor telepon
 * menjadi format standar internasional (khususnya Indonesia: 62...)
 * yang kompatibel dengan URL API WhatsApp (wa.me).
 * * @param phoneNumber Input string nomor telepon yang masih mentah
 * @returns Nomor telepon yang sudah disanitasi (string) atau null jika tidak valid
 */
export function formatToWhatsAppNumber(phoneNumber?: string | null): string | null {
    // 1. Guard Clause: Jika input kosong, null, atau undefined
    if (!phoneNumber || phoneNumber.trim() === '') {
        return null;
    }

    // 2. Sanitasi Lapis Pertama: Hapus SEMUA karakter selain angka (0-9)
    // Ini secara otomatis akan membuang tanda '+', '-', spasi, atau kurung '()'
    let cleanedNumber = phoneNumber.replace(/\D/g, '');

    // 3. Guard Clause Lapis Kedua: Validasi panjang minimal
    // Nomor HP terkecil yang masuk akal biasanya sekitar 9 digit (misal kode area pendek)
    if (cleanedNumber.length < 9) {
        return null;
    }

    // 4. Normalisasi Prefix (Awalan Nomor)
    // Aplikasi KeuanganKu berfokus pada pasar Indonesia, jadi kita asumsikan prefix default adalah 62
    if (cleanedNumber.startsWith('0')) {
        // Kasus 1: Input "08123456789" -> Diubah menjadi "628123456789"
        cleanedNumber = '62' + cleanedNumber.substring(1);
    } else if (cleanedNumber.startsWith('8')) {
        // Kasus 2: Input langsung "8123456789" (lupa angka 0 atau 62) -> Ditambahkan "62" di depannya
        cleanedNumber = '62' + cleanedNumber;
    }
    // Kasus 3: Jika sudah diawali "62" (misal: "62812...") atau kode negara lain (misal: "65..."),
    // kita biarkan as-is (tidak diubah) karena sudah disanitasi di langkah ke-2.

    // 5. Kembalikan hasil akhir yang sudah steril
    return cleanedNumber;
}