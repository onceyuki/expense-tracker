<script setup>
import { watch } from 'vue';
import Icon from './Icon.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' }, // md | lg
});

const emit = defineEmits(['close']);

function onKeydown(event) {
  if (event.key === 'Escape') emit('close');
}

watch(
  () => props.open,
  (open) => {
    if (open) document.addEventListener('keydown', onKeydown);
    else document.removeEventListener('keydown', onKeydown);
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center"
        @click.self="emit('close')"
      >
        <div
          class="modal-panel w-full rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
          :class="size === 'lg' ? 'max-w-2xl' : 'max-w-md'"
          role="dialog"
          aria-modal="true"
        >
          <header class="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 class="text-base font-bold tracking-tight">{{ title }}</h2>
            <button
              class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close dialog"
              @click="emit('close')"
            >
              <Icon name="x" :size="18" />
            </button>
          </header>
          <div class="p-5">
            <slot />
          </div>
          <footer
            v-if="$slots.footer"
            class="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
