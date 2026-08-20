<script setup>
import { formatMoney } from '../utils/format.js';
import BaseCard from './ui/BaseCard.vue';
import EmptyState from './ui/EmptyState.vue';

defineProps({
  // [{ id, name, color, balance }]
  wallets: { type: Array, required: true },
});
</script>

<template>
  <BaseCard title="Wallets">
    <ul v-if="wallets.length" class="divide-y divide-slate-100 dark:divide-slate-800">
      <li v-for="wallet in wallets" :key="wallet.id" class="flex items-center gap-3 py-2.5">
        <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: wallet.color ?? '#64748b' }" />
        <span class="flex-1 truncate text-sm font-semibold">{{ wallet.name }}</span>
        <span class="amount text-sm font-semibold" :class="wallet.balance < 0 ? 'text-rose-600 dark:text-rose-400' : ''">
          {{ formatMoney(wallet.balance) }}
        </span>
      </li>
    </ul>
    <EmptyState v-else title="No wallets yet" message="Add wallets to see balances here." />
  </BaseCard>
</template>
