<script setup>
import { onMounted, ref, reactive, computed, watch } from 'vue';
import { useSavingsStore } from '../stores/savings.js';
import { useUiStore } from '../stores/ui.js';
import { apiErrorMessage } from '../services/api.js';
import { formatMoney, formatDate, toDateInput } from '../utils/format.js';
import BaseCard from '../components/ui/BaseCard.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseModal from '../components/ui/BaseModal.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import Icon from '../components/ui/Icon.vue';

const store = useSavingsStore();
const ui = useUiStore();

const goalFormOpen = ref(false);
const editingGoal = ref(null);
const savingGoal = ref(false);
const goalTouched = reactive({});
const goalForm = reactive({ name: '', target: '' });

const contribFormOpen = ref(false);
const contribGoal = ref(null);
const savingContrib = ref(false);
const contribTouched = reactive({});
const contribForm = reactive({ amount: '', date: toDateInput(), notes: '' });

const expanded = ref(null);

const goalErrors = computed(() => ({
  name: goalTouched.name && !goalForm.name.trim() ? 'Give this goal a name' : '',
}));

const contribErrors = computed(() => ({
  amount: contribTouched.amount && (!contribForm.amount || Number(contribForm.amount) <= 0) ? 'Enter an amount above zero' : '',
  date: contribTouched.date && !contribForm.date ? 'Pick a date' : '',
}));

watch(goalFormOpen, (open) => {
  if (!open) return;
  goalTouched.name = false;
  if (editingGoal.value) {
    goalForm.name = editingGoal.value.name;
    goalForm.target = editingGoal.value.target ?? '';
  } else {
    goalForm.name = '';
    goalForm.target = '';
  }
});

watch(contribFormOpen, (open) => {
  if (!open) return;
  Object.keys(contribTouched).forEach((k) => delete contribTouched[k]);
  Object.assign(contribForm, { amount: '', date: toDateInput(), notes: '' });
});

function progressOf(goal) {
  if (!goal.target) return null;
  return Math.min(100, Math.round((goal.total / goal.target) * 100));
}

function openCreateGoal() {
  editingGoal.value = null;
  goalFormOpen.value = true;
}

function openEditGoal(goal) {
  editingGoal.value = goal;
  goalFormOpen.value = true;
}

function openContribute(goal) {
  contribGoal.value = goal;
  contribFormOpen.value = true;
}

async function saveGoal() {
  goalTouched.name = true;
  if (goalErrors.value.name) return;

  savingGoal.value = true;
  const payload = {
    name: goalForm.name.trim(),
    target: goalForm.target ? Number(goalForm.target) : null,
  };
  try {
    if (editingGoal.value) {
      await store.update(editingGoal.value.id, payload);
      ui.toast('Goal updated');
    } else {
      await store.create(payload);
      ui.toast('Goal added');
    }
    goalFormOpen.value = false;
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not save goal'), 'error');
  } finally {
    savingGoal.value = false;
  }
}

async function saveContribution() {
  ['amount', 'date'].forEach((k) => (contribTouched[k] = true));
  if (Object.values(contribErrors.value).some(Boolean)) return;

  savingContrib.value = true;
  try {
    await store.addContribution(contribGoal.value.id, {
      amount: Number(contribForm.amount),
      date: contribForm.date,
      notes: contribForm.notes.trim() || null,
    });
    ui.toast('Contribution added');
    contribFormOpen.value = false;
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not add contribution'), 'error');
  } finally {
    savingContrib.value = false;
  }
}

async function confirmDeleteGoal(goal) {
  const confirmed = await ui.confirm({
    title: 'Delete this goal?',
    message: `"${goal.name}" and all its contributions will be removed permanently.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.remove(goal.id);
    ui.toast('Goal deleted');
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  }
}

async function confirmDeleteContribution(goal, contribution) {
  const confirmed = await ui.confirm({
    title: 'Remove this contribution?',
    message: `${formatMoney(contribution.amount)} on ${formatDate(contribution.date)} will be removed.`,
    confirmLabel: 'Remove',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await store.removeContribution(goal.id, contribution.id);
    ui.toast('Contribution removed');
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  }
}

onMounted(() => store.fetch());
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Set money aside for named goals and watch them grow month by month.
      </p>
      <BaseButton @click="openCreateGoal">
        <Icon name="plus" :size="16" />
        Add goal
      </BaseButton>
    </div>

    <SkeletonLoader v-if="store.loading && !store.goals.length" variant="card" :count="2" />

    <div v-else-if="store.goals.length" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BaseCard v-for="goal in store.goals" :key="goal.id">
        <div class="flex items-start justify-between gap-2">
          <span class="text-sm font-bold">{{ goal.name }}</span>
          <div class="flex gap-0.5">
            <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Edit goal" title="Edit" @click="openEditGoal(goal)">
              <Icon name="edit" :size="15" />
            </button>
            <button class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Delete goal" title="Delete" @click="confirmDeleteGoal(goal)">
              <Icon name="trash" :size="15" />
            </button>
          </div>
        </div>

        <p class="amount mt-2 text-2xl font-extrabold tracking-tight">{{ formatMoney(goal.total) }}</p>
        <p v-if="goal.target" class="text-xs text-slate-500 dark:text-slate-400">of {{ formatMoney(goal.target) }} target</p>

        <div v-if="goal.target" class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div class="h-full rounded-full bg-brand-500 transition-all" :style="{ width: `${progressOf(goal)}%` }" />
        </div>

        <dl class="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <dt class="font-semibold uppercase tracking-wider">This month</dt>
            <dd class="amount mt-0.5">{{ formatMoney(goal.thisMonth) }}</dd>
          </div>
          <div>
            <dt class="font-semibold uppercase tracking-wider">Last month</dt>
            <dd class="amount mt-0.5">{{ formatMoney(goal.lastMonth) }}</dd>
          </div>
        </dl>

        <div class="mt-4 flex items-center gap-3">
          <BaseButton @click="openContribute(goal)">
            <Icon name="plus" :size="14" />
            Contribute
          </BaseButton>
          <button
            class="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            @click="expanded = expanded === goal.id ? null : goal.id"
          >
            {{ expanded === goal.id ? 'Hide' : 'Show' }} contributions ({{ goal.contributions.length }})
          </button>
        </div>

        <ul v-if="expanded === goal.id && goal.contributions.length" class="mt-3 divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
          <li v-for="c in goal.contributions" :key="c.id" class="flex items-center gap-3 py-2 text-sm">
            <span class="flex-1 text-slate-500 dark:text-slate-400">{{ formatDate(c.date) }}</span>
            <span class="amount font-semibold">{{ formatMoney(c.amount) }}</span>
            <button class="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Remove contribution" title="Remove" @click="confirmDeleteContribution(goal, c)">
              <Icon name="trash" :size="14" />
            </button>
          </li>
        </ul>
      </BaseCard>
    </div>

    <BaseCard v-else>
      <EmptyState icon="coins" title="No savings goals yet" message="Create a goal like 'Emergency fund' or 'Japan 2027' and add contributions as you save.">
        <template #action>
          <BaseButton @click="openCreateGoal">
            <Icon name="plus" :size="16" />
            Add goal
          </BaseButton>
        </template>
      </EmptyState>
    </BaseCard>

    <BaseModal :open="goalFormOpen" :title="editingGoal ? 'Edit goal' : 'Add goal'" @close="goalFormOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="saveGoal">
        <BaseInput v-model="goalForm.name" label="Name" placeholder="e.g. Japan 2027" :error="goalErrors.name" required @blur="goalTouched.name = true" />
        <BaseInput v-model="goalForm.target" label="Target amount (optional)" type="number" step="0.01" min="0" placeholder="No target" />
        <button type="submit" class="hidden" aria-hidden="true" />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="goalFormOpen = false">Cancel</BaseButton>
        <BaseButton :loading="savingGoal" @click="saveGoal">{{ editingGoal ? 'Save changes' : 'Add goal' }}</BaseButton>
      </template>
    </BaseModal>

    <BaseModal :open="contribFormOpen" :title="`Contribute to ${contribGoal?.name ?? ''}`" @close="contribFormOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="saveContribution">
        <div class="grid grid-cols-2 gap-4">
          <BaseInput v-model="contribForm.amount" label="Amount" type="number" step="0.01" min="0" placeholder="0.00" :error="contribErrors.amount" required @blur="contribTouched.amount = true" />
          <BaseInput v-model="contribForm.date" label="Date" type="date" :error="contribErrors.date" required @blur="contribTouched.date = true" />
        </div>
        <BaseInput v-model="contribForm.notes" label="Notes" placeholder="Optional details" />
        <button type="submit" class="hidden" aria-hidden="true" />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="contribFormOpen = false">Cancel</BaseButton>
        <BaseButton :loading="savingContrib" @click="saveContribution">Add contribution</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
