export interface IRetentionStrategy {
    /**
     * Mengidentifikasi ID data yang layak dihapus berdasarkan logika retensi spesifik.
     * @param tableName Nama tabel fisik di database (e.g., 'financial_checkups')
     * @param cutoffDate Tanggal batas retensi (data sebelum tanggal ini diperiksa)
     * @returns Array of UUIDs (kandidat penghapusan)
     */
    findCandidates(tableName: string, cutoffDate: Date): Promise<string[]>;
}

// Token untuk Dependency Injection di NestJS
export const RETENTION_STRATEGIES = {
    HISTORICAL: 'HISTORICAL_STRATEGY',
    SNAPSHOT: 'SNAPSHOT_STRATEGY',
};