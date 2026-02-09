/**
 * BUDGET_ALLOCATION_RULES
 * -----------------------
 * Konstanta aturan alokasi anggaran berdasarkan prinsip perencana keuangan.
 * Digunakan sebagai basis perhitungan untuk simulasi budgeting agen.
 */
export const BUDGET_ALLOCATION_RULES = {
    /**
     * Biaya Hidup (Living Cost) - 45%
     * Digunakan untuk kebutuhan sehari-hari (makan, transport, listrik, dll).
     */
    LIVING_COST: 0.45,

    /**
     * Batas Maksimal Hutang Konsumtif - 15%
     * Contoh: Cicilan KTA, Paylater, Kartu Kredit untuk belanja konsumtif.
     */
    DEBT_CONSUMPTIVE_MAX: 0.15,

    /**
     * Batas Maksimal Hutang Produktif - 20%
     * Contoh: KPR (Rumah), KPM (Kendaraan untuk kerja), Modal Bisnis.
     */
    DEBT_PRODUCTIVE_MAX: 0.20,

    /**
     * Minimal Tabungan & Investasi - 10%
     * Dana darurat, tabungan pensiun, dll.
     */
    SAVING_MIN: 0.10,

    /**
     * Minimal Asuransi / Proteksi - 10%
     * Premi asuransi kesehatan, jiwa, penyakit kritis.
     */
    INSURANCE_MIN: 0.10,
};