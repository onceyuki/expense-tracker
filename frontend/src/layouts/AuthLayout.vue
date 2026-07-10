<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
    <div class="w-full max-w-md">
      <div class="mb-8 flex flex-col items-center gap-3">
        <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 font-mono text-lg font-semibold text-white">
          L
        </div>
        <div class="text-center">
          <h1 class="text-2xl font-extrabold tracking-tight">{{ title }}</h1>
          <p v-if="subtitle" class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ subtitle }}</p>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <slot />
      </div>

      <p class="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <slot name="footer" />
      </p>
    </div>
  </div>
</template>
