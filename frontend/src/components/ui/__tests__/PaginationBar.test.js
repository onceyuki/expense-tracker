import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PaginationBar from '../PaginationBar.vue';

describe('PaginationBar', () => {
  it('shows the current range', () => {
    const wrapper = mount(PaginationBar, {
      props: { page: 2, totalPages: 5, total: 48, pageSize: 10 },
    });
    expect(wrapper.text()).toContain('11–20');
    expect(wrapper.text()).toContain('48');
  });

  it('emits page changes within bounds', async () => {
    const wrapper = mount(PaginationBar, {
      props: { page: 2, totalPages: 5, total: 48, pageSize: 10 },
    });
    await wrapper.find('[data-test="next"]').trigger('click');
    expect(wrapper.emitted('update:page')[0]).toEqual([3]);
    await wrapper.find('[data-test="prev"]').trigger('click');
    expect(wrapper.emitted('update:page')[1]).toEqual([1]);
  });

  it('disables prev on first page and next on last page', () => {
    const first = mount(PaginationBar, { props: { page: 1, totalPages: 3, total: 30, pageSize: 10 } });
    expect(first.find('[data-test="prev"]').attributes('disabled')).toBeDefined();
    const last = mount(PaginationBar, { props: { page: 3, totalPages: 3, total: 30, pageSize: 10 } });
    expect(last.find('[data-test="next"]').attributes('disabled')).toBeDefined();
  });
});
