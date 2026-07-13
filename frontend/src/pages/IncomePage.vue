<script setup>
import { onMounted, ref, reactive, computed, watch } from 'vue';
import { useIncomeStore } from '../stores/income.js';
import { useWalletsStore } from '../stores/wallets.js';
import { useUiStore } from '../stores/ui.js';
import { apiErrorMessage } from '../services/api.js';
import { formatMoney, formatDate, toDateInput } from '../utils/format.js';
import { useDebounce } from '../composables/useDebounce.js';
import BaseCard from '../components/ui/BaseCard.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseModal from '../components/ui/BaseModal.vue';
import BaseSelect from '../components/ui/BaseSelect.vue';
import DataTable from '../components/ui/DataTable.vue';
import PaginationBar from '../components/ui/PaginationBar.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import Icon from '../components/ui/Icon.vue';

const store = useIncomeStore();
const wallets = useWalletsStore();
const ui = useUiStore();

const formOpen = ref(false);
const editing = ref(null);
const saving = ref(false);

const columns = [
  { key: 'date', label: 'Date' },
  { key: 'source', label: 'Source' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'amount', label: 'Amount', align: 'right', class: 'amount font-semibold text-brand-600 dark:text-brand-400' },
  { key: 'notes', label: 'Notes', class: 'max-w-[200px] truncate text-slate-500' },
  { key: 'actions', label: '', align: 'right' },
];

const form = reactive({ source: '', amount: '', date: toDateInput(), walletId: '', notes: '' });
const touched = reactive({});

const errors = computed(() => ({
  source: touched.source && !form.source.trim() ? 'Enter an income source' : '',
  amount: touched.amount && (!form.amount || Number(form.amount) <= 0) ? 'Enter an amount above zero' : '',
  date: touched.date && !form.date ? 'Pick a date' : '',
}));

watch(formOpen, (open) => {
  if (!open) return;
  Object.keys(touched).forEach((k) => delete touched[k]);
  if (editing.value) {
    Object.assign(form, {
      source: editing.value.source,
      amount: editing.value.amount,
      date: toDateInput(editing.value.date),
      walletId: editing.value.walletId ?? '',
      notes: editing.value.notes ?? '',
    });
  } else {
    Object.assign(form, { source: '', amount: '', date: toDateInput(), walletId: '', notes: '' });
  }
});

const debouncedSearch = useDebounce(() => store.applySearch(), 350);

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(income) {
  editing.value = income;
  formOpen.value = true;
}

async function save() {
  ['source', 'amount', 'date'].forEach((k) => (touched[k] = true));
  if (Object.values(errors.value).some(Boolean)) return;

  saving.value = true;
  const payload = {
    source: form.source.trim(),
    amount: Number(form.amount),
    date: form.date,
    walletId: form.walletId || null,
    notes: form.notes.trim() || null,
  };
  try {
    if (editing.value) {
      await store.update(editing.value.id, payload);
      ui.toast('Income updated');
    } else {
      await store.create(payload);
      ui.toast('Income added');
    }
    formOpen.value = false;
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not save income'), 'error');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(income) {
  const confirmed = await ui.confirm({
    title: 'Delete this income record?',
    message: `"${income.source}" (${formatMoney(income.amount)}) will be removed permanently.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.remove(income.id);
    ui.toast('Income deleted');
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  }
}

onMounted(() => {
  store.fetch();
  wallets.ensureLoaded();
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-0 flex-1 sm:max-w-xs">
        <Icon name="search" :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="store.search"
          type="search"
          placeholder="Search income…"
          class="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900"
          @input="debouncedSearch"
        />
      </div>
      <BaseButton class="ml-auto" @click="openCreate">
        <Icon name="plus" :size="16" />
        Add income
      </BaseButton>
    </div>

    <BaseCard :padded="false">
      <SkeletonLoader v-if="store.loading && !store.items.length" variant="table" :count="5" class="p-5" />

      <template v-else-if="store.items.length">
        <DataTable :columns="columns" :rows="store.items">
          <template #cell-date="{ value }">
            <span class="whitespace-nowrap text-slate-500 dark:text-slate-400">{{ formatDate(value) }}</span>
          </template>
          <template #cell-source="{ value }">
            <span class="font-semibold">{{ value }}</span>
          </template>
          <template #cell-wallet="{ row }">{{ row.wallet?.name ?? '—' }}</template>
          <template #cell-amount="{ value }">+{{ formatMoney(value) }}</template>
          <template #cell-notes="{ value }">{{ value || '—' }}</template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end gap-0.5">
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Edit income" title="Edit" @click="openEdit(row)">
                <Icon name="edit" :size="15" />
              </button>
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Delete income" title="Delete" @click="confirmDelete(row)">
                <Icon name="trash" :size="15" />
              </button>
            </div>
          </template>
        </DataTable>

        <div class="border-t border-slate-100 px-4 dark:border-slate-800">
          <PaginationBar
            :page="store.page"
            :total-pages="store.totalPages"
            :total="store.total"
            :page-size="store.pageSize"
            @update:page="store.setPage($event)"
          />
        </div>
      </template>

      <EmptyState
        v-else
        icon="trending-up"
        :title="store.search ? 'No matching income' : 'No income recorded yet'"
        :message="store.search ? 'Try a different search term.' : 'Add salary, freelance work or any other income to track your cash flow.'"
      >
        <template #action>
          <BaseButton v-if="!store.search" @click="openCreate">
            <Icon name="plus" :size="16" />
            Add income
          </BaseButton>
        </template>
      </EmptyState>
    </BaseCard>

    <BaseModal :open="formOpen" :title="editing ? 'Edit income' : 'Add income'" @close="formOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseInput v-model="form.source" label="Source" placeholder="Salary, freelance, dividends…" :error="errors.source" required @blur="touched.source = true" />
        <div class="grid grid-cols-2 gap-4">
          <BaseInput v-model="form.amount" label="Amount" type="number" step="0.01" min="0" placeholder="0.00" :error="errors.amount" required @blur="touched.amount = true" />
          <BaseInput v-model="form.date" label="Date" type="date" :error="errors.date" required @blur="touched.date = true" />
        </div>
        <BaseSelect v-model="form.walletId" label="Wallet" :options="wallets.options" placeholder="No wallet" />
        <BaseInput v-model="form.notes" label="Notes" placeholder="Optional details" />
        <button type="submit" class="hidden" aria-hidden="true" />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="formOpen = false">Cancel</BaseButton>
        <BaseButton :loading="saving" @click="save">{{ editing ? 'Save changes' : 'Add income' }}</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
