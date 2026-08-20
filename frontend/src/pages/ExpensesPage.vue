<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useExpensesStore } from '../stores/expenses.js';
import { useUiStore } from '../stores/ui.js';
import { useCategoriesStore } from '../stores/categories.js';
import { apiErrorMessage } from '../services/api.js';
import { formatMoney, formatDate, categoryChipStyle } from '../utils/format.js';
import { useDebounce } from '../composables/useDebounce.js';
import BaseCard from '../components/ui/BaseCard.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import DataTable from '../components/ui/DataTable.vue';
import PaginationBar from '../components/ui/PaginationBar.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import Icon from '../components/ui/Icon.vue';
import ExpenseFormModal from '../components/ExpenseFormModal.vue';
import ExpenseFilters from '../components/ExpenseFilters.vue';
import BaseModal from '../components/ui/BaseModal.vue';

const store = useExpensesStore();
const ui = useUiStore();
const categories = useCategoriesStore();

const formOpen = ref(false);
const editing = ref(null);
const viewing = ref(null);
const filtersOpen = ref(false);
const searchInput = ref(null);

const columns = [
  { key: 'date', label: 'Date', sortable: true },
  { key: 'title', label: 'Title', sortable: true },
  { key: 'category', label: 'Category', sortable: true },
  { key: 'amount', label: 'Amount', sortable: true, align: 'right', class: 'amount font-semibold' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'notes', label: 'Notes', class: 'max-w-[160px] truncate text-slate-500' },
  { key: 'actions', label: '', align: 'right' },
];

const debouncedSearch = useDebounce(() => store.applyFilters(), 350);

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(expense) {
  editing.value = expense;
  formOpen.value = true;
}

function submitForm(payload) {
  return editing.value ? store.update(editing.value.id, payload) : store.create(payload);
}

async function confirmDelete(expense) {
  const confirmed = await ui.confirm({
    title: 'Delete this expense?',
    message: `"${expense.title}" (${formatMoney(expense.amount)}) will be removed permanently.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.remove(expense.id);
    ui.toast('Expense deleted');
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not delete expense'), 'error');
  }
}

async function duplicate(expense) {
  try {
    await store.duplicate(expense.id);
    ui.toast(`Duplicated "${expense.title}" with today's date`);
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  }
}

async function exportFile(format) {
  try {
    await store.exportFile(format);
    ui.toast(`Export started (${format.toUpperCase()})`);
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Export failed'), 'error');
  }
}

// Keyboard shortcuts: n = new expense, / = focus search
function onKeydown(event) {
  if (event.target.matches('input, textarea, select') || event.metaKey || event.ctrlKey) return;
  if (event.key === 'n') {
    event.preventDefault();
    openCreate();
  } else if (event.key === '/') {
    event.preventDefault();
    searchInput.value?.focus();
  }
}

onMounted(() => {
  store.fetch();
  categories.ensureLoaded();
  document.addEventListener('keydown', onKeydown);
});
onUnmounted(() => document.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-0 flex-1 sm:max-w-xs">
        <Icon name="search" :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref="searchInput"
          v-model="store.filters.search"
          type="search"
          placeholder="Search expenses…  ( / )"
          class="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900"
          @input="debouncedSearch"
        />
      </div>
      <BaseButton variant="secondary" @click="filtersOpen = !filtersOpen">
        <Icon name="filter" :size="15" />
        Filters
        <span v-if="store.hasActiveFilters" class="h-1.5 w-1.5 rounded-full bg-brand-500" />
      </BaseButton>
      <div class="ml-auto flex gap-2">
        <BaseButton variant="secondary" @click="exportFile('csv')">
          <Icon name="download" :size="15" />
          CSV
        </BaseButton>
        <BaseButton variant="secondary" @click="exportFile('xlsx')">
          <Icon name="download" :size="15" />
          Excel
        </BaseButton>
      </div>
    </div>

    <ExpenseFilters
      v-if="filtersOpen"
      :filters="store.filters"
      @apply="store.applyFilters()"
      @reset="store.resetFilters()"
    />

    <!-- Table -->
    <BaseCard :padded="false">
      <SkeletonLoader v-if="store.loading && !store.items.length" variant="table" :count="6" class="p-5" />

      <template v-else-if="store.items.length">
        <DataTable
          :columns="columns"
          :rows="store.items"
          :sort-by="store.sortBy"
          :sort-dir="store.sortDir"
          @sort="store.setSort($event)"
        >
          <template #cell-date="{ value }">
            <span class="whitespace-nowrap text-slate-500 dark:text-slate-400">{{ formatDate(value) }}</span>
          </template>
          <template #cell-title="{ value }">
            <span class="font-semibold">{{ value }}</span>
          </template>
          <template #cell-category="{ value }">
            <span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" :style="categoryChipStyle(categories.colorOf(value))">
              {{ value }}
            </span>
          </template>
          <template #cell-amount="{ value }">{{ formatMoney(value) }}</template>
          <template #cell-wallet="{ row }">{{ row.wallet?.name ?? '—' }}</template>
          <template #cell-notes="{ value }">
            <span :title="value">{{ value || '—' }}</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end gap-0.5">
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="View expense" title="View" @click="viewing = row">
                <Icon name="eye" :size="15" />
              </button>
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Edit expense" title="Edit" @click="openEdit(row)">
                <Icon name="edit" :size="15" />
              </button>
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Duplicate expense" title="Duplicate" @click="duplicate(row)">
                <Icon name="copy" :size="15" />
              </button>
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Delete expense" title="Delete" @click="confirmDelete(row)">
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
        icon="wallet"
        :title="store.hasActiveFilters || store.filters.search ? 'No matching expenses' : 'No expenses yet'"
        :message="store.hasActiveFilters || store.filters.search ? 'Try different search terms or clear the filters.' : 'Add your first expense to start tracking your spending.'"
      >
        <template #action>
          <BaseButton v-if="store.hasActiveFilters || store.filters.search" variant="secondary" @click="store.resetFilters()">
            Clear filters
          </BaseButton>
          <BaseButton v-else @click="openCreate">
            <Icon name="plus" :size="16" />
            Add expense
          </BaseButton>
        </template>
      </EmptyState>
    </BaseCard>

    <!-- Floating add button -->
    <button
      class="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition-transform hover:scale-105 hover:bg-brand-700"
      aria-label="Add expense (n)"
      title="Add expense (n)"
      @click="openCreate"
    >
      <Icon name="plus" :size="22" />
    </button>

    <ExpenseFormModal :open="formOpen" :expense="editing" :submit="submitForm" @close="formOpen = false" />

    <!-- View modal -->
    <BaseModal :open="!!viewing" title="Expense details" @close="viewing = null">
      <dl v-if="viewing" class="space-y-3 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="font-semibold text-slate-500">Title</dt>
          <dd class="font-semibold">{{ viewing.title }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="font-semibold text-slate-500">Amount</dt>
          <dd class="amount font-semibold">{{ formatMoney(viewing.amount) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="font-semibold text-slate-500">Date</dt>
          <dd>{{ formatDate(viewing.date) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="font-semibold text-slate-500">Category</dt>
          <dd><span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :style="categoryChipStyle(categories.colorOf(viewing.category))">{{ viewing.category }}</span></dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="font-semibold text-slate-500">Wallet</dt>
          <dd>{{ viewing.wallet?.name ?? '—' }}</dd>
        </div>
        <div v-if="viewing.notes" class="flex justify-between gap-4">
          <dt class="font-semibold text-slate-500">Notes</dt>
          <dd class="text-right">{{ viewing.notes }}</dd>
        </div>
      </dl>
    </BaseModal>
  </div>
</template>
