<script setup>
import { onMounted, ref, reactive, watch } from 'vue';
import { useCategoriesStore } from '../stores/categories.js';
import { useUiStore } from '../stores/ui.js';
import { apiErrorMessage } from '../services/api.js';
import { categoryChipStyle } from '../utils/format.js';
import BaseCard from '../components/ui/BaseCard.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseModal from '../components/ui/BaseModal.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import Icon from '../components/ui/Icon.vue';

const SWATCHES = [
  '#eda100', '#2a78d6', '#1baf7a', '#e87ba4', '#4a3aa7', '#eb6834',
  '#e34948', '#008300', '#0891b2', '#4d7c0f', '#9333ea', '#64748b',
];

const store = useCategoriesStore();
const ui = useUiStore();

const formOpen = ref(false);
const editing = ref(null);
const saving = ref(false);
const touched = reactive({});
const form = reactive({ name: '', color: '' });

const errors = () => ({
  name: touched.name && !form.name.trim() ? 'Give this category a name' : '',
});

watch(formOpen, (open) => {
  if (!open) return;
  touched.name = false;
  if (editing.value) {
    form.name = editing.value.name;
    form.color = editing.value.color;
  } else {
    form.name = '';
    form.color = SWATCHES[store.categories.length % SWATCHES.length];
  }
});

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(category) {
  editing.value = category;
  formOpen.value = true;
}

async function save() {
  touched.name = true;
  if (!form.name.trim()) return;

  saving.value = true;
  try {
    if (editing.value) {
      await store.update(editing.value.id, { name: form.name.trim(), color: form.color });
      ui.toast('Category updated');
    } else {
      await store.create({ name: form.name.trim(), color: form.color });
      ui.toast('Category added');
    }
    formOpen.value = false;
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not save category'), 'error');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(category) {
  const confirmed = await ui.confirm({
    title: 'Delete this category?',
    message: `"${category.name}" will be removed. This is blocked if it's still used by any expenses or budgets.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.remove(category.id);
    ui.toast('Category deleted');
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not delete category'), 'error');
  }
}

onMounted(() => store.fetch());
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Categories you create here show up in the expense and budget forms.
      </p>
      <BaseButton @click="openCreate">
        <Icon name="plus" :size="16" />
        Add category
      </BaseButton>
    </div>

    <SkeletonLoader v-if="store.loading && !store.categories.length" variant="table" :count="4" />

    <BaseCard v-else-if="store.categories.length" :padded="false">
      <ul class="divide-y divide-slate-100 dark:divide-slate-800">
        <li v-for="category in store.categories" :key="category.id" class="flex items-center gap-3 px-5 py-3.5">
          <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: category.color }" />
          <span class="flex-1 truncate text-sm font-semibold">{{ category.name }}</span>
          <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :style="categoryChipStyle(category.color)">
            {{ category.name }}
          </span>
          <div class="flex gap-0.5">
            <button
              class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Edit category"
              title="Edit"
              @click="openEdit(category)"
            >
              <Icon name="edit" :size="15" />
            </button>
            <button
              class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              aria-label="Delete category"
              title="Delete"
              @click="confirmDelete(category)"
            >
              <Icon name="trash" :size="15" />
            </button>
          </div>
        </li>
      </ul>
    </BaseCard>

    <BaseCard v-else>
      <EmptyState icon="tag" title="No categories yet" message="Add your first category to start tracking expenses and budgets.">
        <template #action>
          <BaseButton @click="openCreate">
            <Icon name="plus" :size="16" />
            Add category
          </BaseButton>
        </template>
      </EmptyState>
    </BaseCard>

    <BaseModal :open="formOpen" :title="editing ? 'Edit category' : 'Add category'" @close="formOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseInput
          v-model="form.name"
          label="Name"
          placeholder="e.g. Groceries"
          :error="errors().name"
          required
          @blur="touched.name = true"
        />
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
        <BaseButton :loading="saving" @click="save">{{ editing ? 'Save changes' : 'Add category' }}</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
