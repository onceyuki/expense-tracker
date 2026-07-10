<script setup>
import { computed, onMounted, ref } from 'vue';
import { useDashboardStore } from '../stores/dashboard.js';
import { useExpensesStore } from '../stores/expenses.js';
import { useUiStore } from '../stores/ui.js';
import { formatMoney, formatDate, formatMonth } from '../utils/format.js';
import StatCard from '../components/ui/StatCard.vue';
import BaseCard from '../components/ui/BaseCard.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import Icon from '../components/ui/Icon.vue';
import DoughnutChart from '../components/charts/DoughnutChart.vue';
import LineChart from '../components/charts/LineChart.vue';
import BarChart from '../components/charts/BarChart.vue';
import ExpenseFormModal from '../components/ExpenseFormModal.vue';

const dashboard = useDashboardStore();
const expenses = useExpensesStore();
const ui = useUiStore();

const quickAddOpen = ref(false);

const d = computed(() => dashboard.data);
const hasExpenses = computed(() => (d.value?.charts.byCategory.length ?? 0) > 0);

const monthLabel = computed(() => (d.value ? formatMonth(d.value.month) : ''));

const monthLabels = computed(() =>
  d.value?.charts.monthlyExpenses.map((m) => formatMonth(m.month).split(' ')[0].slice(0, 3)) ?? [],
);

async function load() {
  await dashboard.fetch();
  // Budget alerts arrive with the dashboard; surface them once per session
  if (!dashboard.alertsShown && d.value?.alerts.length) {
    dashboard.alertsShown = true;
    for (const alert of d.value.alerts) {
      const scope = alert.category ? `${alert.category} budget` : 'Monthly budget';
      const message =
        alert.level >= 100
          ? `${scope} exceeded — ${alert.percentUsed}% used`
          : `${scope} at ${alert.percentUsed}% of its limit`;
      ui.toast(message, alert.level >= 90 ? 'error' : 'warning', 6000);
    }
  }
}

async function quickAdd(payload) {
  await expenses.create(payload);
  await dashboard.fetch();
}

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <!-- Header row -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ monthLabel }}</p>
        <h2 class="text-xl font-extrabold tracking-tight">Your money at a glance</h2>
      </div>
      <BaseButton @click="quickAddOpen = true">
        <Icon name="plus" :size="16" />
        Add expense
      </BaseButton>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Total income" :value="d?.totals.income" icon="trending-up" tone="positive" :loading="dashboard.loading" :hint="`Savings rate ${d?.stats.savingsRate ?? 0}%`" />
      <StatCard label="Total expenses" :value="d?.totals.expenses" icon="wallet" tone="negative" :loading="dashboard.loading" :hint="`Avg ${formatMoney(d?.stats.avgDailySpending)} / day`" />
      <StatCard label="Savings" :value="d?.totals.savings" icon="target" :tone="(d?.totals.savings ?? 0) >= 0 ? 'positive' : 'negative'" :loading="dashboard.loading" hint="Income minus expenses" />
      <StatCard label="Monthly budget" :value="d?.totals.monthlyBudget" icon="calendar" :loading="dashboard.loading" hint="Overall limit for this month" />
      <StatCard label="Remaining budget" :value="d?.totals.remainingBudget" icon="check" :tone="(d?.totals.remainingBudget ?? 0) >= 0 ? 'neutral' : 'negative'" :loading="dashboard.loading" />
      <StatCard label="Current balance" :value="d?.totals.balance" icon="chart" :tone="(d?.totals.balance ?? 0) >= 0 ? 'positive' : 'negative'" :loading="dashboard.loading" hint="All-time income minus expenses" />
    </div>

    <!-- Secondary stats strip -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <BaseCard>
        <p class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Today</p>
        <p class="amount mt-1 text-lg font-semibold">{{ formatMoney(d?.today.spending) }}</p>
      </BaseCard>
      <BaseCard>
        <p class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">This week</p>
        <p class="amount mt-1 text-lg font-semibold">{{ formatMoney(d?.week.spending) }}</p>
      </BaseCard>
      <BaseCard>
        <p class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Highest expense</p>
        <p class="amount mt-1 text-lg font-semibold">{{ d?.stats.highestExpense != null ? formatMoney(d.stats.highestExpense) : '—' }}</p>
      </BaseCard>
      <BaseCard>
        <p class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Lowest expense</p>
        <p class="amount mt-1 text-lg font-semibold">{{ d?.stats.lowestExpense != null ? formatMoney(d.stats.lowestExpense) : '—' }}</p>
      </BaseCard>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BaseCard title="Expenses by category">
        <SkeletonLoader v-if="dashboard.loading" variant="card" />
        <DoughnutChart v-else-if="hasExpenses" :data="d.charts.byCategory" :height="260" />
        <EmptyState v-else title="No expenses yet" message="Add your first expense to see where your money goes." />
      </BaseCard>

      <BaseCard title="Monthly expenses">
        <SkeletonLoader v-if="dashboard.loading" variant="card" />
        <LineChart
          v-else
          :labels="monthLabels"
          :series="[{ label: 'Expenses', values: d.charts.monthlyExpenses.map((m) => m.amount), fill: true }]"
          :height="260"
        />
      </BaseCard>

      <BaseCard title="Income vs expenses">
        <SkeletonLoader v-if="dashboard.loading" variant="card" />
        <BarChart
          v-else
          :labels="monthLabels"
          :series="[
            { label: 'Income', values: d.charts.incomeVsExpenses.map((m) => m.income), color: 'income' },
            { label: 'Expenses', values: d.charts.incomeVsExpenses.map((m) => m.expenses), color: 'expense' },
          ]"
          :height="260"
        />
      </BaseCard>

      <BaseCard title="Weekly spending">
        <SkeletonLoader v-if="dashboard.loading" variant="card" />
        <BarChart
          v-else
          :labels="d.charts.weeklySpending.map((day) => day.day)"
          :series="[{ label: 'Spent', values: d.charts.weeklySpending.map((day) => day.amount) }]"
          :height="260"
        />
      </BaseCard>
    </div>

    <!-- Bottom row: top categories + recent activity -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BaseCard title="Top spending categories">
        <SkeletonLoader v-if="dashboard.loading" :count="5" />
        <ul v-else-if="d.stats.topCategories.length" class="divide-y divide-slate-100 dark:divide-slate-800">
          <li v-for="(cat, i) in d.stats.topCategories" :key="cat.category" class="flex items-center gap-3 py-2.5">
            <span class="w-5 text-xs font-bold text-slate-400">{{ i + 1 }}</span>
            <span class="flex-1 text-sm font-semibold">{{ cat.category }}</span>
            <span class="amount text-sm font-semibold">{{ formatMoney(cat.amount) }}</span>
          </li>
        </ul>
        <EmptyState v-else title="Nothing here yet" message="Spending by category shows up as you add expenses." />
      </BaseCard>

      <BaseCard title="Recent activity">
        <SkeletonLoader v-if="dashboard.loading" :count="5" />
        <ul v-else-if="d.recentActivity.length" class="divide-y divide-slate-100 dark:divide-slate-800">
          <li v-for="item in d.recentActivity.slice(0, 6)" :key="`${item.type}-${item.id}`" class="flex items-center gap-3 py-2.5">
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              :class="item.type === 'income' ? 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'"
            >
              <Icon :name="item.type === 'income' ? 'trending-up' : 'wallet'" :size="15" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">{{ item.title }}</span>
              <span class="block text-xs text-slate-500">{{ formatDate(item.date) }}</span>
            </span>
            <span class="amount text-sm font-semibold" :class="item.type === 'income' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-900 dark:text-slate-100'">
              {{ item.type === 'income' ? '+' : '−' }}{{ formatMoney(item.amount) }}
            </span>
          </li>
        </ul>
        <EmptyState v-else title="No activity yet" message="Expenses and income you add will appear here." />
      </BaseCard>
    </div>

    <ExpenseFormModal :open="quickAddOpen" :submit="quickAdd" @close="quickAddOpen = false" />
  </div>
</template>
