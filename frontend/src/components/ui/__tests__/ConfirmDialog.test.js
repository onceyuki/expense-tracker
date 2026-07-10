import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ConfirmDialog from '../ConfirmDialog.vue';
import { useUiStore } from '../../../stores/ui.js';

describe('ConfirmDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = '';
  });

  it('renders nothing until confirm() is called, then resolves true on confirm', async () => {
    const ui = useUiStore();
    mount(ConfirmDialog, { attachTo: document.body });
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();

    const promise = ui.confirm({ title: 'Delete expense?', danger: true, confirmLabel: 'Delete' });
    await Promise.resolve();
    await new Promise((r) => setTimeout(r));

    const dialog = document.body.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('Delete expense?');

    document.body.querySelector('[data-test="confirm"]').click();
    await expect(promise).resolves.toBe(true);
    expect(ui.confirmState).toBeNull();
  });

  it('resolves false on cancel', async () => {
    const ui = useUiStore();
    mount(ConfirmDialog, { attachTo: document.body });
    const promise = ui.confirm({ title: 'Sure?' });
    await new Promise((r) => setTimeout(r));

    document.body.querySelector('[data-test="cancel"]').click();
    await expect(promise).resolves.toBe(false);
  });
});
