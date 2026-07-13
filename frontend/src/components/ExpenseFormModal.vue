<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue';
import { useUiStore } from '../stores/ui.js';
import { useCategoriesStore } from '../stores/categories.js';
import { useWalletsStore } from '../stores/wallets.js';
import { apiErrorMessage } from '../services/api.js';
import { toDateInput } from '../utils/format.js';
import BaseModal from './ui/BaseModal.vue';
import BaseInput from './ui/BaseInput.vue';
import BaseSelect from './ui/BaseSelect.vue';
import BaseButton from './ui/BaseButton.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  // expense = edit mode; null = create mode
  expense: { type: Object, default: null },
  // called with the payload; parent performs the API call
  submit: { type: Function, required: true },
});

const emit = defineEmits(['close', 'saved']);

const ui = useUiStore();
const categories = useCategoriesStore();
const wallets = useWalletsStore();
const DRAFT_KEY = 'et_expense_draft';

onMounted(() => {
  categories.ensureLoaded();
  wallets.ensureLoaded();
});

const blank = () => ({
  title: '',
  amount: '',
  date: toDateInput(),
  category: '',
  walletId: '',
  notes: '',
});

const form = reactive(blank());
const touched = reactive({});
const saving = ref(false);
const isEdit = computed(() => !!props.expense);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    Object.keys(touched).forEach((k) => delete touched[k]);
    if (props.expense) {
      Object.assign(form, {
        title: props.expense.title,
        amount: props.expense.amount,
        date: toDateInput(props.expense.date),
        category: props.expense.category,
        walletId: props.expense.walletId ?? '',
        notes: props.expense.notes ?? '',
      });
    } else {
      // Restore an unsent draft if one exists
      const draft = localStorage.getItem(DRAFT_KEY);
      Object.assign(form, blank(), draft ? JSON.parse(draft) : {});
    }
  },
);

// Auto-save drafts while creating (not editing)
watch(
  form,
  () => {
    if (props.open && !isEdit.value) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    }
  },
  { deep: true },
);

const errors = computed(() => ({
  title: touched.title && !form.title.trim() ? 'Give this expense a name' : '',
  amount: touched.amount && (!form.amount || Number(form.amount) <= 0) ? 'Enter an amount above zero' : '',
  date: touched.date && !form.date ? 'Pick a date' : '',
  category: touched.category && !form.category ? 'Pick a category' : '',
}));

async function save() {
  ['title', 'amount', 'date', 'category'].forEach((k) => (touched[k] = true));
  if (Object.values(errors.value).some(Boolean)) return;

  saving.value = true;
  try {
    await props.submit({
      title: form.title.trim(),
      amount: Number(form.amount),
      date: form.date,
      category: form.category,
      walletId: form.walletId || null,
      notes: form.notes.trim() || null,
    });
    if (!isEdit.value) localStorage.removeItem(DRAFT_KEY);
    ui.toast(isEdit.value ? 'Expense updated' : 'Expense added');
    emit('saved');
    emit('close');
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not save expense'), 'error');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" :title="isEdit ? 'Edit expense' : 'Add expense'" size="lg" @close="emit('close')">
    <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" novalidate @submit.prevent="save">
      <div class="sm:col-span-2">
        <BaseInput
          v-model="form.title"
          label="Expense name"
          placeholder="Groceries, rent, coffee…"
          :error="errors.title"
          required
          @blur="touched.title = true"
        />
      </div>
      <BaseInput
        v-model="form.amount"
        label="Amount"
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        :error="errors.amount"
        required
        @blur="touched.amount = true"
      />
      <BaseInput
        v-model="form.date"
        label="Date"
        type="date"
        :error="errors.date"
        required
        @blur="touched.date = true"
      />
      <div>
        <BaseSelect
          v-model="form.category"
          label="Category"
          :options="categories.names"
          placeholder="Select a category"
          :error="errors.category"
          required
          @blur="touched.category = true"
        />
        <RouterLink
          v-if="categories.loaded && !categories.names.length"
          to="/categories"
          class="mt-1.5 inline-block text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          Add a category first →
        </RouterLink>
      </div>
      <BaseSelect
        v-model="form.walletId"
        label="Wallet"
        :options="wallets.options"
        placeholder="No wallet"
      />
      <div class="sm:col-span-2">
        <label class="block">
          <span class="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Notes</span>
          <textarea
            v-model="form.notes"
            rows="2"
            placeholder="Optional details"
            class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
      </div>
      <button type="submit" class="hidden" aria-hidden="true" />
    </form>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancel</BaseButton>
      <BaseButton :loading="saving" @click="save">
        {{ isEdit ? 'Save changes' : 'Add expense' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
