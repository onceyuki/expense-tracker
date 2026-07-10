<script setup>
defineProps({
  title: { type: String, default: '' },
  padded: { type: Boolean, default: true },
});
</script>

<template>
  <section
    class="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
  >
    <header v-if="title || $slots.actions" class="flex items-center justify-between px-5 pt-4">
      <h2 class="text-sm font-bold tracking-tight text-slate-700 dark:text-slate-200">{{ title }}</h2>
      <slot name="actions" />
    </header>
    <div :class="padded ? 'p-5' : ''">
      <slot />
    </div>
  </section>
</template>
