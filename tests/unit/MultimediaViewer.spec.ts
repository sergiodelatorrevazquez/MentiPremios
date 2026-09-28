import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MultimediaViewer from '../../src/features/survey/presentation/MultimediaViewer.vue';

describe('MultimediaViewer', () => {
  it('renders image media when open', () => {
    const wrapper = mount(MultimediaViewer, {
      props: {
        modelValue: true,
        media: {
          tipo: 'imagen',
          src: '/image.jpg',
          alt: 'Foto de ejemplo',
        },
      },
    });

    expect(wrapper.find('.photo-modal').exists()).toBe(true);
    expect(wrapper.find('.photo-modal-image').exists()).toBe(true);
  });

  it('emits close when close button is clicked', async () => {
    const wrapper = mount(MultimediaViewer, {
      props: {
        modelValue: true,
        media: {
          tipo: 'video',
          src: '/video.mp4',
          alt: 'Video de ejemplo',
        },
      },
    });

    await wrapper.find('.modal-close-btn').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
