// statisticsStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useTransactionStore } from './transactionStore'
import { useCategoryStore } from './categoryStore'
import dayjs from 'dayjs'

export const useStatisticsStore = defineStore('statistics', () => {
  const transactionStore = useTransactionStore()
  const categoryStore = useCategoryStore()

  const getIncomeExpenseSummary = computed(() => {
    return (startDate: string, endDate: string) => {
      const transactions = (transactionStore.transactions?.value || []).filter(tx => {
        const txDate = dayjs(tx.date)
        return txDate.isAfter(dayjs(startDate).subtract(1, 'day')) &&
               txDate.isBefore(dayjs(endDate).add(1, 'day'))
      })

      let income = 0
      let expense = 0

      transactions.forEach(tx => {
        if (tx.amount > 0) {
          income += tx.amount
        } else {
          expense += Math.abs(tx.amount)
        }
      })

      // Bilanz berechnen
      const balance = income - expense

      return { income, expense, balance }
    }
  })

  const getCategoryExpenses = computed(() => {
    return (startDate: string, endDate: string, limit: number = 0) => {
      const transactions = (transactionStore.transactions?.value || []).filter(tx => {
        const txDate = dayjs(tx.date)
        return txDate.isAfter(dayjs(startDate).subtract(1, 'day')) &&
               txDate.isBefore(dayjs(endDate).add(1, 'day')) &&
               tx.amount < 0 &&
               tx.categoryId
      })

      const categoryMap = new Map<string, number>()

      transactions.forEach(tx => {
        if (tx.categoryId) {
          const currentAmount = categoryMap.get(tx.categoryId) || 0
          categoryMap.set(tx.categoryId, currentAmount + Math.abs(tx.amount))
        }
      })

      const result = Array.from(categoryMap.entries()).map(([categoryId, amount]) => {
        const category = categoryStore.getCategoryById(categoryId)
        return {
          categoryId,
          name: category ? category.name : 'Unbekannt',
          amount
        }
      }).sort((a, b) => b.amount - a.amount)

      return limit > 0 ? result.slice(0, limit) : result
    }
  })

  // Dummy-Implementierungen für Chart-Daten
  const getIncomeExpenseChartData = computed(() => {
    return (startDate: string, endDate: string) => ({
      labels: ['Einnahmen', 'Ausgaben'],
      datasets: [{
        label: 'Betrag',
        data: [getIncomeExpenseSummary.value(startDate, endDate).income, getIncomeExpenseSummary.value(startDate, endDate).expense]
      }]
    })
  })

  const getCategoryExpensesChartData = computed(() => {
    return (startDate: string, endDate: string) => {
      const categories = getCategoryExpenses.value(startDate, endDate, 10)
      return {
        labels: categories.map(c => c.name),
        datasets: [{
          label: 'Ausgaben',
          data: categories.map(c => c.amount)
        }]
      }
    }
  })

  const getMonthlyTrend = computed(() => {
    return (months: number = 6) => {
      const result = []
      const now = dayjs()

      for (let i = months - 1; i >= 0; i--) {
        const month = now.subtract(i, 'month')
        const startOfMonth = month.startOf('month').format('YYYY-MM-DD')
        const endOfMonth = month.endOf('month').format('YYYY-MM-DD')

        const summary = getIncomeExpenseSummary.value(startOfMonth, endOfMonth)

        result.push({
          month: month.format('MMMM YYYY'),
          income: summary.income,
          expense: summary.expense
        })
      }

      return result
    }
  })

  const getMonthlyTrendChartData = computed(() => {
    return (months: number = 6) => {
      const trend = getMonthlyTrend.value(months)
      return {
        labels: trend.map(item => item.month),
        datasets: [{
          label: 'Einnahmen',
          data: trend.map(item => item.income)
        }, {
          label: 'Ausgaben',
          data: trend.map(item => item.expense)
        }]
      }
    }
  })

  const getAccountBalanceTrendChartData = computed(() => {
    return (accountId: string, days: number = 30) => ({
      labels: Array.from({ length: days }, (_, i) => dayjs().subtract(days - i - 1, 'day').format('MM-DD')),
      datasets: [{
        label: 'Kontostand',
        data: Array.from({ length: days }, () => Math.floor(Math.random() * 2000) + 500)
      }]
    })
  })

  // Dummy-Daten für getCategoryIncome (falls benötigt)
  const getCategoryIncome = computed(() => {
    return (startDate: string, endDate: string, limit: number = 0) => {
      const dummy = [
        { categoryId: 'income1', name: 'Gehalt', amount: 3000 },
        { categoryId: 'income2', name: 'Bonus', amount: 1200 },
        { categoryId: 'income3', name: 'Nebenverdienst', amount: 600 }
      ]
      return limit > 0 ? dummy.slice(0, limit) : dummy
    }
  })

  // Dummy-Daten für getAccountBalanceTrend (falls benötigt)
  const getAccountBalanceTrend = computed(() => {
    return (accountId: string, days: number = 30) => {
      return Array.from({ length: days }, (_, i) => ({
        date: dayjs().subtract(days - i - 1, 'day').format('YYYY-MM-DD'),
        balance: Math.floor(Math.random() * 2000) + 500
      }))
    }
  })

  const getSavingsGoalProgress = computed(() => {
    return () => {
      const savingsGoals = categoryStore.savingsGoals?.value || []

      return savingsGoals.map(goal => {
        const progress = goal.targetAmount > 0
          ? Math.min(100, Math.round((goal.balance / goal.targetAmount) * 100))
          : 0

        return {
          id: goal.id,
          name: goal.name,
          currentAmount: goal.balance,
          targetAmount: goal.targetAmount,
          targetDate: goal.targetDate,
          progress
        }
      })
    }
  })

  const getNetWorthTrend = computed(() => {
    return (months: number = 12) => {
      return []
    }
  })

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
  }
})
