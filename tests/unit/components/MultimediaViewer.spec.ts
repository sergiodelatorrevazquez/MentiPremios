import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import MultimediaViewer from '../../../src/features/survey/presentation/MultimediaViewer.vue';
import type { Multimedia } from '../../../src/features/survey/domain/survey.types';

const imagen: Multimedia = { tipo: 'imagen', src: '/image.jpg', alt: 'Imagen de prueba' };
const video: Multimedia = {
  tipo: 'video',
  src: '/video.mp4',
  alt: 'Video de ejemplo',
  sources: [
    { src: '/video.mp4', type: 'video/mp4' },
    { src: '/video.webm', type: 'video/webm' },
  ],
};

function mountViewer(props: Partial<{ modelValue: boolean; media: Multimedia | null }> = {}) {
  return mount(MultimediaViewer, {
    props: { modelValue: true, media: imagen, ...props },
  });
}

describe('MultimediaViewer', () => {
  describe('renderizado', () => {
    it('muestra un diálogo modal con la imagen y su texto alternativo', () => {
      const wrapper = mountViewer();
      const dialog = wrapper.find('.photo-modal');

      expect(dialog.exists()).toBe(true);
      expect(dialog.attributes('role')).toBe('dialog');
      expect(dialog.attributes('aria-modal')).toBe('true');
      expect(dialog.attributes('aria-label')).toBe('Imagen de prueba');
      expect(wrapper.find('.photo-modal-image').attributes('alt')).toBe('Imagen de prueba');
    });

    it('ofrece las fuentes compatibles de vídeo sin reproducción automática', () => {
      const player = mountViewer({ media: video }).find('video');

      expect(player.attributes('preload')).toBe('metadata');
      expect(player.attributes('playsinline')).toBeDefined();
      expect(player.attributes('autoplay')).toBeUndefined();
      expect(player.attributes('aria-label')).toBe('Video de ejemplo');
      expect(player.findAll('source').map((source) => source.attributes('type')))
        .toEqual(['video/mp4', 'video/webm']);
    });

    it('etiqueta el diálogo con un texto por defecto cuando el medio no lo trae', () => {
      const wrapper = mountViewer({ media: { tipo: 'imagen', src: '/image.jpg' } });

      expect(wrapper.find('.photo-modal').attributes('aria-label')).toBe('Visor multimedia');
    });
  });

  describe('props', () => {
    it('no muestra nada si está cerrado', () => {
      expect(mountViewer({ modelValue: false }).find('.photo-modal').exists()).toBe(false);
    });

    it('no muestra nada si no hay medio aunque esté abierto', () => {
      expect(mountViewer({ media: null }).find('.photo-modal').exists()).toBe(false);
    });

    it('muestra la imagen de reserva cuando el medio no está disponible', () => {
      const wrapper = mountViewer({
        media: { ...imagen, src: '/media-unavailable.svg', unavailable: true },
      });

      expect(wrapper.find('.photo-modal-image').attributes('src')).toBe('/media-unavailable.svg');
    });
  });

  describe('eventos emitidos', () => {
    it('emite close al pulsar el botón de cerrar', async () => {
      const wrapper = mountViewer();

      await wrapper.find('.modal-close-btn').trigger('click');

      expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('emite close al pulsar el fondo, pero no el contenido', async () => {
      const wrapper = mountViewer();

      await wrapper.find('.photo-modal-inner').trigger('click');
      expect(wrapper.emitted('close')).toBeUndefined();

      await wrapper.find('.photo-modal').trigger('click');
      expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('emite close con la tecla Escape', async () => {
      const wrapper = mountViewer();

      await wrapper.find('.photo-modal').trigger('keydown', { key: 'Escape' });

      expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('ignora otras teclas que no sean Escape', async () => {
      const wrapper = mountViewer();

      await wrapper.find('.photo-modal').trigger('keydown', { key: 'Enter' });

      expect(wrapper.emitted('close')).toBeUndefined();
    });
  });

  describe('estados de carga', () => {
    it('bloquea el desplazamiento de la página solo mientras hay medio', async () => {
      const wrapper = mount(MultimediaViewer, {
        attachTo: document.body,
        props: { modelValue: true, media: null },
      });
      await nextTick();
      expect(document.body.style.overflow).toBe('');

      await wrapper.setProps({ media: imagen });
      await nextTick();
      expect(document.body.style.overflow).toBe('hidden');

      await wrapper.setProps({ modelValue: false, media: null });
      await nextTick();
      expect(document.body.style.overflow).toBe('');

      await wrapper.setProps({ modelValue: true, media: imagen });
      await nextTick();
      wrapper.unmount();
      expect(document.body.style.overflow).toBe('');
    });

    it('libera el bloqueo aunque se desmonte con el diálogo abierto', async () => {
      // El vigilante no es inmediato, así que el bloqueo se aplica al pasar a abierto.
      const wrapper = mount(MultimediaViewer, {
        attachTo: document.body,
        props: { modelValue: false, media: imagen },
      });
      await wrapper.setProps({ modelValue: true });
      await nextTick();
      expect(document.body.style.overflow).toBe('hidden');

      wrapper.unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('estados de error y accesibilidad', () => {
    it('atrapa el foco en el diálogo y lo restaura tras cerrar', async () => {
      const opener = document.createElement('button');
      document.body.append(opener);
      opener.focus();
      const wrapper = mount(MultimediaViewer, {
        attachTo: document.body,
        props: { modelValue: false, media: null },
      });

      await wrapper.setProps({ modelValue: true, media: imagen });
      await nextTick();
      await nextTick();
      const closeButton = wrapper.find('.modal-close-btn');
      expect(document.activeElement).toBe(closeButton.element);

      await closeButton.trigger('keydown', { key: 'Tab' });
      expect(document.activeElement).toBe(closeButton.element);

      await wrapper.find('.photo-modal').trigger('keydown', { key: 'Escape' });
      await wrapper.setProps({ modelValue: false, media: null });
      await nextTick();
      await nextTick();

      expect(wrapper.emitted('close')).toHaveLength(1);
      expect(document.activeElement).toBe(opener);
      wrapper.unmount();
      opener.remove();
    });
  });
});
