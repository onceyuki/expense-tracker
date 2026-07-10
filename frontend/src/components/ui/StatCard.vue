<script setup>
import { formatMoney } from '../../utils/format.js';
import Icon from './Icon.vue';
import SkeletonLoader from './SkeletonLoader.vue';

defineProps({
  label: { type: String, required: true },
  value: { type: Number, default: null },
  icon: { type: String, default: '' },
  tone: { type: String, default: 'neutral' }, // neutral | positive | negative
  hint: { type: String, default: '' },
  loading: { type: Boolean, default: false },
});

const tones = {
  neutral: 'text-slate-900 dark:text-slate-100',
  positive: 'text-brand-600 dark:text-brand-400',
  negative: 'text-rose-600 dark:text-rose-400',
};
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <SkeletonLoader v-if="loading" variant="stat" />
    <template v-else>
      <div class="flex items-center justify-between">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {{ label }}
        </p>
        <Icon v-if="icon" :name="icon" :size="16" class="text-slate-400 dark:text-slate-500" />
      </div>
      <p class="amount mt-2 text-2xl font-semibold" :class="tones[tone]">
        {{ formatMoney(value) }}
      </p>
      <p v-if="hint" class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ hint }}</p>
    </template>
  </div>
</template>
