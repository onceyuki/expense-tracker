<script setup>
import { computed, onMounted } from 'vue';
import { Doughnut } from 'vue-chartjs';
import { useUiStore } from '../../stores/ui.js';
import { useCategoriesStore } from '../../stores/categories.js';
import { chartInk, doughnutOptions, foldCategories, OTHER_SLICE_COLOR } from './chartTheme.js';

const props = defineProps({
  // [{ category, amount }]
  data: { type: Array, required: true },
  height: { type: Number, default: 240 },
});

const ui = useUiStore();
const categories = useCategoriesStore();

onMounted(() => categories.ensureLoaded());

const chartData = computed(() => {
  const mode = ui.dark ? 'dark' : 'light';
  const folded = foldCategories(props.data);
  return {
    labels: folded.map((c) => c.category),
    datasets: [
      {
        data: folded.map((c) => c.amount),
        backgroundColor: folded.map((c) =>
          c.category === 'Other' ? OTHER_SLICE_COLOR[mode] : categories.colorOf(c.category),
        ),
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
