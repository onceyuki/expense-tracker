<script setup>
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import { useUiStore } from '../../stores/ui.js';
import { SERIES, baseOptions } from './chartTheme.js';

const props = defineProps({
  labels: { type: Array, required: true },
  // [{ label, values, color? (SERIES key), fill? }]
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
      borderColor: palette[s.color ?? 'brand'],
      backgroundColor: s.fill ? palette.brandSoft : palette[s.color ?? 'brand'],
      fill: !!s.fill,
      tension: 0.35,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: palette[s.color ?? 'brand'],
    })),
  };
});

const options = computed(() => baseOptions(ui.dark, { legend: props.series.length > 1 }));
</script>

<template>
  <div :style="{ height: `${height}px` }">
    <Line :data="chartData" :options="options" />
  </div>
</template>
