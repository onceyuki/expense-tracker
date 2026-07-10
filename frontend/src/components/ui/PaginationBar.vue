<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';

const props = defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  total: { type: Number, required: true },
  pageSize: { type: Number, required: true },
});

const emit = defineEmits(['update:page']);

const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1));
const to = computed(() => Math.min(props.page * props.pageSize, props.total));

function go(page) {
  if (page >= 1 && page <= props.totalPages && page !== props.page) {
    emit('update:page', page);
  }
}
</script>

<template>
  <div class="flex items-center justify-between gap-3 px-1 py-3 text-sm">
    <p class="text-slate-500 dark:text-slate-400">
      Showing <span class="font-semibold text-slate-700 dark:text-slate-200">{{ from }}–{{ to }}</span>
      of <span class="font-semibold text-slate-700 dark:text-slate-200">{{ total }}</span>
    </p>
    <div class="flex items-center gap-1">
      <button
        class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-slate-800"
        :disabled="page <= 1"
        aria-label="Previous page"
        data-test="prev"
        @click="go(page - 1)"
      >
        <Icon name="chevron-left" :size="16" />
      </button>
      <span class="min-w-[80px] text-center font-semibold">{{ page }} / {{ Math.max(totalPages, 1) }}</span>
      <button
        class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-slate-800"
        :disabled="page >= totalPages"
        aria-label="Next page"
        data-test="next"
        @click="go(page + 1)"
      >
        <Icon name="chevron-right" :size="16" />
      </button>
    </div>
  </div>
</template>
