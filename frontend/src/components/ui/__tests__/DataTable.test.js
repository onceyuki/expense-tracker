import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DataTable from '../DataTable.vue';

const columns = [
  { key: 'title', label: 'Title', sortable: true },
  { key: 'amount', label: 'Amount', align: 'right' },
];
const rows = [
  { id: '1', title: 'Coffee', amount: 4.5 },
  { id: '2', title: 'Rent', amount: 1400 },
];

describe('DataTable', () => {
  it('renders one row per item and headers', () => {
    const wrapper = mount(DataTable, { props: { columns, rows } });
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(wrapper.text()).toContain('Coffee');
    expect(wrapper.text()).toContain('Title');
  });

  it('emits sort with toggled direction on sortable header click', async () => {
    const wrapper = mount(DataTable, {
      props: { columns, rows, sortBy: 'title', sortDir: 'desc' },
    });
    await wrapper.findAll('th')[0].trigger('click');
    expect(wrapper.emitted('sort')[0][0]).toEqual({ sortBy: 'title', sortDir: 'asc' });
  });

  it('does not emit sort for non-sortable columns', async () => {
    const wrapper = mount(DataTable, { props: { columns, rows } });
    await wrapper.findAll('th')[1].trigger('click');
    expect(wrapper.emitted('sort')).toBeUndefined();
  });

  it('renders custom cell slots', () => {
    const wrapper = mount(DataTable, {
      props: { columns, rows },
      slots: { 'cell-amount': '<template #cell-amount="{ value }">${{ value }}</template>' },
    });
    expect(wrapper.text()).toContain('$4.5');
  });
});
