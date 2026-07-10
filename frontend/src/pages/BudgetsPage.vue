<script setup>
import { onMounted, ref, reactive, computed, watch } from 'vue';
import { useBudgetsStore } from '../stores/budgets.js';
import { useUiStore } from '../stores/ui.js';
import { useCategoriesStore } from '../stores/categories.js';
import { apiErrorMessage } from '../services/api.js';
import { formatMoney, formatMonth, categoryChipStyle } from '../utils/format.js';
import BaseCard from '../components/ui/BaseCard.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseSelect from '../components/ui/BaseSelect.vue';
import BaseModal from '../components/ui/BaseModal.vue';
import ProgressBar from '../components/ui/ProgressBar.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import Icon from '../components/ui/Icon.vue';

const store = useBudgetsStore();
const ui = useUiStore();
const categories = useCategoriesStore();

const formOpen = ref(false);
const editing = ref(null);
const saving = ref(false);

const form = reactive({ category: '', limit: '' });
const touched = reactive({});

// Categories that don't have a budget yet this month (for the create form)
const availableCategories = computed(() => {
  const used = new Set(store.byCategory.map((b) => b.category));
  return categories.names.filter((c) => !used.has(c));
});

const errors = computed(() => ({
  limit: touched.limit && (!form.limit || Number(form.limit) <= 0) ? 'Enter a limit above zero' : '',
}));

watch(formOpen, (open) => {
  if (!open) return;
  Object.keys(touched).forEach((k) => delete touched[k]);
  if (editing.value) {
    form.category = editing.value.category ?? '';
    form.limit = editing.value.limit;
  } else {
    form.category = '';
    form.limit = '';
  }
});

function openCreate(category = '') {
  editing.value = null;
  formOpen.value = true;
  form.category = category;
}

function openEdit(budget) {
  editing.value = budget;
  formOpen.value = true;
}

async function save() {
  touched.limit = true;
  if (errors.value.limit) return;

  saving.value = true;
  try {
    if (editing.value) {
      await store.update(editing.value.id, { limit: Number(form.limit) });
      ui.toast('Budget updated');
    } else {
      await store.create({ category: form.category || null, limit: Number(form.limit) });
      ui.toast(form.category ? `${form.category} budget set` : 'Monthly budget set');
    }
    formOpen.value = false;
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not save budget'), 'error');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(budget) {
  const scope = budget.category ? `the ${budget.category} budget` : 'the overall monthly budget';
  const confirmed = await ui.confirm({
    title: 'Delete this budget?',
    message: `This removes ${scope} for ${formatMonth(store.month)}.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.remove(budget.id);
    ui.toast('Budget deleted');
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  }
}

function shiftMonth(delta) {
  const [y, m] = store.month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  store.setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
}

onMounted(() => {
  store.fetch();
  categories.ensureLoaded();
});
</script>

<template>
  <div class="space-y-4">
    <!-- Month picker -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        <button class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Previous month" @click="shiftMonth(-1)">
          <Icon name="chevron-left" :size="16" />
        </button>
        <span class="min-w-[140px] text-center text-sm font-bold">{{ formatMonth(store.month) }}</span>
        <button class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Next month" @click="shiftMonth(1)">
          <Icon name="chevron-right" :size="16" />
        </button>
      </div>
      <BaseButton class="ml-auto" @click="openCreate()">
        <Icon name="plus" :size="16" />
        Set budget
      </BaseButton>
    </div>

    <SkeletonLoader v-if="store.loading && !store.budgets.length" variant="table" :count="4" />

    <template v-else>
      <!-- Overall budget -->
      <BaseCard v-if="store.overall" title="Overall monthly budget">
        <template #actions>
          <div class="flex gap-1">
            <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Edit budget" @click="openEdit(store.overall)">
              <Icon name="edit" :size="15" />
            </button>
            <button class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Delete budget" @click="confirmDelete(store.overall)">
              <Icon name="trash" :size="15" />
            </button>
          </div>
        </template>
        <div class="flex items-end justify-between gap-4">
          <p class="amount text-3xl font-semibold">
            {{ formatMoney(store.overall.spent) }}
            <span class="text-base text-slate-400">/ {{ formatMoney(store.overall.limit) }}</span>
          </p>
          <p class="text-sm font-semibold" :class="store.overall.percentUsed >= 100 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'">
            {{ store.overall.percentUsed }}% used
          </p>
        </div>
        <div class="mt-3">
          <ProgressBar :percent="store.overall.percentUsed" />
        </div>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {{ store.overall.remaining >= 0 ? `${formatMoney(store.overall.remaining)} remaining` : `${formatMoney(-store.overall.remaining)} over budget` }}
        </p>
      </BaseCard>

      <BaseCard v-else>
        <EmptyState
          icon="target"
          title="No overall budget for this month"
          message="Set a monthly spending limit to track how much of it you've used."
        >
          <template #action>
            <BaseButton @click="openCreate()">Set monthly budget</BaseButton>
          </template>
        </EmptyState>
      </BaseCard>

      <!-- Category budgets -->
      <div v-if="store.byCategory.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <BaseCard v-for="budget in store.byCategory" :key="budget.id">
          <div class="flex items-center justify-between">
            <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :style="categoryChipStyle(categories.colorOf(budget.category))">
              {{ budget.category }}
            </span>
            <div class="flex gap-1">
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Edit budget" @click="openEdit(budget)">
                <Icon name="edit" :size="14" />
              </button>
              <button class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Delete budget" @click="confirmDelete(budget)">
                <Icon name="trash" :size="14" />
              </button>
            </div>
          </div>
          <p class="amount mt-3 text-xl font-semibold">
            {{ formatMoney(budget.spent) }}
            <span class="text-sm text-slate-400">/ {{ formatMoney(budget.limit) }}</span>
          </p>
          <div class="mt-2.5">
            <ProgressBar :percent="budget.percentUsed" />
          </div>
          <p class="mt-2 text-xs font-medium" :class="budget.percentUsed >= 100 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'">
            {{ budget.percentUsed }}% used ·
            {{ budget.remaining >= 0 ? `${formatMoney(budget.remaining)} left` : `${formatMoney(-budget.remaining)} over` }}
          </p>
        </BaseCard>
      </div>

      <BaseCard v-else-if="store.overall">
        <EmptyState
          icon="target"
          title="No category budgets"
          message="Add per-category limits to catch overspending early."
        >
          <template #action>
            <BaseButton variant="secondary" @click="openCreate(availableCategories[0])">Add category budget</BaseButton>
          </template>
        </EmptyState>
      </BaseCard>
    </template>

    <!-- Create/edit modal -->
    <BaseModal :open="formOpen" :title="editing ? 'Edit budget' : 'Set budget'" @close="formOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseSelect
          v-if="!editing"
          v-model="form.category"
          label="Scope"
          :options="[{ value: '', label: `Overall — ${formatMonth(store.month)}` }, ...availableCategories]"
        />
        <p v-else class="text-sm font-semibold text-slate-500">
          {{ editing.category ? `${editing.category} — ${formatMonth(store.month)}` : `Overall — ${formatMonth(store.month)}` }}
        </p>
        <BaseInput v-model="form.limit" label="Limit" type="number" step="0.01" min="0" placeholder="0.00" :error="errors.limit" required @blur="touched.limit = true" />
        <button type="submit" class="hidden" aria-hidden="true" />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="formOpen = false">Cancel</BaseButton>
        <BaseButton :loading="saving" @click="save">{{ editing ? 'Save changes' : 'Set budget' }}</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
