<script setup>
import { reactive, computed, ref, watch } from 'vue';
import { useWalletsStore } from '../stores/wallets.js';
import { useUiStore } from '../stores/ui.js';
import { apiErrorMessage } from '../services/api.js';
import { toDateInput } from '../utils/format.js';
import BaseModal from './ui/BaseModal.vue';
import BaseInput from './ui/BaseInput.vue';
import BaseSelect from './ui/BaseSelect.vue';
import BaseButton from './ui/BaseButton.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  // transfer = edit mode; null = create mode
  transfer: { type: Object, default: null },
});

const emit = defineEmits(['close']);

const wallets = useWalletsStore();
const ui = useUiStore();

const form = reactive({ fromWalletId: '', toWalletId: '', amount: '', date: toDateInput(), notes: '' });
const touched = reactive({});
const saving = ref(false);
const isEdit = computed(() => !!props.transfer);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    Object.keys(touched).forEach((k) => delete touched[k]);
    if (props.transfer) {
      Object.assign(form, {
        fromWalletId: props.transfer.fromWalletId,
        toWalletId: props.transfer.toWalletId,
        amount: props.transfer.amount,
        date: toDateInput(props.transfer.date),
        notes: props.transfer.notes ?? '',
      });
    } else {
      Object.assign(form, { fromWalletId: '', toWalletId: '', amount: '', date: toDateInput(), notes: '' });
    }
  },
);

const errors = computed(() => ({
  fromWalletId: touched.fromWalletId && !form.fromWalletId ? 'Pick a source wallet' : '',
  toWalletId:
    touched.toWalletId && !form.toWalletId
      ? 'Pick a destination wallet'
      : touched.toWalletId && form.toWalletId && form.toWalletId === form.fromWalletId
        ? 'Pick a different wallet'
        : '',
  amount: touched.amount && (!form.amount || Number(form.amount) <= 0) ? 'Enter an amount above zero' : '',
  date: touched.date && !form.date ? 'Pick a date' : '',
}));

async function save() {
  ['fromWalletId', 'toWalletId', 'amount', 'date'].forEach((k) => (touched[k] = true));
  if (Object.values(errors.value).some(Boolean)) return;

  saving.value = true;
  const payload = {
    fromWalletId: form.fromWalletId,
    toWalletId: form.toWalletId,
    amount: Number(form.amount),
    date: form.date,
    notes: form.notes.trim() || null,
  };
  try {
    if (isEdit.value) {
      await wallets.updateTransfer(props.transfer.id, payload);
      ui.toast('Transfer updated');
    } else {
      await wallets.createTransfer(payload);
      ui.toast('Transfer recorded');
    }
    emit('close');
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not save transfer'), 'error');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" :title="isEdit ? 'Edit transfer' : 'New transfer'" @close="emit('close')">
    <form class="space-y-4" novalidate @submit.prevent="save">
      <div class="grid grid-cols-2 gap-4">
        <BaseSelect v-model="form.fromWalletId" label="From" :options="wallets.options" placeholder="Source" :error="errors.fromWalletId" required @blur="touched.fromWalletId = true" />
        <BaseSelect v-model="form.toWalletId" label="To" :options="wallets.options" placeholder="Destination" :error="errors.toWalletId" required @blur="touched.toWalletId = true" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <BaseInput v-model="form.amount" label="Amount" type="number" step="0.01" min="0" placeholder="0.00" :error="errors.amount" required @blur="touched.amount = true" />
        <BaseInput v-model="form.date" label="Date" type="date" :error="errors.date" required @blur="touched.date = true" />
      </div>
      <BaseInput v-model="form.notes" label="Notes" placeholder="Optional details" />
      <button type="submit" class="hidden" aria-hidden="true" />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancel</BaseButton>
      <BaseButton :loading="saving" @click="save">{{ isEdit ? 'Save changes' : 'Record transfer' }}</BaseButton>
    </template>
  </BaseModal>
</template>
