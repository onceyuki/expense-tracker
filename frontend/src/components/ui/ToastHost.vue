<script setup>
import { useUiStore } from '../../stores/ui.js';
import Icon from './Icon.vue';

const ui = useUiStore();

const styles = {
  success: 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200',
  error: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  info: 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
};

const icons = { success: 'check', error: 'alert', warning: 'alert', info: 'bell' };
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      <TransitionGroup name="toast">
        <div
          v-for="toast in ui.toasts"
          :key="toast.id"
          class="pointer-events-auto flex items-start gap-3 rounded-xl border p-4 text-sm font-medium shadow-lg"
          :class="styles[toast.type] ?? styles.info"
          role="status"
        >
          <Icon :name="icons[toast.type] ?? 'bell'" :size="18" class="mt-0.5 shrink-0" />
          <p class="flex-1">{{ toast.message }}</p>
          <button
            class="shrink-0 opacity-60 hover:opacity-100"
            aria-label="Dismiss notification"
            @click="ui.dismissToast(toast.id)"
          >
            <Icon name="x" :size="16" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
