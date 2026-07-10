<script setup>
import { CATEGORIES, PAYMENT_METHODS } from '../utils/format.js';
import BaseSelect from './ui/BaseSelect.vue';
import BaseInput from './ui/BaseInput.vue';
import BaseButton from './ui/BaseButton.vue';

// v-model:filters proxied through events; parent owns the store
const props = defineProps({
  filters: { type: Object, required: true },
});

const emit = defineEmits(['apply', 'reset']);
</script>

<template>
  <div class="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/40 sm:grid-cols-2 lg:grid-cols-3">
    <BaseSelect v-model="props.filters.category" label="Category" :options="CATEGORIES" placeholder="All categories" />
    <BaseSelect v-model="props.filters.paymentMethod" label="Payment method" :options="PAYMENT_METHODS" placeholder="All methods" />
    <div class="grid grid-cols-2 gap-3">
      <BaseInput v-model="props.filters.dateFrom" label="From" type="date" />
      <BaseInput v-model="props.filters.dateTo" label="To" type="date" />
    </div>
    <div class="grid grid-cols-2 gap-3">
      <BaseInput v-model="props.filters.minAmount" label="Min amount" type="number" step="0.01" min="0" placeholder="0" />
      <BaseInput v-model="props.filters.maxAmount" label="Max amount" type="number" step="0.01" min="0" placeholder="∞" />
    </div>
    <div class="flex items-end gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
      <BaseButton variant="secondary" @click="emit('reset')">Clear</BaseButton>
      <BaseButton @click="emit('apply')">Apply filters</BaseButton>
    </div>
  </div>
</template>
