<script setup>
import { onMounted, ref, reactive, computed, watch } from 'vue';
import { useDebtsStore } from '../stores/debts.js';
import { useUiStore } from '../stores/ui.js';
import { apiErrorMessage } from '../services/api.js';
import { formatMoney, formatDate, toDateInput } from '../utils/format.js';
import BaseCard from '../components/ui/BaseCard.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseModal from '../components/ui/BaseModal.vue';
import DataTable from '../components/ui/DataTable.vue';
import PaginationBar from '../components/ui/PaginationBar.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import Icon from '../components/ui/Icon.vue';

const store = useDebtsStore();
const ui = useUiStore();

const formOpen = ref(false);
const editing = ref(null);
const saving = ref(false);

const columns = [
  { key: 'paid', label: '' },
  { key: 'date', label: 'Date' },
  { key: 'person', label: 'Source / To who' },
  { key: 'amount', label: 'Amount', align: 'right', class: 'amount font-semibold' },
  { key: 'notes', label: 'Notes', class: 'max-w-[200px] truncate text-slate-500' },
  { key: 'actions', label: '', align: 'right' },
];

const form = reactive({ person: '', amount: '', date: toDateInput(), notes: '' });
const touched = reactive({});

const errors = computed(() => ({
  person: touched.person && !form.person.trim() ? 'Who is this debt with?' : '',
  amount: touched.amount && (!form.amount || Number(form.amount) <= 0) ? 'Enter an amount above zero' : '',
  date: touched.date && !form.date ? 'Pick a date' : '',
}));

watch(formOpen, (open) => {
  if (!open) return;
  Object.keys(touched).forEach((k) => delete touched[k]);
  if (editing.value) {
    Object.assign(form, {
      person: editing.value.person,
      amount: editing.value.amount,
      date: toDateInput(editing.value.date),
      notes: editing.value.notes ?? '',
    });
  } else {
    Object.assign(form, { person: '', amount: '', date: toDateInput(), notes: '' });
  }
});

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(debt) {
  editing.value = debt;
  formOpen.value = true;
}

async function save() {
  ['person', 'amount', 'date'].forEach((k) => (touched[k] = true));
  if (Object.values(errors.value).some(Boolean)) return;

  saving.value = true;
  const payload = {
    person: form.person.trim(),
    amount: Number(form.amount),
    date: form.date,
    notes: form.notes.trim() || null,
  };
  try {
    if (editing.value) {
      await store.update(editing.value.id, payload);
      ui.toast('Debt updated');
    } else {
      await store.create(payload);
      ui.toast('Debt added');
    }
    formOpen.value = false;
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not save debt'), 'error');
  } finally {
    saving.value = false;
  }
}

async function togglePaid(debt) {
  try {
    await store.togglePaid(debt);
    ui.toast(debt.paid ? 'Marked as unpaid' : 'Marked as paid');
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  }
}

async function confirmDelete(debt) {
  const confirmed = await ui.confirm({
    title: 'Delete this debt?',
    message: `"${debt.person}" (${formatMoney(debt.amount)}) will be removed permanently.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.remove(debt.id);
    ui.toast('Debt deleted');
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  }
}

onMounted(() => store.fetch());
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <BaseCard>
        <p class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Unpaid</p>
        <p class="amount mt-1 text-lg font-semibold text-rose-600 dark:text-rose-400">{{ formatMoney(store.totals.unpaid) }}</p>
      </BaseCard>
      <BaseCard>
        <p class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Paid</p>
        <p class="amount mt-1 text-lg font-semibold text-brand-600 dark:text-brand-400">{{ formatMoney(store.totals.paid) }}</p>
      </BaseCard>
    </div>

    <div class="flex justify-end">
      <BaseButton @click="openCreate">
        <Icon name="plus" :size="16" />
        Add debt
      </BaseButton>
    </div>

    <BaseCard :padded="false">
      <SkeletonLoader v-if="store.loading && !store.items.length" variant="table" :count="5" class="p-5" />

      <template v-else-if="store.items.length">
        <DataTable :columns="columns" :rows="store.items">
          <template #cell-paid="{ row }">
            <input
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
              :checked="row.paid"
              :aria-label="row.paid ? 'Mark as unpaid' : 'Mark as paid'"
              @change="togglePaid(row)"
            />
          </template>
          <template #cell-date="{ value }">
            <span class="whitespace-nowrap text-slate-500 dark:text-slate-400">{{ formatDate(value) }}</span>
          </template>
          <template #cell-person="{ row }">
            <span class="font-semibold" :class="row.paid ? 'text-slate-400 line-through dark:text-slate-500' : ''">{{ row.person }}</span>
          </template>
          <template #cell-amount="{ value }">{{ formatMoney(value) }}</template>
          <template #cell-notes="{ value }">{{ value || '—' }}</template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end gap-0.5">
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Edit debt" title="Edit" @click="openEdit(row)">
                <Icon name="edit" :size="15" />
              </button>
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Delete debt" title="Delete" @click="confirmDelete(row)">
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
        icon="scale"
        title="No debts tracked"
        message="Record money you owe (or lent out) and tick it off when it's settled."
      >
        <template #action>
          <BaseButton @click="openCreate">
            <Icon name="plus" :size="16" />
            Add debt
          </BaseButton>
        </template>
      </EmptyState>
    </BaseCard>

    <BaseModal :open="formOpen" :title="editing ? 'Edit debt' : 'Add debt'" @close="formOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseInput v-model="form.person" label="Source / To who" placeholder="Who is this with?" :error="errors.person" required @blur="touched.person = true" />
        <div class="grid grid-cols-2 gap-4">
          <BaseInput v-model="form.amount" label="Amount" type="number" step="0.01" min="0" placeholder="0.00" :error="errors.amount" required @blur="touched.amount = true" />
          <BaseInput v-model="form.date" label="Date" type="date" :error="errors.date" required @blur="touched.date = true" />
        </div>
        <BaseInput v-model="form.notes" label="Notes" placeholder="Optional details" />
        <button type="submit" class="hidden" aria-hidden="true" />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="formOpen = false">Cancel</BaseButton>
        <BaseButton :loading="saving" @click="save">{{ editing ? 'Save changes' : 'Add debt' }}</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
