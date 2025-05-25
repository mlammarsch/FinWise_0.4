<!-- StatisticsView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStatisticsStore } from '../stores/statisticsStore'
import { useAccountStore } from '../stores/accountStore'
import { useCategoryStore } from '../stores/categoryStore'
import { formatCurrency, formatDate } from '../utils/formatters'
import { Bar, Pie, Line } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, ArcElement } from 'chart.js'
import dayjs from 'dayjs'

// Chart.js Komponenten registrieren
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, ArcElement)

// Stores
const statisticsStore = useStatisticsStore()
const accountStore = useAccountStore()
const categoryStore = useCategoryStore()

// Zeitraum für die Statistiken
const startDate = ref(dayjs().startOf('month').format('YYYY-MM-DD'))
const endDate = ref(dayjs().endOf('month').format('YYYY-MM-DD'))

// Ausgewähltes Konto für Kontostatistiken
const selectedAccountId = ref('')

// Anzahl der Monate für Trendanalyse
const trendMonths = ref(6)

// Anzahl der Tage für Kontoentwicklung
const accountTrendDays = ref(30)

// Zusammenfassung für den ausgewählten Zeitraum
const summary = computed(() => {
  return statisticsStore.getIncomeExpenseSummary(startDate.value, endDate.value)
})

// Top-Ausgabenkategorien
const topExpenseCategories = computed(() => {
  return statisticsStore.getCategoryExpenses(startDate.value, endDate.value, 10)
})

// Top-Einnahmenkategorien (Dummy-Daten)
const topIncomeCategories = computed(() => {
  return statisticsStore.getCategoryIncome
    ? statisticsStore.getCategoryIncome(startDate.value, endDate.value, 10)
    : [
        { categoryId: 'dummy1', name: 'Dummy Income 1', amount: 1000 },
        { categoryId: 'dummy2', name: 'Dummy Income 2', amount: 800 }
      ]
})

// Monatlicher Trend (Dummy-Daten)
const monthlyTrend = computed(() => {
  return statisticsStore.getMonthlyTrend(trendMonths.value)
})

// Kontoentwicklung (Dummy-Daten)
const accountTrend = computed(() => {
  if (!selectedAccountId.value) return []
  return statisticsStore.getAccountBalanceTrend
    ? statisticsStore.getAccountBalanceTrend(selectedAccountId.value, accountTrendDays.value)
    : [
        { date: startDate.value, balance: 1000 },
        { date: endDate.value, balance: 1200 }
      ]
})

// Chart-Daten mit Dummy-Fallbacks
const incomeExpenseChartData = computed(() => {
  return statisticsStore.getIncomeExpenseChartData
    ? statisticsStore.getIncomeExpenseChartData(startDate.value, endDate.value)
    : {
        labels: ['Einnahmen', 'Ausgaben'],
        datasets: [{
          label: 'Betrag',
          data: [summary.value.income || 0, summary.value.expense || 0]
        }]
      }
})

const categoryExpensesChartData = computed(() => {
  return statisticsStore.getCategoryExpensesChartData
    ? statisticsStore.getCategoryExpensesChartData(startDate.value, endDate.value)
    : {
        labels: topExpenseCategories.value.map(c => c.name),
        datasets: [{
          label: 'Ausgaben',
          data: topExpenseCategories.value.map(c => c.amount)
        }]
      }
})

const monthlyTrendChartData = computed(() => {
  return statisticsStore.getMonthlyTrendChartData
    ? statisticsStore.getMonthlyTrendChartData(trendMonths.value)
    : {
        labels: monthlyTrend.value.map(item => item.month),
        datasets: [{
          label: 'Einnahmen',
          data: monthlyTrend.value.map(item => item.income)
        }, {
          label: 'Ausgaben',
          data: monthlyTrend.value.map(item => item.expense)
        }]
      }
})

const accountTrendChartData = computed(() => {
  if (!selectedAccountId.value) return { labels: [], datasets: [] }
  return statisticsStore.getAccountBalanceTrendChartData
    ? statisticsStore.getAccountBalanceTrendChartData(selectedAccountId.value, accountTrendDays.value)
    : {
        labels: [startDate.value, endDate.value],
        datasets: [{
          label: 'Kontostand',
          data: accountTrend.value.map(item => item.balance)
        }]
      }
})

// Chart-Optionen
const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top'
    }
  }
}

const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'right'
    }
  }
}

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top'
    }
  }
}

// Konten für das Dropdown
const accounts = computed(() => {
  return accountStore.activeAccounts
})

// Setze das erste aktive Konto als Standard
onMounted(() => {
  if (accounts.value.length > 0) {
    selectedAccountId.value = accounts.value[0].id
  }
})

// Zeitraum ändern
const setTimeRange = (range: string) => {
  const today = dayjs()
  
  switch (range) {
    case 'thisMonth':
      startDate.value = today.startOf('month').format('YYYY-MM-DD')
      endDate.value = today.endOf('month').format('YYYY-MM-DD')
      break
    case 'lastMonth':
      startDate.value = today.subtract(1, 'month').startOf('month').format('YYYY-MM-DD')
      endDate.value = today.subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
      break
    case 'thisQuarter':
      startDate.value = today.startOf('quarter').format('YYYY-MM-DD')
      endDate.value = today.endOf('quarter').format('YYYY-MM-DD')
      break
    case 'thisYear':
      startDate.value = today.startOf('year').format('YYYY-MM-DD')
      endDate.value = today.endOf('year').format('YYYY-MM-DD')
      break
    case 'lastYear':
      startDate.value = today.subtract(1, 'year').startOf('year').format('YYYY-MM-DD')
      endDate.value = today.subtract(1, 'year').endOf('year').format('YYYY-MM-DD')
      break
  }
}
</script>

<template>
  <div>
    <!-- Header mit Zeitraumauswahl -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
      <h2 class="text-xl font-bold">Statistiken</h2>
      
      <div class="flex flex-wrap gap-2">
        <div class="btn-group">
          <button class="btn btn-sm" @click="setTimeRange('thisMonth')">Dieser Monat</button>
          <button class="btn btn-sm" @click="setTimeRange('lastMonth')">Letzter Monat</button>
          <button class="btn btn-sm" @click="setTimeRange('thisQuarter')">Dieses Quartal</button>
          <button class="btn btn-sm" @click="setTimeRange('thisYear')">Dieses Jahr</button>
          <button class="btn btn-sm" @click="setTimeRange('lastYear')">Letztes Jahr</button>
        </div>
        
        <div class="flex gap-2">
          <input 
            type="date" 
            v-model="startDate" 
            class="input input-bordered input-sm" 
          />
          <span class="self-center">bis</span>
          <input 
            type="date" 
            v-model="endDate" 
            class="input input-bordered input-sm" 
          />
        </div>
      </div>
    </div>
    
    <!-- Zusammenfassung -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="card bg-base-100 shadow-md">
        <div class="card-body">
          <h3 class="card-title text-lg">Einnahmen</h3>
          <p class="text-2xl font-bold text-success">{{ formatCurrency(summary.income) }}</p>
        </div>
      </div>
      
      <div class="card bg-base-100 shadow-md">
        <div class="card-body">
          <h3 class="card-title text-lg">Ausgaben</h3>
          <p class="text-2xl font-bold text-error">{{ formatCurrency(summary.expense) }}</p>
        </div>
      </div>
      
      <div class="card bg-base-100 shadow-md">
        <div class="card-body">
          <h3 class="card-title text-lg">Bilanz</h3>
          <p class="text-2xl font-bold" :class="summary.balance >= 0 ? 'text-success' : 'text-error'">
            {{ formatCurrency(summary.balance) }}
          </p>
        </div>
      </div>
    </div>
    
    <!-- Einnahmen vs. Ausgaben Chart -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div class="card bg-base-100 shadow-md">
        <div class="card-body">
          <h3 class="card-title text-lg">Einnahmen vs. Ausgaben</h3>
          <div class="h-64">
            <Bar 
              :data="incomeExpenseChartData" 
              :options="barChartOptions"
            />
          </div>
        </div>
      </div>
      
      <div class="card bg-base-100 shadow-md">
        <div class="card-body">
          <h3 class="card-title text-lg">Ausgaben nach Kategorien</h3>
          <div class="h-64">
            <Pie 
              :data="categoryExpensesChartData" 
              :options="pieChartOptions"
            />
          </div>
        </div>
      </div>
    </div>
    
    <!-- Top-Kategorien -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div class="card bg-base-100 shadow-md">
        <div class="card-body">
          <h3 class="card-title text-lg">Top-Ausgabenkategorien</h3>
          
          <div v-if="topExpenseCategories.length > 0" class="space-y-3">
            <div v-for="category in topExpenseCategories" :key="category.categoryId" class="space-y-1">
              <div class="flex justify-between items-center">
                <span>{{ category.name }}</span>
                <span class="font-medium">{{ formatCurrency(category.amount) }}</span>
              </div>
              <progress 
                class="progress progress-error w-full" 
                :value="category.amount" 
                :max="topExpenseCategories[0].amount"
              ></progress>
            </div>
          </div>
          
          <div v-else class="text-center py-4 text-base-content/70">
            Keine Ausgaben in diesem Zeitraum
          </div>
        </div>
      </div>
      
      <div class="card bg-base-100 shadow-md">
        <div class="card-body">
          <h3 class="card-title text-lg">Top-Einnahmenkategorien</h3>
          
          <div v-if="topIncomeCategories.length > 0" class="space-y-3">
            <div v-for="category in topIncomeCategories" :key="category.categoryId" class="space-y-1">
              <div class="flex justify-between items-center">
                <span>{{ category.name }}</span>
                <span class="font-medium">{{ formatCurrency(category.amount) }}</span>
              </div>
              <progress 
                class="progress progress-success w-full" 
                :value="category.amount" 
                :max="topIncomeCategories[0].amount"
              ></progress>
            </div>
          </div>
          
          <div v-else class="text-center py-4 text-base-content/70">
            Keine Einnahmen in diesem Zeitraum
          </div>
        </div>
      </div>
    </div>
    
    <!-- Monatlicher Trend -->
    <div class="card bg-base-100 shadow-md mb-6">
      <div class="card-body">
        <div class="flex justify-between items-center mb-4">
          <h3 class="card-title text-lg">Monatlicher Trend</h3>
          
          <select v-model="trendMonths" class="select select-bordered select-sm">
            <option :value="3">3 Monate</option>
            <option :value="6">6 Monate</option>
            <option :value="12">12 Monate</option>
          </select>
        </div>
        
        <div class="h-64">
          <Line 
            :data="monthlyTrendChartData" 
            :options="lineChartOptions"
          />
        </div>
      </div>
    </div>
    
    <!-- Kontoentwicklung -->
    <div class="card bg-base-100 shadow-md">
      <div class="card-body">
        <div class="flex justify-between items-center mb-4">
          <h3 class="card-title text-lg">Kontoentwicklung</h3>
          
          <div class="flex gap-2">
            <select v-model="selectedAccountId" class="select select-bordered select-sm">
              <option value="" disabled>Konto auswählen</option>
              <option v-for="account in accounts" :key="account.id" :value="account.id">
                {{ account.name }}
              </option>
            </select>
            
            <select v-model="accountTrendDays" class="select select-bordered select-sm">
              <option :value="7">7 Tage</option>
              <option :value="30">30 Tage</option>
              <option :value="90">90 Tage</option>
              <option :value="180">180 Tage</option>
              <option :value="365">1 Jahr</option>
            </select>
          </div>
        </div>
        
        <div v-if="selectedAccountId" class="h-64">
          <Line 
            :data="accountTrendChartData" 
            :options="lineChartOptions"
          />
        </div>
        
        <div v-else class="text-center py-4 text-base-content/70">
          Bitte wählen Sie ein Konto aus
        </div>
      </div>
    </div>
  </div>
</template>
