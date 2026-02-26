// import { PrismaClient, EducationModuleStatus, QuizQuestionType } from '@prisma/client';

// export const educationModulesSeed = [
//     // ==============================================================================
//     // MODUL 1: RAHASIA MENGATUR GAJI BULANAN
//     // Referensi: Formula Financial Calculator (Menu 1 - Atur Anggaran Bulanan)
//     // ==============================================================================
//     {
//         slug: 'rahasia-mengatur-gaji-bulanan',
//         title: 'Rahasia Mengatur Gaji Bulanan: Formula 45/35/10/10',
//         excerpt: 'Jangan biarkan gaji numpang lewat! Pelajari formula alokasi anggaran yang ideal agar cashflow tetap positif dan aset bertumbuh.',
//         categorySlug: 'perencanaan-dasar', // Pastikan kategori ini ada di seed kategori
//         order: 1,
//         status: EducationModuleStatus.PUBLISHED,
//         publishedAt: new Date(),
//         coverImage: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1000', // Placeholder
//         durationMinutes: 10,
//         sections: [
//             {
//                 title: 'Mengapa Gaji Selalu Habis?',
//                 order: 1,
//                 content: `
// # Fenomena "Gaji Numpang Lewat"

// Seringkah Anda merasa gaji habis sebelum akhir bulan? Masalah utamanya seringkali bukan pada *besarnya pendapatan*, melainkan pada **alokasi pengeluaran**.

// Tanpa pos-pos anggaran yang jelas, kita cenderung membelanjakan uang untuk keinginan sesaat (lifestyle) dan melupakan kewajiban masa depan.

// Dalam modul ini, kita akan mempelajari **Formula Anggaran Ideal** yang disesuaikan untuk menjaga kesehatan finansial Anda.
//         `
//             },
//             {
//                 title: 'Formula Sakti: Alokasi Pengeluaran',
//                 order: 2,
//                 content: `
// # Formula Alokasi 45-35-10-10

// Berdasarkan standar perencana keuangan, berikut adalah postur anggaran ideal dari **Penghasilan Tetap** bulanan Anda:

// ### 1. Biaya Hidup & Gaya Hidup (Maksimal 45%)
// Ini adalah pos terbesar. Mencakup makan, transportasi, listrik, pulsa, sekolah anak, hingga *kopi kekinian*.
// * **Aturan Main:** Jika pos ini melebihi 45%, Anda harus melakukan efisiensi (hemat) atau mencari penghasilan tambahan.

// ### 2. Cicilan Utang (Maksimal 35%)
// Total cicilan utang tidak boleh lebih dari 35% gaji. Pos ini dibagi menjadi dua:
// * **Utang Produktif (Maks 20%):** Utang yang nilainya bertambah/menghasilkan, contoh: KPR (Rumah) atau Modal Usaha.
// * **Utang Konsumtif (Maks 15%):** Utang yang nilainya turun, contoh: Cicilan Kendaraan, Kartu Kredit, Paylater.

// ### 3. Premi Asuransi (Minimal 10%)
// Ini adalah "Jaring Pengaman". Dana ini digunakan untuk membayar premi BPJS, Asuransi Kesehatan Swasta, atau Asuransi Jiwa. Jangan dianggap hilang, ini adalah proteksi aset.

// ### 4. Tabungan & Investasi (Minimal 10%)
// Ini adalah pos untuk "Membayar Diri Sendiri di Masa Depan". Digunakan untuk Dana Darurat, Dana Pensiun, dan Tujuan Keuangan lainnya.
//         `
//             },
//             {
//                 title: 'Surplus vs Defisit',
//                 order: 3,
//                 content: `
// # Bagaimana Jika Penghasilan Tidak Tetap?

// Dalam perencanaan keuangan yang sehat:
// 1.  **Total Anggaran (Poin 1-4 di atas)** seharusnya didanai oleh **Penghasilan Tetap**.
// 2.  **Penghasilan Tidak Tetap** (Bonus, Insentif, THR) sebaiknya dianggap sebagai **SURPLUS**.

// **Surplus** inilah yang akan mempercepat Anda mencapai tujuan keuangan (seperti naik haji lebih cepat atau melunasi utang lebih awal).

// Jika Total Pengeluaran > Total Pendapatan, maka Anda mengalami **DEFISIT**. Ini adalah lampu merah yang harus segera diperbaiki dengan memotong pos *Gaya Hidup* atau *Utang Konsumtif*.
//         `
//             }
//         ],
//         quiz: {
//             title: 'Kuis Modul 1: Manajemen Anggaran',
//             description: 'Uji pemahaman Anda tentang alokasi gaji yang ideal.',
//             timeLimit: 5,
//             passingScore: 80,
//             maxAttempts: 3,
//             questions: [
//                 {
//                     questionText: 'Berapa persentase maksimal yang disarankan untuk Biaya Hidup dan Gaya Hidup dari penghasilan tetap?',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 1,
//                     explanation: 'Biaya hidup (kebutuhan) dan gaya hidup (keinginan) idealnya dijaga di maksimal 45% agar sisa penghasilan bisa digunakan untuk menabung dan membayar cicilan.',
//                     options: [
//                         { optionText: '30%', isCorrect: false },
//                         { optionText: '45%', isCorrect: true },
//                         { optionText: '50%', isCorrect: false },
//                         { optionText: '60%', isCorrect: false },
//                     ]
//                 },
//                 {
//                     questionText: 'Manakah di bawah ini yang termasuk dalam kategori Utang Produktif?',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 2,
//                     explanation: 'KPR (Kredit Pemilikan Rumah) dianggap produktif karena nilai properti cenderung naik seiring waktu, berbeda dengan kendaraan atau kartu kredit yang nilainya turun.',
//                     options: [
//                         { optionText: 'Cicilan Kartu Kredit untuk liburan', isCorrect: false },
//                         { optionText: 'Cicilan Paylater baju lebaran', isCorrect: false },
//                         { optionText: 'KPR (Kredit Pemilikan Rumah)', isCorrect: true },
//                         { optionText: 'Kredit Mobil Pribadi', isCorrect: false },
//                     ]
//                 },
//                 {
//                     questionText: 'Berapa batas aman maksimal (benchmark) untuk Total Cicilan Utang (Produktif + Konsumtif)?',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 3,
//                     explanation: 'Total rasio utang (Debt Service Ratio) yang sehat adalah maksimal 35% dari penghasilan bulanan.',
//                     options: [
//                         { optionText: '20%', isCorrect: false },
//                         { optionText: '30%', isCorrect: false },
//                         { optionText: '35%', isCorrect: true },
//                         { optionText: '40%', isCorrect: false },
//                     ]
//                 },
//                 {
//                     questionText: 'Penghasilan Tidak Tetap (Bonus/Insentif) sebaiknya dialokasikan sebagai...',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 4,
//                     explanation: 'Penghasilan tidak tetap sebaiknya dianggap sebagai Surplus untuk menambah investasi/aset, bukan untuk menambal pengeluaran rutin bulanan.',
//                     options: [
//                         { optionText: 'Biaya Hidup sehari-hari', isCorrect: false },
//                         { optionText: 'Surplus / Penambah Aset', isCorrect: true },
//                         { optionText: 'Membayar cicilan rutin', isCorrect: false },
//                         { optionText: 'Uang kaget untuk foya-foya', isCorrect: false },
//                     ]
//                 },
//                 {
//                     questionText: 'Pos "Tabungan & Investasi" idealnya minimal sebesar berapa persen?',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 5,
//                     explanation: 'Minimal 10% dari penghasilan harus disisihkan di awal (pay yourself first) untuk masa depan.',
//                     options: [
//                         { optionText: '5%', isCorrect: false },
//                         { optionText: '10%', isCorrect: true },
//                         { optionText: '15%', isCorrect: false },
//                         { optionText: 'Sisa uang di akhir bulan', isCorrect: false },
//                     ]
//                 }
//             ]
//         }
//     },

//     // ==============================================================================
//     // MODUL 2: MEMBEDAH KESEHATAN KEUANGAN (FHCU)
//     // Referensi: Formula Financial Health Check Up (8 Rasio Keuangan)
//     // ==============================================================================
//     {
//         slug: 'membedah-kesehatan-keuangan',
//         title: 'Medical Check-Up Keuangan (FHCU)',
//         excerpt: 'Apakah keuangan Anda sehat, demam, atau kritis? Pelajari cara membaca 8 indikator vital kesehatan finansial Anda.',
//         categorySlug: 'analisis-keuangan',
//         order: 2,
//         status: EducationModuleStatus.PUBLISHED,
//         publishedAt: new Date(),
//         coverImage: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=1000',
//         durationMinutes: 12,
//         sections: [
//             {
//                 title: 'Mengenal Aset dan Utang',
//                 order: 1,
//                 content: `
// # Struktur Neraca Keuangan

// Sebelum menghitung rasio, Anda harus paham komponen kekayaan Anda:

// ### 1. Aset (Harta)
// * **Aset Likuid:** Uang tunai, tabungan, deposito (mudah dicairkan).
// * **Aset Investasi:** Saham, reksadana, emas, properti sewaan (menghasilkan uang).
// * **Aset Personal:** Rumah tinggal, kendaraan pribadi, perhiasan (dipakai sendiri).

// ### 2. Utang (Kewajiban)
// * **Jangka Pendek:** Kartu kredit, utang warung (< 1 tahun).
// * **Jangka Panjang:** KPR, KPM (> 1 tahun).

// **Kekayaan Bersih (Net Worth)** = Total Aset - Total Utang.
//         `
//             },
//             {
//                 title: 'Rasio Vital: Dana Darurat & Likuiditas',
//                 order: 2,
//                 content: `
// # 1. Rasio Dana Darurat
// Rumus: **Aset Likuid / Pengeluaran Bulanan**
// * **Fungsi:** Bertahan hidup saat kehilangan pendapatan tiba-tiba (PHK/Sakit).
// * **Benchmark Ideal:** **3 - 6 kali** pengeluaran bulanan.

// # 2. Rasio Likuiditas (Terhadap Kekayaan Bersih)
// Rumus: **Aset Likuid / Kekayaan Bersih**
// * **Fungsi:** Mengetahui seberapa cepat Anda bisa mencairkan uang tunai dibandingkan total kekayaan Anda.
// * **Benchmark:** Minimal **15%**. Jika terlalu rendah, Anda "kaya aset tapi miskin tunai".
//         `
//             },
//             {
//                 title: 'Rasio Solvabilitas & Investasi',
//                 order: 3,
//                 content: `
// # 3. Rasio Solvabilitas (Kebangkrutan)
// Rasio ini menunjukkan ketahanan Anda terhadap risiko kebangkrutan.
// * **Benchmark:** Minimal **50%**.
// * Artinya, Kekayaan Bersih Anda harus minimal setengah dari Total Aset Anda. Jika di bawah 50%, sebagian besar aset Anda sebenarnya milik bank/kreditur (utang).

// # 4. Rasio Aset Investasi
// Seberapa produktif uang Anda bekerja?
// * **Benchmark:** Minimal **50%** dari Kekayaan Bersih.
// * Semakin tinggi rasio ini, semakin cepat Anda mencapai kebebasan finansial karena uang bekerja untuk Anda.
//         `
//             }
//         ],
//         quiz: {
//             title: 'Kuis Modul 2: Diagnosis Keuangan',
//             description: 'Cek pemahaman Anda mengenai indikator kesehatan finansial.',
//             timeLimit: 5,
//             passingScore: 80,
//             maxAttempts: 3,
//             questions: [
//                 {
//                     questionText: 'Berapa benchmark ideal untuk Rasio Dana Darurat?',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 1,
//                     explanation: 'Idealnya kita memiliki cadangan uang tunai setara 3 hingga 6 bulan pengeluaran rutin.',
//                     options: [
//                         { optionText: '1 kali pengeluaran', isCorrect: false },
//                         { optionText: '3 - 6 kali pengeluaran', isCorrect: true },
//                         { optionText: '12 kali pengeluaran', isCorrect: false },
//                         { optionText: 'Sebesar limit kartu kredit', isCorrect: false },
//                     ]
//                 },
//                 {
//                     questionText: 'Rumus untuk menghitung Kekayaan Bersih (Net Worth) adalah...',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 2,
//                     explanation: 'Kekayaan bersih adalah nilai sisa dari total harta (aset) setelah dikurangi seluruh kewajiban (utang).',
//                     options: [
//                         { optionText: 'Total Aset + Total Utang', isCorrect: false },
//                         { optionText: 'Penghasilan - Pengeluaran', isCorrect: false },
//                         { optionText: 'Total Aset - Total Utang', isCorrect: true },
//                         { optionText: 'Aset Investasi - Utang Konsumtif', isCorrect: false },
//                     ]
//                 },
//                 {
//                     questionText: 'Apa yang dimaksud dengan Aset Likuid?',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 3,
//                     explanation: 'Aset likuid adalah aset yang berbentuk kas atau setara kas yang sangat mudah dan cepat dicairkan tanpa pengurangan nilai yang berarti.',
//                     options: [
//                         { optionText: 'Rumah dan Tanah', isCorrect: false },
//                         { optionText: 'Mobil Mewah', isCorrect: false },
//                         { optionText: 'Kas, Tabungan, dan Deposito', isCorrect: true },
//                         { optionText: 'Koleksi Barang Antik', isCorrect: false },
//                     ]
//                 },
//                 {
//                     questionText: 'Jika Rasio Cicilan Utang Konsumtif Anda di atas 15%, apa artinya?',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 4,
//                     explanation: 'Benchmark utang konsumtif maksimal 15%. Jika lebih, ini tanda bahaya (Red Flag) yang berisiko mengganggu cashflow.',
//                     options: [
//                         { optionText: 'Sangat Sehat', isCorrect: false },
//                         { optionText: 'Perlu Waspada (Warning) karena terlalu tinggi', isCorrect: true },
//                         { optionText: 'Masih dalam batas wajar', isCorrect: false },
//                         { optionText: 'Anda perlu menambah utang lagi', isCorrect: false },
//                     ]
//                 },
//                 {
//                     questionText: 'Rasio Solvabilitas minimal 50% menunjukkan bahwa...',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 5,
//                     explanation: 'Solvabilitas > 50% berarti nilai kekayaan bersih Anda lebih besar daripada utang Anda, sehingga risiko kebangkrutan rendah.',
//                     options: [
//                         { optionText: 'Anda memiliki utang lebih besar dari aset', isCorrect: false },
//                         { optionText: 'Kondisi keuangan Anda rentan bangkrut', isCorrect: false },
//                         { optionText: 'Ketahanan finansial kuat & risiko kebangkrutan rendah', isCorrect: true },
//                         { optionText: 'Anda memiliki terlalu banyak uang tunai', isCorrect: false },
//                     ]
//                 }
//             ]
//         }
//     },

//     // ==============================================================================
//     // MODUL 3: MERENCANAKAN MASA DEPAN (PENDIDIKAN & PENSIUN)
//     // Referensi: Formula Financial Calculator (Menu 2 & Menu 5) & Konsep FV
//     // ==============================================================================
//     {
//         slug: 'merencanakan-masa-depan',
//         title: 'Merencanakan Masa Depan: Melawan Inflasi',
//         excerpt: 'Uang Rp100 juta hari ini tidak sama dengan 10 tahun lagi. Pahami konsep Time Value of Money untuk dana pendidikan dan pensiun.',
//         categorySlug: 'tujuan-keuangan',
//         order: 3,
//         status: EducationModuleStatus.PUBLISHED,
//         publishedAt: new Date(),
//         coverImage: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1000',
//         durationMinutes: 15,
//         sections: [
//             {
//                 title: 'Musuh Terbesar: Inflasi',
//                 order: 1,
//                 content: `
// # Konsep Future Value (FV)

// Dalam merencanakan Dana Pendidikan atau Pensiun, kita tidak bisa menggunakan harga hari ini. Kita harus memperhitungkan **Inflasi**.

// Rumus Nilai Masa Depan:
// **FV = PV x (1 + i)^n**

// * **PV (Present Value):** Biaya saat ini.
// * **i (Interest/Inflation):** Tingkat inflasi per tahun (misal: Pendidikan 10-15%).
// * **n (Number of years):** Jarak waktu dalam tahun.

// *Contoh:* Biaya masuk kuliah saat ini Rp 100 Juta. Dengan inflasi pendidikan 10%, dalam 5 tahun biayanya bukan lagi Rp 100 Juta, melainkan **Rp 161 Juta!**
//         `
//             },
//             {
//                 title: 'Perencanaan Dana Pendidikan',
//                 order: 2,
//                 content: `
// # Strategi Bertahap

// Pendidikan anak memiliki tahapan (TK, SD, SMP, SMA, Kuliah). Kesalahan umum orang tua adalah hanya fokus pada tahap awal (TK/SD) dan lupa bahwa biaya Kuliah adalah yang terbesar dan memiliki inflasi tertinggi.

// **Tips Perencanaan:**
// 1.  **Hitung Biaya Kuliah DULU:** Karena waktunya paling panjang, efek *compounding interest* (bunga berbunga) investasi akan paling terasa di sini.
// 2.  **Investasi vs Tabungan:** Untuk tujuan > 5 tahun (seperti kuliah anak yang baru lahir), menabung di bank saja tidak cukup melawan inflasi. Diperlukan instrumen investasi (Reksadana/Saham) dengan *return* di atas inflasi.
//         `
//             },
//             {
//                 title: 'Mempersiapkan Dana Pensiun',
//                 order: 3,
//                 content: `
// # The Replacement Ratio

// Berapa dana pensiun yang cukup?
// Biasanya digunakan pendekatan *Replacement Ratio* (Rasio Penggantian), yaitu sekitar **70-80% dari pengeluaran terakhir** saat masih bekerja.

// Rumus sederhananya melibatkan:
// 1.  **Usia Pensiun:** Kapan Anda berhenti bekerja?
// 2.  **Harapan Hidup:** Berapa lama dana tersebut harus "menghidupi" Anda?
// 3.  **Investasi:** Anda harus menyisihkan uang bulanan (PMT) yang diinvestasikan agar tumbuh mengejar target dana tersebut.

// Semakin dini Anda memulai (n semakin besar), semakin kecil uang yang perlu Anda sisihkan setiap bulan.
//         `
//             }
//         ],
//         quiz: {
//             title: 'Kuis Modul 3: Time Value of Money',
//             description: 'Apakah Anda siap menghadapi inflasi di masa depan?',
//             timeLimit: 5,
//             passingScore: 80,
//             maxAttempts: 3,
//             questions: [
//                 {
//                     questionText: 'Apa dampak inflasi terhadap Dana Pendidikan anak di masa depan?',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 1,
//                     explanation: 'Inflasi menyebabkan kenaikan harga barang/jasa seiring waktu. Akibatnya, biaya pendidikan di masa depan akan jauh lebih mahal (nominalnya lebih besar) dibandingkan biaya saat ini.',
//                     options: [
//                         { optionText: 'Biaya pendidikan menjadi lebih murah', isCorrect: false },
//                         { optionText: 'Nilai uang tetap sama', isCorrect: false },
//                         { optionText: 'Nominal biaya yang dibutuhkan menjadi lebih besar', isCorrect: true },
//                         { optionText: 'Inflasi tidak berpengaruh pada pendidikan', isCorrect: false },
//                     ]
//                 },
//                 {
//                     questionText: 'Dalam rumus Future Value FV = PV(1+i)^n, huruf "n" melambangkan apa?',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 2,
//                     explanation: '"n" melambangkan periode waktu (years) dari saat ini hingga tujuan keuangan tercapai. Semakin lama waktunya, efek bunga majemuk semakin besar.',
//                     options: [
//                         { optionText: 'Nilai Uang Sekarang', isCorrect: false },
//                         { optionText: 'Tingkat Bunga/Inflasi', isCorrect: false },
//                         { optionText: 'Jangka Waktu (Tahun)', isCorrect: true },
//                         { optionText: 'Nilai Masa Depan', isCorrect: false },
//                     ]
//                 },
//                 {
//                     questionText: 'Mengapa disarankan memulai investasi Dana Pensiun sedini mungkin?',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 3,
//                     explanation: 'Memulai lebih awal memanfaatkan kekuatan "Compounding Interest" (bunga berbunga), sehingga nominal yang perlu disisihkan per bulan menjadi lebih ringan.',
//                     options: [
//                         { optionText: 'Agar uangnya bisa cepat diambil', isCorrect: false },
//                         { optionText: 'Agar beban tabungan bulanan menjadi lebih ringan', isCorrect: true },
//                         { optionText: 'Karena bank memaksa demikian', isCorrect: false },
//                         { optionText: 'Agar bisa pensiun umur 30', isCorrect: false },
//                     ]
//                 },
//                 {
//                     questionText: 'Instrumen apa yang paling cocok untuk tujuan keuangan jangka panjang (> 10 tahun) seperti dana kuliah anak baru lahir?',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 4,
//                     explanation: 'Untuk jangka panjang, kita membutuhkan instrumen dengan potensi imbal hasil tinggi untuk mengalahkan inflasi, seperti Saham atau Reksadana Saham, meskipun fluktuasinya tinggi dalam jangka pendek.',
//                     options: [
//                         { optionText: 'Tabungan Bank Biasa (Bunga rendah)', isCorrect: false },
//                         { optionText: 'Celengan di rumah', isCorrect: false },
//                         { optionText: 'Investasi Saham / Reksadana Saham', isCorrect: true },
//                         { optionText: 'Arisan keluarga', isCorrect: false },
//                     ]
//                 },
//                 {
//                     questionText: 'Jika biaya kuliah saat ini Rp 100 Juta, dan inflasi pendidikan 10% per tahun. Apakah Rp 100 Juta cukup untuk 5 tahun lagi?',
//                     type: QuizQuestionType.SINGLE_CHOICE,
//                     orderIndex: 5,
//                     explanation: 'Tidak cukup. Karena inflasi akan menggerus daya beli uang. Rp 100 juta di masa depan nilainya lebih rendah dari Rp 100 juta hari ini.',
//                     options: [
//                         { optionText: 'Cukup, karena uangnya sama', isCorrect: false },
//                         { optionText: 'Lebih dari cukup', isCorrect: false },
//                         { optionText: 'Tidak cukup, nilai uang akan tergerus inflasi', isCorrect: true },
//                         { optionText: 'Tergantung nilai tukar dollar', isCorrect: false },
//                     ]
//                 }
//             ]
//         }
//     }
// ];