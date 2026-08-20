<script setup>
import { formatMoney } from '../utils/format.js';
import BaseCard from './ui/BaseCard.vue';

defineProps({
  // { thisMonth: { startBalance, income, expense, debt, savings, endBalance }, lastMonth: {...} }
  cashFlow: { type: Object, required: true },
});

const ROWS = [
  { key: 'startBalance', label: 'Start balance' },
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expense' },
  { key: 'debt', label: 'Debt (unpaid)' },
  { key: 'savings', label: 'Savings' },
  { key: 'endBalance', label: 'End balance' },
];
</script>

<template>
  <BaseCard title="Cash flow">
    <table class="w-full text-sm">
      <thead>
        <tr class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <th class="pb-2 text-left font-bold"></th>
          <th class="pb-2 text-right font-bold">Last month</th>
          <th class="pb-2 text-right font-bold">This month</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
        <tr v-for="row in ROWS" :key="row.key" :class="row.key === 'endBalance' ? 'font-bold' : ''">
          <td class="py-2 font-semibold text-slate-600 dark:text-slate-300">{{ row.label }}</td>
          <td class="amount py-2 text-right text-slate-500 dark:text-slate-400">{{ formatMoney(cashFlow.lastMonth[row.key]) }}</td>
          <td class="amount py-2 text-right">{{ formatMoney(cashFlow.thisMonth[row.key]) }}</td>
        </tr>
      </tbody>
    </table>
  </BaseCard>
</template>
