<script setup>
import { onMounted, ref, reactive, computed, watch } from 'vue';
import { useWalletsStore } from '../stores/wallets.js';
import { useUiStore } from '../stores/ui.js';
import { apiErrorMessage } from '../services/api.js';
import { formatMoney, formatDate } from '../utils/format.js';
import BaseCard from '../components/ui/BaseCard.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseModal from '../components/ui/BaseModal.vue';
import DataTable from '../components/ui/DataTable.vue';
import PaginationBar from '../components/ui/PaginationBar.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import Icon from '../components/ui/Icon.vue';
import TransferFormModal from '../components/TransferFormModal.vue';

const SWATCHES = [
  '#eda100', '#2a78d6', '#1baf7a', '#e87ba4', '#4a3aa7', '#eb6834',
  '#e34948', '#008300', '#0891b2', '#4d7c0f', '#9333ea', '#64748b',
];

const store = useWalletsStore();
const ui = useUiStore();

const formOpen = ref(false);
const editing = ref(null);
const saving = ref(false);
const touched = reactive({});
const form = reactive({ name: '', color: '', initialBalance: '' });

const transferOpen = ref(false);
const editingTransfer = ref(null);

const transferColumns = [
  { key: 'date', label: 'Date' },
  { key: 'from', label: 'From' },
  { key: 'to', label: 'To' },
  { key: 'amount', label: 'Amount', align: 'right', class: 'amount font-semibold' },
  { key: 'actions', label: '', align: 'right' },
];

const errors = computed(() => ({
  name: touched.name && !form.name.trim() ? 'Give this wallet a name' : '',
}));

watch(formOpen, (open) => {
  if (!open) return;
  touched.name = false;
  if (editing.value) {
    form.name = editing.value.name;
    form.color = editing.value.color ?? '';
    form.initialBalance = editing.value.initialBalance;
  } else {
    form.name = '';
    form.color = SWATCHES[store.wallets.length % SWATCHES.length];
    form.initialBalance = '';
  }
});

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(wallet) {
  editing.value = wallet;
  formOpen.value = true;
}

async function save() {
  touched.name = true;
  if (errors.value.name) return;

  saving.value = true;
  const payload = {
    name: form.name.trim(),
    color: form.color || null,
    initialBalance: Number(form.initialBalance) || 0,
  };
  try {
    if (editing.value) {
      await store.update(editing.value.id, payload);
      ui.toast('Wallet updated');
    } else {
      await store.create(payload);
      ui.toast('Wallet added');
    }
    formOpen.value = false;
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not save wallet'), 'error');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(wallet) {
  const confirmed = await ui.confirm({
    title: 'Delete this wallet?',
    message: `"${wallet.name}" will be removed. This is blocked while expenses, income or transfers still use it.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.remove(wallet.id);
    ui.toast('Wallet deleted');
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not delete wallet'), 'error');
  }
}

function openNewTransfer() {
  editingTransfer.value = null;
  transferOpen.value = true;
}

function openEditTransfer(transfer) {
  editingTransfer.value = transfer;
  transferOpen.value = true;
}

async function confirmDeleteTransfer(transfer) {
  const confirmed = await ui.confirm({
    title: 'Delete this transfer?',
    message: `${formatMoney(transfer.amount)} from ${transfer.fromWallet?.name} to ${transfer.toWallet?.name} will be removed and balances restored.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.removeTransfer(transfer.id);
    ui.toast('Transfer deleted');
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  }
}

onMounted(() => {
  store.fetch();
  store.fetchTransfers();
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Balances update automatically from income, expenses and transfers.
      </p>
      <BaseButton @click="openCreate">
        <Icon name="plus" :size="16" />
        Add wallet
      </BaseButton>
    </div>

    <SkeletonLoader v-if="store.loading && !store.wallets.length" variant="card" :count="3" />

    <div v-else-if="store.wallets.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <BaseCard v-for="wallet in store.wallets" :key="wallet.id">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: wallet.color ?? '#64748b' }" />
            <span class="text-sm font-bold">{{ wallet.name }}</span>
          </div>
          <div class="flex gap-0.5">
            <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Edit wallet" title="Edit" @click="openEdit(wallet)">
              <Icon name="edit" :size="15" />
            </button>
            <button class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Delete wallet" title="Delete" @click="confirmDelete(wallet)">
              <Icon name="trash" :size="15" />
            </button>
          </div>
        </div>
        <p class="amount mt-3 text-2xl font-extrabold tracking-tight">{{ formatMoney(wallet.balance) }}</p>
        <dl class="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <dt class="font-semibold uppercase tracking-wider">Initial</dt>
            <dd class="amount mt-0.5">{{ formatMoney(wallet.initialBalance) }}</dd>
          </div>
          <div>
            <dt class="font-semibold uppercase tracking-wider">In</dt>
            <dd class="amount mt-0.5 text-brand-600 dark:text-brand-400">{{ formatMoney(wallet.totalIncome + wallet.transfersIn) }}</dd>
          </div>
          <div>
            <dt class="font-semibold uppercase tracking-wider">Out</dt>
            <dd class="amount mt-0.5 text-rose-600 dark:text-rose-400">{{ formatMoney(wallet.totalExpenses + wallet.transfersOut) }}</dd>
          </div>
        </dl>
      </BaseCard>
    </div>

    <BaseCard v-else>
      <EmptyState icon="credit-card" title="No wallets yet" message="Add wallets like Cash or GCash to track where your money lives.">
        <template #action>
          <BaseButton @click="openCreate">
            <Icon name="plus" :size="16" />
            Add wallet
          </BaseButton>
        </template>
      </EmptyState>
    </BaseCard>

    <div class="flex items-center justify-between gap-3">
      <h3 class="text-base font-bold tracking-tight">Transfers</h3>
      <BaseButton variant="secondary" :disabled="store.wallets.length < 2" @click="openNewTransfer">
        <Icon name="arrow-right-left" :size="16" />
        New transfer
      </BaseButton>
    </div>

    <BaseCard :padded="false">
      <SkeletonLoader v-if="store.transfersLoading && !store.transfers.length" variant="table" :count="3" class="p-5" />
      <template v-else-if="store.transfers.length">
        <DataTable :columns="transferColumns" :rows="store.transfers">
          <template #cell-date="{ row }">
            <span class="whitespace-nowrap text-slate-500 dark:text-slate-400">{{ formatDate(row.date) }}</span>
          </template>
          <template #cell-from="{ row }">{{ row.fromWallet?.name ?? '—' }}</template>
          <template #cell-to="{ row }">{{ row.toWallet?.name ?? '—' }}</template>
          <template #cell-amount="{ row }">{{ formatMoney(row.amount) }}</template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end gap-0.5">
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Edit transfer" title="Edit" @click="openEditTransfer(row)">
                <Icon name="edit" :size="15" />
              </button>
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Delete transfer" title="Delete" @click="confirmDeleteTransfer(row)">
                <Icon name="trash" :size="15" />
              </button>
            </div>
          </template>
        </DataTable>
        <div class="border-t border-slate-100 px-4 dark:border-slate-800">
          <PaginationBar
            :page="store.transfersPage"
            :total-pages="store.transfersTotalPages"
            :total="store.transfersTotal"
            :page-size="store.transfersPageSize"
            @update:page="store.setTransfersPage($event)"
          />
        </div>
      </template>
      <EmptyState v-else icon="arrow-right-left" title="No transfers yet" message="Move money between wallets — balances update on both sides." />
    </BaseCard>

    <BaseModal :open="formOpen" :title="editing ? 'Edit wallet' : 'Add wallet'" @close="formOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseInput v-model="form.name" label="Name" placeholder="e.g. GCash" :error="errors.name" required @blur="touched.name = true" />
        <BaseInput v-model="form.initialBalance" label="Initial balance" type="number" step="0.01" placeholder="0.00" />
        <div>
          <span class="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Color</span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="swatch in SWATCHES"
              :key="swatch"
              type="button"
              class="h-7 w-7 rounded-full ring-offset-2 ring-offset-white transition-transform hover:scale-110 dark:ring-offset-slate-900"
              :class="form.color === swatch ? 'ring-2 ring-slate-900 dark:ring-white' : ''"
              :style="{ backgroundColor: swatch }"
              :aria-label="`Choose color ${swatch}`"
              @click="form.color = swatch"
            />
          </div>
        </div>
        <button type="submit" class="hidden" aria-hidden="true" />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="formOpen = false">Cancel</BaseButton>
        <BaseButton :loading="saving" @click="save">{{ editing ? 'Save changes' : 'Add wallet' }}</BaseButton>
      </template>
    </BaseModal>

    <TransferFormModal :open="transferOpen" :transfer="editingTransfer" @close="transferOpen = false" />
  </div>
</template>
