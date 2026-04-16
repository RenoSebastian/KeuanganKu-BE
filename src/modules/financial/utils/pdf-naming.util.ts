/**
 * PDF Naming Utility
 * Standardisasi nama file PDF untuk semua modul simulasi
 * Format: [NamaModul]_[NamaKlien]_[DD-MM-YYYY].pdf
 * 
 * Contoh: Education_Ridho Pratama_14-04-2026.pdf
 */

/**
 * Sanitize nama klien untuk digunakan di nama file (remove special chars)
 */
function sanitizeClientName(name: string | undefined | null): string {
    if (!name || name.trim().length === 0) {
        return 'Klien';
    }

    return (
        name
            .trim()
            // Hapus karakter spesial, keep space dan dash
            .replace(/[^a-zA-Z0-9\s\-]/g, '')
            // Replace multiple spaces dengan underscore
            .replace(/\s+/g, '_')
            // Replace multiple dashes dengan single dash
            .replace(/\-+/g, '-')
            // Limit panjang
            .substring(0, 30)
    );
}

/**
 * Format tanggal menjadi DD-MM-YYYY
 */
function formatDateDDMMYYYY(date: Date | undefined | null): string {
    if (!date) {
        date = new Date();
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
}

/**
 * Generate standar PDF filename
 * @example generatePdfFilename('Education', 'Ridho Pratama', new Date()) 
 *          => 'Education_Ridho_Pratama_14-04-2026.pdf'
 */
export function generatePdfFilename(
    moduleName: string,
    clientName?: string | null,
    date?: Date | null,
): string {
    const sanitizedModule = moduleName
        .replace(/\s+/g, '_')
        .substring(0, 20);
    const sanitizedClient = sanitizeClientName(clientName);
    const formattedDate = formatDateDDMMYYYY(date);

    return `${sanitizedModule}_${sanitizedClient}_${formattedDate}.pdf`;
}

/**
 * Module name constants (untuk consistency)
 */
export const MODULE_NAMES = {
    CHECKUP: 'CheckupKeuangan',
    CHECKUP_HISTORY: 'CheckupHistory',
    BUDGET: 'Budget',
    PENSION: 'Pensiun',
    INSURANCE: 'Asuransi',
    GOALS: 'Goals',
    EDUCATION: 'Education',
    RISK_PROFILE: 'RiskProfile',
    AGENT_BUDGET: 'BudgetSimulasi',
    AGENT_INSURANCE: 'AsuranasiSimulasi',
    AGENT_PENSION: 'PensiunSimulasi',
    AGENT_GOALS: 'GoalsSimulasi',
    AGENT_CHECKUP: 'CheckupSimulasi',
    AGENT_EDUCATION: 'EducationSimulasi',
    AGENT_RISK_PROFILE: 'RiskProfileSimulasi',
} as const;

/**
 * Contoh usage di Controller:
 * 
 * import { generatePdfFilename, MODULE_NAMES } from './utils/pdf-naming.util';
 * 
 * const filename = generatePdfFilename(
 *   MODULE_NAMES.EDUCATION,
 *   checkupData.userProfile?.fullName,
 *   new Date()
 * );
 * 
 * res.set({
 *   'Content-Type': 'application/pdf',
 *   'Content-Disposition': `attachment; filename="${filename}"`,
 * });
 */
