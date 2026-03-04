// File: src/modules/users/interfaces/quota-transaction.interface.ts

/**
 * Tipe-tipe transaksi yang valid dalam sistem Ledger Kuota.
 * Digunakan untuk tracking sumber penambahan/pengurangan token.
 */
export enum QuotaTransactionType {
    SUBSCRIPTION_RENEWAL = 'SUBSCRIPTION_RENEWAL', // Penambahan otomatis dari paket langganan
    ADMIN_BONUS = 'ADMIN_BONUS',                   // Penambahan manual oleh Admin (Top-up/Gift)
    USAGE_SIMULATION = 'USAGE_SIMULATION',         // Pengurangan saat user membuat simulasi PDF
    COMPENSATION = 'COMPENSATION',                 // Pengembalian kuota (Refund) jika terjadi error sistem
    CORRECTION = 'CORRECTION',                     // Penyesuaian saldo teknis (Audit Adjustment)
}

/**
 * Struktur respon standar setelah transaksi kuota berhasil diproses.
 * Digunakan oleh UserQuotaService.
 */
export interface QuotaTransactionResult {
    success: boolean;
    previousBalance: number;
    newBalance: number;
    transactionId: string;
    message?: string;
}

/**
 * Interface untuk input parameter manual inject (Admin).
 */
export interface ManualQuotaInjectionParams {
    userId: string;
    amount: number;
    adminId: string;
    reason: string;
}

/**
 * Representasi satu baris data ledger untuk ditampilkan di History Frontend.
 */
export interface QuotaHistoryItem {
    id: string;
    amount: number;         // Bisa positif (+) atau negatif (-)
    type: QuotaTransactionType;
    balanceAfter: number;   // Saldo setelah transaksi ini
    description?: string | null;
    createdAt: Date;
    referenceId?: string | null;
}