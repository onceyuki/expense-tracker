<script setup>
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
  step: { type: String, default: undefined },
  min: { type: String, default: undefined },
  autocomplete: { type: String, default: undefined },
});

const emit = defineEmits(['update:modelValue', 'blur']);

function onInput(event) {
  const value = event.target.value;
  emit('update:modelValue', props.type === 'number' && value !== '' ? Number(value) : value);
}
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
      {{ label }}<span v-if="required" class="text-rose-500"> *</span>
    </span>
    <input
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :step="step"
      :min="min"
      :autocomplete="autocomplete"
      class="w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-950 dark:text-slate-100"
      :class="error ? 'border-rose-400 dark:border-rose-500' : 'border-slate-300 dark:border-slate-700'"
      @input="onInput"
      @blur="emit('blur')"
    />
    <span v-if="error" class="mt-1.5 block text-xs font-medium text-rose-600 dark:text-rose-400">
      {{ error }}
    </span>
  </label>
</template>
