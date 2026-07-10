<script setup>
import BaseButton from '../components/ui/BaseButton.vue';
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
    <p class="amount text-7xl font-semibold text-brand-600 dark:text-brand-400">404</p>
    <h1 class="mt-4 text-2xl font-extrabold tracking-tight">Page not found</h1>
    <p class="mt-2 max-w-sm text-slate-500 dark:text-slate-400">
      The page you're looking for doesn't exist or has been moved.
    </p>
    <RouterLink to="/" class="mt-6">
      <BaseButton>Back to dashboard</BaseButton>
    </RouterLink>
  </div>
</template>
