import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AvatarPhotoViewer from '../../src/features/survey/presentation/AvatarPhotoViewer.vue';

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
});
