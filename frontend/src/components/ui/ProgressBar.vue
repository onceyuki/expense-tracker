<script setup>
import { computed } from 'vue';

const props = defineProps({
  percent: { type: Number, required: true },
});

const width = computed(() => `${Math.min(100, Math.max(0, props.percent))}%`);

// Green → amber (75) → orange (90) → red (100+)
const color = computed(() => {
  if (props.percent >= 100) return 'bg-rose-500';
  if (props.percent >= 90) return 'bg-orange-500';
  if (props.percent >= 75) return 'bg-amber-500';
  return 'bg-brand-500';
});
</script>

<template>
  <div
    class="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
    role="progressbar"
    :aria-valuenow="Math.round(percent)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div class="h-full rounded-full transition-all duration-500" :class="color" :style="{ width }" />
  </div>
</template>
