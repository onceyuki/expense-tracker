<script setup>
import Icon from './Icon.vue';

// columns: [{ key, label, sortable?, align?: 'left'|'right', class? }]
const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  rowKey: { type: String, default: 'id' },
  sortBy: { type: String, default: '' },
  sortDir: { type: String, default: 'desc' },
});

const emit = defineEmits(['sort']);

function onSort(column) {
  if (!column.sortable) return;
  const dir = props.sortBy === column.key && props.sortDir === 'desc' ? 'asc' : 'desc';
  emit('sort', { sortBy: column.key, sortDir: dir });
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[640px] text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-800">
          <th
            v-for="col in columns"
            :key="col.key"
            class="sticky top-0 whitespace-nowrap bg-white px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-900 dark:text-slate-400"
            :class="[col.align === 'right' ? 'text-right' : 'text-left', col.sortable && 'cursor-pointer select-none hover:text-slate-900 dark:hover:text-slate-200']"
            @click="onSort(col)"
          >
            <span class="inline-flex items-center gap-1">
              {{ col.label }}
              <Icon
                v-if="col.sortable && sortBy === col.key"
                :name="sortDir === 'asc' ? 'chevron-right' : 'chevron-left'"
                :size="12"
                class="rotate-90"
              />
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row[rowKey]"
          class="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            class="px-4 py-3"
            :class="[col.align === 'right' ? 'text-right' : 'text-left', col.class]"
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
