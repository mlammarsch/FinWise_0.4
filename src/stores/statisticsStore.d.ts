export declare const useStatisticsStore: import("pinia").StoreDefinition<"statistics", Pick<{
    getIncomeExpenseSummary: (startDate: string, endDate: string) => {
        income: number;
        expense: number;
        balance: number;
    };
    getCategoryExpenses: import("vue").ComputedRef<(startDate: string, endDate: string, limit?: number) => {
        categoryId: string;
        name: string;
        amount: number;
    }[]>;
    getMonthlyTrend: (months?: number) => {
        month: string;
        income: number;
        expense: number;
    }[];
    getSavingsGoalProgress: import("vue").ComputedRef<() => {
        id: any;
        name: any;
        currentAmount: any;
        targetAmount: any;
        targetDate: any;
        progress: number;
    }[]>;
    getNetWorthTrend: import("vue").ComputedRef<(months?: number) => never[]>;
    getIncomeExpenseChartData: (startDate: string, endDate: string) => {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
        }[];
    };
    getCategoryExpensesChartData: (startDate: string, endDate: string) => {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
        }[];
    };
    getMonthlyTrendChartData: (months?: number) => {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
        }[];
    };
    getAccountBalanceTrendChartData: (accountId: string, days?: number) => {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
        }[];
    };
    getCategoryIncome: (startDate: string, endDate: string, limit?: number) => {
        categoryId: string;
        name: string;
        amount: number;
    }[];
    getAccountBalanceTrend: (accountId: string, days?: number) => {
        date: string;
        balance: number;
    }[];
    reset: () => void;
}, never>, Pick<{
    getIncomeExpenseSummary: (startDate: string, endDate: string) => {
        income: number;
        expense: number;
        balance: number;
    };
    getCategoryExpenses: import("vue").ComputedRef<(startDate: string, endDate: string, limit?: number) => {
        categoryId: string;
        name: string;
        amount: number;
    }[]>;
    getMonthlyTrend: (months?: number) => {
        month: string;
        income: number;
        expense: number;
    }[];
    getSavingsGoalProgress: import("vue").ComputedRef<() => {
        id: any;
        name: any;
        currentAmount: any;
        targetAmount: any;
        targetDate: any;
        progress: number;
    }[]>;
    getNetWorthTrend: import("vue").ComputedRef<(months?: number) => never[]>;
    getIncomeExpenseChartData: (startDate: string, endDate: string) => {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
        }[];
    };
    getCategoryExpensesChartData: (startDate: string, endDate: string) => {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
        }[];
    };
    getMonthlyTrendChartData: (months?: number) => {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
        }[];
    };
    getAccountBalanceTrendChartData: (accountId: string, days?: number) => {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
        }[];
    };
    getCategoryIncome: (startDate: string, endDate: string, limit?: number) => {
        categoryId: string;
        name: string;
        amount: number;
    }[];
    getAccountBalanceTrend: (accountId: string, days?: number) => {
        date: string;
        balance: number;
    }[];
    reset: () => void;
}, "getCategoryExpenses" | "getSavingsGoalProgress" | "getNetWorthTrend">, Pick<{
    getIncomeExpenseSummary: (startDate: string, endDate: string) => {
        income: number;
        expense: number;
        balance: number;
    };
    getCategoryExpenses: import("vue").ComputedRef<(startDate: string, endDate: string, limit?: number) => {
        categoryId: string;
        name: string;
        amount: number;
    }[]>;
    getMonthlyTrend: (months?: number) => {
        month: string;
        income: number;
        expense: number;
    }[];
    getSavingsGoalProgress: import("vue").ComputedRef<() => {
        id: any;
        name: any;
        currentAmount: any;
        targetAmount: any;
        targetDate: any;
        progress: number;
    }[]>;
    getNetWorthTrend: import("vue").ComputedRef<(months?: number) => never[]>;
    getIncomeExpenseChartData: (startDate: string, endDate: string) => {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
        }[];
    };
    getCategoryExpensesChartData: (startDate: string, endDate: string) => {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
        }[];
    };
    getMonthlyTrendChartData: (months?: number) => {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
        }[];
    };
    getAccountBalanceTrendChartData: (accountId: string, days?: number) => {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
        }[];
    };
    getCategoryIncome: (startDate: string, endDate: string, limit?: number) => {
        categoryId: string;
        name: string;
        amount: number;
    }[];
    getAccountBalanceTrend: (accountId: string, days?: number) => {
        date: string;
        balance: number;
    }[];
    reset: () => void;
}, "reset" | "getIncomeExpenseSummary" | "getMonthlyTrend" | "getIncomeExpenseChartData" | "getCategoryExpensesChartData" | "getMonthlyTrendChartData" | "getAccountBalanceTrendChartData" | "getCategoryIncome" | "getAccountBalanceTrend">>;
