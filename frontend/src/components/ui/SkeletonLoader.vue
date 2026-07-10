<script setup>
defineProps({
  variant: { type: String, default: 'lines' }, // lines | card | table | stat
  count: { type: Number, default: 3 },
});
</script>

<template>
  <div aria-busy="true" aria-live="polite">
    <template v-if="variant === 'lines'">
      <div class="space-y-3">
        <div v-for="i in count" :key="i" class="skeleton h-4" :style="{ width: `${100 - i * 12}%` }" />
      </div>
    </template>

    <template v-else-if="variant === 'stat'">
      <div class="space-y-3">
        <div class="skeleton h-3 w-24" />
        <div class="skeleton h-7 w-32" />
      </div>
    </template>

    <template v-else-if="variant === 'card'">
      <div class="space-y-4">
        <div class="skeleton h-5 w-40" />
        <div class="skeleton h-40 w-full" />
      </div>
    </template>

    <template v-else-if="variant === 'table'">
      <div class="space-y-2.5">
        <div class="skeleton h-9 w-full" />
        <div v-for="i in count" :key="i" class="skeleton h-12 w-full" />
      </div>
    </template>
  </div>
</template>
