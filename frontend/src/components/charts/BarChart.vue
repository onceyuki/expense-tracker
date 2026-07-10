<script setup>
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import { useUiStore } from '../../stores/ui.js';
import { SERIES, baseOptions } from './chartTheme.js';

const props = defineProps({
  labels: { type: Array, required: true },
  // [{ label, values, color? (SERIES key) }]
  series: { type: Array, required: true },
  height: { type: Number, default: 240 },
});

const ui = useUiStore();

const chartData = computed(() => {
  const palette = SERIES[ui.dark ? 'dark' : 'light'];
  return {
    labels: props.labels,
    datasets: props.series.map((s) => ({
      label: s.label,
      data: s.values,
      backgroundColor: palette[s.color ?? 'brand'],
      borderRadius: 4,
      borderSkipped: 'start',
      maxBarThickness: 28,
      categoryPercentage: 0.7,
      barPercentage: 0.85,
    })),
  };
});

const options = computed(() => baseOptions(ui.dark, { legend: props.series.length > 1 }));
</script>

<template>
  <div :style="{ height: `${height}px` }">
    <Bar :data="chartData" :options="options" />
  </div>
</template>
