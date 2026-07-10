<script setup>
import Icon from './Icon.vue';

defineProps({
  icon: { type: String, default: 'inbox' },
  title: { type: String, required: true },
  message: { type: String, default: '' },
});
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-12 text-center">
    <span class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
      <Icon :name="icon" :size="22" />
    </span>
    <h3 class="mt-4 font-bold tracking-tight">{{ title }}</h3>
    <p v-if="message" class="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{{ message }}</p>
    <div v-if="$slots.action" class="mt-5">
      <slot name="action" />
    </div>
  </div>
</template>
