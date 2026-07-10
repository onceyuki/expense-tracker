<script setup>
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import { useUiStore } from '../../stores/ui.js';
import { CATEGORY_COLORS, chartInk, doughnutOptions, foldCategories } from './chartTheme.js';

const props = defineProps({
  // [{ category, amount }]
  data: { type: Array, required: true },
  height: { type: Number, default: 240 },
});

const ui = useUiStore();

const chartData = computed(() => {
  const mode = ui.dark ? 'dark' : 'light';
  const folded = foldCategories(props.data);
  return {
    labels: folded.map((c) => c.category),
    datasets: [
      {
        data: folded.map((c) => c.amount),
        backgroundColor: folded.map((c) => CATEGORY_COLORS[mode][c.category] ?? CATEGORY_COLORS[mode].Other),
        borderColor: chartInk(ui.dark).surface,
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };
});

const options = computed(() => doughnutOptions(ui.dark));
</script>

<template>
  <div :style="{ height: `${height}px` }">
    <Doughnut :data="chartData" :options="options" />
  </div>
</template>
