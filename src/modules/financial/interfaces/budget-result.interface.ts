export interface BudgetResult {
    meta: {
        module: 'BUDGETING';
        version: '1.0';
        generated_at: string; // ISO 8601 Date
    };
    financials: {
        income: {
            fixed: number;
            variable: number;
            total: number;
        };
        expense: {
            living_cost: number;
            debt_total: number;
            insurance: number;
            saving: number;
            total_allocation: number; // Total uang yang keluar/dialokasikan
        };
        balance: number; // Sisa uang (Unallocated Cashflow)
    };
    analysis: {
        health_score: number; // 0-100
        ratios: {
            savings_ratio: number; // % (Target: 10-20%)
            debt_service_ratio: number; // % (Target: <30%)
        };
        status: 'HEALTHY' | 'WARNING' | 'DANGER';
        recommendation: string;
    };
}