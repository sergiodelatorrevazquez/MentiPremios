import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
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

  it('offers compatible video sources without autoplay', () => {
    const wrapper = mount(MultimediaViewer, {
      props: {
        modelValue: true,
        media: {
          tipo: 'video',
          src: '/assets/video.mp4',
          alt: 'Video de ejemplo',
          sources: [
            { src: '/assets/video.mp4', type: 'video/mp4' },
            { src: '/assets/video.webm', type: 'video/webm' },
          ],
        },
      },
    });

    const video = wrapper.find('video');
    expect(video.attributes('preload')).toBe('metadata');
    expect(video.attributes('playsinline')).toBeDefined();
    expect(video.attributes('autoplay')).toBeUndefined();
    expect(video.findAll('source').map((source) => source.attributes('type')))
      .toEqual(['video/mp4', 'video/webm']);
  });

  it('traps tab focus in the dialog and restores focus after Escape', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const wrapper = mount(MultimediaViewer, {
      attachTo: document.body,
      props: { modelValue: false, media: null },
    });

    await wrapper.setProps({
      modelValue: true,
      media: { tipo: 'imagen', src: '/image.jpg', alt: 'Imagen de prueba' },
    });
    await nextTick();
    await nextTick();
    const dialog = wrapper.find('.photo-modal');
    const closeButton = wrapper.find('.modal-close-btn');
    expect(dialog.attributes('aria-label')).toBe('Imagen de prueba');
    expect(document.activeElement).toBe(closeButton.element);

    await closeButton.trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton.element);

    await dialog.trigger('keydown', { key: 'Escape' });
    await wrapper.setProps({ modelValue: false, media: null });
    await nextTick();
    await nextTick();
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(document.activeElement).toBe(opener);
    wrapper.unmount();
    opener.remove();
  });
});
