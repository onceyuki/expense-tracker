<script setup>
import { onMounted, computed } from 'vue';
import { useAnalyticsStore } from '../stores/analytics.js';
import BaseCard from '../components/ui/BaseCard.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import LineChart from '../components/charts/LineChart.vue';
import BarChart from '../components/charts/BarChart.vue';
import DoughnutChart from '../components/charts/DoughnutChart.vue';
import { formatMonth } from '../utils/format.js';

const store = useAnalyticsStore();

const presets = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
  { value: 'custom', label: 'Custom range' },
];

const d = computed(() => store.data);

const periodLabels = computed(() =>
  d.value?.cashFlow.map((p) =>
    store.data.granularity === 'month' ? formatMonth(p.period).split(' ')[0].slice(0, 3) + ' ' + p.period.slice(2, 4) : p.period,
  ) ?? [],
);

const hasData = computed(() => (d.value?.cashFlow.length ?? 0) > 0);

onMounted(() => store.fetch());
</script>

<template>
  <div class="space-y-4">
    <!-- Period filter row -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        <button
          v-for="preset in presets"
          :key="preset.value"
          class="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="store.preset === preset.value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'"
          @click="store.setPreset(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div v-if="store.preset === 'custom'" class="flex items-end gap-2">
        <BaseInput v-model="store.customFrom" label="From" type="date" />
        <BaseInput v-model="store.customTo" label="To" type="date" />
        <BaseButton @click="store.fetch()">Apply</BaseButton>
      </div>
    </div>

    <SkeletonLoader v-if="store.loading && !d" variant="card" />

    <template v-else-if="hasData">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BaseCard title="Spending trend">
          <SkeletonLoader v-if="store.loading" variant="card" />
          <LineChart
            v-else
            :labels="periodLabels"
            :series="[{ label: 'Spending', values: d.spendingSeries.map((p) => p.amount), color: 'expense', fill: true }]"
            :height="250"
          />
        </BaseCard>

        <BaseCard title="Income growth">
          <SkeletonLoader v-if="store.loading" variant="card" />
          <LineChart
            v-else
            :labels="periodLabels"
            :series="[{ label: 'Income', values: d.incomeSeries.map((p) => p.amount), color: 'income', fill: true }]"
            :height="250"
          />
        </BaseCard>

        <BaseCard title="Cash flow (income vs expenses)">
          <SkeletonLoader v-if="store.loading" variant="card" />
          <BarChart
            v-else
            :labels="periodLabels"
            :series="[
              { label: 'Income', values: d.cashFlow.map((p) => p.income), color: 'income' },
              { label: 'Expenses', values: d.cashFlow.map((p) => p.expenses), color: 'expense' },
            ]"
            :height="250"
          />
        </BaseCard>

        <BaseCard title="Category breakdown">
          <SkeletonLoader v-if="store.loading" variant="card" />
          <DoughnutChart v-else :data="d.categoryBreakdown" :height="250" />
        </BaseCard>
      </div>

      <BaseCard v-if="d.budgetUtilization.length" title="Budget utilization by month">
        <BarChart
          :labels="d.budgetUtilization.map((b) => formatMonth(b.month).split(' ')[0].slice(0, 3) + ' ' + b.month.slice(2, 4))"
          :series="[
            { label: 'Budget', values: d.budgetUtilization.map((b) => b.budget), color: 'budget' },
            { label: 'Spent', values: d.budgetUtilization.map((b) => b.spent), color: 'expense' },
          ]"
          :height="240"
        />
      </BaseCard>
    </template>

    <BaseCard v-else>
      <EmptyState
        icon="chart"
        title="Not enough data yet"
        message="Add expenses and income to unlock spending trends, cash flow and category analytics."
      />
    </BaseCard>
  </div>
</template>
