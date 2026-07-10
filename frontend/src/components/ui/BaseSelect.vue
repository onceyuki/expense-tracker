<script setup>
defineProps({
  modelValue: { type: [String, Number, null], default: '' },
  label: { type: String, default: '' },
  options: { type: Array, required: true }, // [{ value, label }] or plain strings
  placeholder: { type: String, default: '' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

function normalize(option) {
  return typeof option === 'object' ? option : { value: option, label: option };
}
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
      {{ label }}<span v-if="required" class="text-rose-500"> *</span>
    </span>
    <select
      :value="modelValue"
      class="w-full appearance-none rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-950 dark:text-slate-100"
      :class="error ? 'border-rose-400 dark:border-rose-500' : 'border-slate-300 dark:border-slate-700'"
      @change="emit('update:modelValue', $event.target.value)"
    >
      <option v-if="placeholder" value="">{{ placeholder }}</option>
      <option v-for="opt in options.map(normalize)" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
    <span v-if="error" class="mt-1.5 block text-xs font-medium text-rose-600 dark:text-rose-400">
      {{ error }}
    </span>
  </label>
</template>
