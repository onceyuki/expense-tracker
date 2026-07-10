<script setup>
import { useUiStore } from '../../stores/ui.js';
import BaseButton from './BaseButton.vue';
import Icon from './Icon.vue';

const ui = useUiStore();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="ui.confirmState"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        @click.self="ui.resolveConfirm(false)"
      >
        <div
          class="modal-panel w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          role="alertdialog"
          aria-modal="true"
        >
          <div class="flex items-start gap-4">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              :class="ui.confirmState.danger ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400' : 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'"
            >
              <Icon name="alert" :size="20" />
            </span>
            <div>
              <h2 class="font-bold tracking-tight">{{ ui.confirmState.title }}</h2>
              <p v-if="ui.confirmState.message" class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {{ ui.confirmState.message }}
              </p>
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-2">
            <BaseButton variant="secondary" data-test="cancel" @click="ui.resolveConfirm(false)">
              Cancel
            </BaseButton>
            <BaseButton
              :variant="ui.confirmState.danger ? 'danger' : 'primary'"
              data-test="confirm"
              @click="ui.resolveConfirm(true)"
            >
              {{ ui.confirmState.confirmLabel }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
