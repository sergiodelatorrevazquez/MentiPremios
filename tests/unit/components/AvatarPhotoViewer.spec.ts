import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import AvatarPhotoViewer from '../../../src/features/survey/presentation/AvatarPhotoViewer.vue';

describe('AvatarPhotoViewer', () => {
  it('renders the avatar image when open', () => {
    const wrapper = mount(AvatarPhotoViewer, {
      props: {
        modelValue: true,
      },
    });

    expect(wrapper.find('.photo-modal').exists()).toBe(true);
    expect(wrapper.find('.photo-modal-image').exists()).toBe(true);
  });

  it('emits close when the close button is clicked', async () => {
    const wrapper = mount(AvatarPhotoViewer, {
      props: {
        modelValue: true,
      },
    });

    await wrapper.find('.modal-close-btn').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('moves focus into the dialog, closes with Escape and restores focus', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const wrapper = mount(AvatarPhotoViewer, {
      attachTo: document.body,
      props: { modelValue: false },
    });

    await wrapper.setProps({ modelValue: true });
    await nextTick();
    await nextTick();
    const dialog = wrapper.find('.photo-modal');
    const closeButton = wrapper.find('.modal-close-btn');
    expect(document.activeElement).toBe(closeButton.element);

    await closeButton.trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(closeButton.element);

    await dialog.trigger('keydown', { key: 'Escape' });
    await wrapper.setProps({ modelValue: false });
    await nextTick();
    await nextTick();
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(document.activeElement).toBe(opener);
    wrapper.unmount();
    opener.remove();
  });

  it('locks the page behind the dialog and releases it on close and unmount', async () => {
    const wrapper = mount(AvatarPhotoViewer, {
      attachTo: document.body,
      props: { modelValue: false },
    });

    await wrapper.setProps({ modelValue: true });
    await nextTick();
    expect(document.body.style.overflow).toBe('hidden');

    await wrapper.setProps({ modelValue: false });
    await nextTick();
    expect(document.body.style.overflow).toBe('');

    await wrapper.setProps({ modelValue: true });
    await nextTick();
    wrapper.unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
