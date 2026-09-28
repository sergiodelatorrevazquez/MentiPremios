import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import AvatarPhotoViewer from '../../../src/features/survey/presentation/AvatarPhotoViewer.vue';

function mountViewer(props: { modelValue: boolean }) {
  return mount(AvatarPhotoViewer, { props });
}

describe('AvatarPhotoViewer', () => {
  describe('renderizado', () => {
    it('muestra un diálogo modal con la imagen de los amigos', () => {
      const wrapper = mountViewer({ modelValue: true });
      const dialog = wrapper.find('.photo-modal');

      expect(dialog.exists()).toBe(true);
      expect(dialog.attributes('role')).toBe('dialog');
      expect(dialog.attributes('aria-modal')).toBe('true');
      expect(dialog.attributes('aria-label')).toBe('Foto de amigos');
      expect(wrapper.find('.photo-modal-image').attributes('alt')).toBe('Foto de amigos');
    });

    it('expone un botón de cierre accesible', () => {
      const close = mountViewer({ modelValue: true }).find('.modal-close-btn');

      expect(close.attributes('aria-label')).toBe('Cerrar');
      expect(close.element.tagName).toBe('BUTTON');
    });
  });

  describe('props', () => {
    it('no renderiza nada mientras está cerrado', () => {
      expect(mountViewer({ modelValue: false }).find('.photo-modal').exists()).toBe(false);
    });
  });

  describe('eventos emitidos', () => {
    it('emite close al pulsar el botón de cerrar', async () => {
      const wrapper = mountViewer({ modelValue: true });

      await wrapper.find('.modal-close-btn').trigger('click');

      expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('emite close al pulsar el fondo, pero no el contenido', async () => {
      const wrapper = mountViewer({ modelValue: true });

      await wrapper.find('.photo-modal-inner').trigger('click');
      expect(wrapper.emitted('close')).toBeUndefined();

      await wrapper.find('.photo-modal').trigger('click');
      expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('emite close con la tecla Escape e ignora el resto', async () => {
      const wrapper = mountViewer({ modelValue: true });

      await wrapper.find('.photo-modal').trigger('keydown', { key: 'Enter' });
      expect(wrapper.emitted('close')).toBeUndefined();

      await wrapper.find('.photo-modal').trigger('keydown', { key: 'Escape' });
      expect(wrapper.emitted('close')).toHaveLength(1);
    });
  });

  describe('estados de carga', () => {
    it('bloquea el desplazamiento de la página mientras está abierto', async () => {
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

      wrapper.unmount();
    });

    it('libera el bloqueo aunque se desmonte con el diálogo abierto', async () => {
      const wrapper = mount(AvatarPhotoViewer, {
        attachTo: document.body,
        props: { modelValue: false },
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
      const wrapper = mount(AvatarPhotoViewer, {
        attachTo: document.body,
        props: { modelValue: false },
      });

      await wrapper.setProps({ modelValue: true });
      await nextTick();
      await nextTick();
      const closeButton = wrapper.find('.modal-close-btn');
      expect(document.activeElement).toBe(closeButton.element);

      await closeButton.trigger('keydown', { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(closeButton.element);

      await wrapper.find('.photo-modal').trigger('keydown', { key: 'Escape' });
      await wrapper.setProps({ modelValue: false });
      await nextTick();
      await nextTick();

      expect(wrapper.emitted('close')).toHaveLength(1);
      expect(document.activeElement).toBe(opener);
      wrapper.unmount();
      opener.remove();
    });
  });
});
