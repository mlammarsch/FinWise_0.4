// statisticsStore.ts
import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useTransactionStore } from './transactionStore';
import { useCategoryStore } from './categoryStore';
import { TransactionService } from '@/services/TransactionService';
import dayjs from 'dayjs';
export const useStatisticsStore = defineStore('statistics', () => {
    const transactionStore = useTransactionStore();
    const categoryStore = useCategoryStore();
    /**
     * Delegiert an TransactionService für konsistente Business Logic
     * Keine reaktive computed property mehr - verhindert Performance-Probleme
     */
    function getIncomeExpenseSummary(startDate, endDate) {
        return TransactionService.getIncomeExpenseSummary(startDate, endDate);
    }
    const getCategoryExpenses = computed(() => {
        return (startDate, endDate, limit = 0) => {
            const transactions = transactionStore.transactions.filter(tx => {
                const txDate = dayjs(tx.date);
                return txDate.isAfter(dayjs(startDate).subtract(1, 'day')) &&
                    txDate.isBefore(dayjs(endDate).add(1, 'day')) &&
                    tx.amount < 0 &&
                    tx.categoryId;
            });
            const categoryMap = new Map();
            transactions.forEach(tx => {
                if (tx.categoryId) {
                    const currentAmount = categoryMap.get(tx.categoryId) || 0;
                    categoryMap.set(tx.categoryId, currentAmount + Math.abs(tx.amount));
                }
            });
            const result = Array.from(categoryMap.entries()).map(([categoryId, amount]) => {
                const category = categoryStore.getCategoryById(categoryId);
                return {
                    categoryId,
                    name: category ? category.name : 'Unbekannt',
                    amount
                };
            }).sort((a, b) => b.amount - a.amount);
            return limit > 0 ? result.slice(0, limit) : result;
        };
    });
    // Chart-Daten - delegiert an Service-Funktionen
    const getIncomeExpenseChartData = computed(() => {
        return (startDate, endDate) => {
            const summary = getIncomeExpenseSummary(startDate, endDate);
            return {
                labels: ['Einnahmen', 'Ausgaben'],
                datasets: [{
                        label: 'Betrag',
                        data: [summary.income, summary.expense]
                    }]
            };
        };
    });
    const getCategoryExpensesChartData = computed(() => {
        return (startDate, endDate) => {
            const categories = getCategoryExpenses.value(startDate, endDate, 10);
            return {
                labels: categories.map(c => c.name),
                datasets: [{
                        label: 'Ausgaben',
                        data: categories.map(c => c.amount)
                    }]
            };
        };
    });
    /**
     * Delegiert an TransactionService für konsistente Business Logic
     * Keine reaktive computed property mehr - verhindert Performance-Probleme
     */
    function getMonthlyTrend(months = 6) {
        return TransactionService.getMonthlyTrend(months);
    }
    const getMonthlyTrendChartData = computed(() => {
        return (months = 6) => {
            const trend = getMonthlyTrend(months);
            return {
                labels: trend.map(item => item.month),
                datasets: [{
                        label: 'Einnahmen',
                        data: trend.map(item => item.income)
                    }, {
                        label: 'Ausgaben',
                        data: trend.map(item => item.expense)
                    }]
            };
        };
    });
    const getAccountBalanceTrendChartData = computed(() => {
        return (accountId, days = 30) => ({
            labels: Array.from({ length: days }, (_, i) => dayjs().subtract(days - i - 1, 'day').format('MM-DD')),
            datasets: [{
                    label: 'Kontostand',
                    data: Array.from({ length: days }, () => Math.floor(Math.random() * 2000) + 500)
                }]
        });
    });
    // Dummy-Daten für getCategoryIncome (falls benötigt)
    const getCategoryIncome = computed(() => {
        return (startDate, endDate, limit = 0) => {
            const dummy = [
                { categoryId: 'income1', name: 'Gehalt', amount: 3000 },
                { categoryId: 'income2', name: 'Bonus', amount: 1200 },
                { categoryId: 'income3', name: 'Nebenverdienst', amount: 600 }
            ];
            return limit > 0 ? dummy.slice(0, limit) : dummy;
        };
    });
    // Dummy-Daten für getAccountBalanceTrend (falls benötigt)
    const getAccountBalanceTrend = computed(() => {
        return (accountId, days = 30) => {
            return Array.from({ length: days }, (_, i) => ({
                date: dayjs().subtract(days - i - 1, 'day').format('YYYY-MM-DD'),
                balance: Math.floor(Math.random() * 2000) + 500
            }));
        };
    });
    const getSavingsGoalProgress = computed(() => {
        return () => {
            // Dummy-Implementierung da savingsGoals nicht korrekt implementiert ist
            const savingsGoals = [];
            return savingsGoals.map((goal) => {
                const progress = goal.targetAmount > 0
                    ? Math.min(100, Math.round((goal.balance / goal.targetAmount) * 100))
                    : 0;
                return {
                    id: goal.id,
                    name: goal.name,
                    currentAmount: goal.balance,
                    targetAmount: goal.targetAmount,
                    targetDate: goal.targetDate,
                    progress
                };
            });
        };
    });
    const getNetWorthTrend = computed(() => {
        return (months = 12) => {
            return [];
        };
    });
    function reset() {
        // Hier nur leeren, keine Persistenz vorhanden
    }
    return {
        getIncomeExpenseSummary,
        getCategoryExpenses,
        getMonthlyTrend,
        getSavingsGoalProgress,
        getNetWorthTrend,
        getIncomeExpenseChartData: getIncomeExpenseChartData.value,
        getCategoryExpensesChartData: getCategoryExpensesChartData.value,
        getMonthlyTrendChartData: getMonthlyTrendChartData.value,
        getAccountBalanceTrendChartData: getAccountBalanceTrendChartData.value,
        getCategoryIncome: getCategoryIncome.value,
        getAccountBalanceTrend: getAccountBalanceTrend.value,
        reset
    };
});
