import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import LoginStep from '../../../src/features/survey/presentation/LoginStep.vue';

function mountLoginStep(props: Partial<{
  modelValue: string;
  loginError: string | null;
  invitationAlreadyUsed: boolean;
  isSubmitting: boolean;
}> = {}) {
  return mount(LoginStep, {
    props: {
      modelValue: '',
      loginError: null,
      invitationAlreadyUsed: false,
      isSubmitting: false,
      ...props,
    },
  });
}

describe('LoginStep', () => {
  describe('renderizado', () => {
    it('muestra el encabezado y la acción principal', () => {
      const wrapper = mountLoginStep();

      expect(wrapper.text()).toContain('Bienvenido a los premios de');
      expect(wrapper.text()).toContain('Sin Mentirosas no hay Traidores');
      expect(wrapper.find('button.button-primary').text()).toBe('Entrar a mi encuesta');
    });

    it('advierte de que la palabra secreta solo se puede usar una vez', () => {
      expect(mountLoginStep().text()).toContain('Solo podrás usar esta palabra una vez');
    });
  });

  describe('props', () => {
    it('refleja el valor del modelo en el input', () => {
      const input = mountLoginStep({ modelValue: 'secreto' }).find<HTMLInputElement>('#secret-word');

      expect(input.element.value).toBe('secreto');
    });

    it('limita la longitud del secreto a 50 caracteres', () => {
      expect(mountLoginStep().find('#secret-word').attributes('maxlength')).toBe('50');
    });

    it('asocia el input con su etiqueta', () => {
      const wrapper = mountLoginStep();

      expect(wrapper.find('label[for="secret-word"]').exists()).toBe(true);
      expect(wrapper.find('#secret-word').attributes('aria-invalid')).toBe('false');
    });
  });

  describe('eventos emitidos', () => {
    it('emite update:modelValue con cada pulsación', async () => {
      const wrapper = mountLoginStep();

      await wrapper.find('#secret-word').setValue('abc123');

      expect(wrapper.emitted('update:modelValue')).toEqual([['abc123']]);
    });

    it('emite submit al pulsar el botón con un secreto válido', async () => {
      const wrapper = mountLoginStep({ modelValue: 'abc123' });

      await wrapper.find('button').trigger('click');

      expect(wrapper.emitted('submit')).toHaveLength(1);
    });

    it('emite submit al pulsar Enter', async () => {
      const wrapper = mountLoginStep({ modelValue: 'abc123' });

      await wrapper.find('#secret-word').trigger('keyup.enter');

      expect(wrapper.emitted('submit')).toHaveLength(1);
    });
  });

  describe('estados de carga', () => {
    it('deshabilita la acción y anuncia el progreso mientras comprueba', () => {
      const wrapper = mountLoginStep({ modelValue: 'abc123', isSubmitting: true });
      const button = wrapper.find('button.button-primary');

      expect(button.text()).toBe('Comprobando...');
      expect(button.attributes('disabled')).toBeDefined();
      expect(button.attributes('aria-busy')).toBe('true');
      expect(wrapper.find('#secret-word').attributes('aria-busy')).toBe('true');
    });
  });

  describe('estados de error', () => {
    it('deshabilita la acción con un secreto vacío o solo espacios', () => {
      for (const modelValue of ['', '   ']) {
        const wrapper = mountLoginStep({ modelValue });
        const button = wrapper.find('button.button-primary');

        expect(button.attributes('disabled')).toBeDefined();
        expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      }
    });

    it('anuncia el error y lo describe desde el input', () => {
      const wrapper = mountLoginStep({ modelValue: 'abc123', loginError: 'Invalid secret' });
      const input = wrapper.find('#secret-word');

      expect(input.attributes('aria-invalid')).toBe('true');
      expect(input.attributes('aria-describedby')).toBe('secret-word-error');
      expect(wrapper.find('[role="alert"]').text()).toBe('Invalid secret');
      expect(wrapper.find('[role="alert"]').attributes('aria-live')).toBe('assertive');
    });

    it('muestra un botón para reproducir compi.ogg cuando la invitación ya se usó', () => {
      const wrapper = mountLoginStep({ invitationAlreadyUsed: true });
      const input = wrapper.find('#secret-word');

      expect(wrapper.find('.audio-notice-button').text()).toBe('Pincha aquí, compi');
      expect(wrapper.find('.field-error').text()).toContain('Pincha aquí, compi');
      expect(input.attributes('aria-invalid')).toBe('true');
      expect(input.attributes('aria-describedby')).toBe('secret-word-error');
      expect(wrapper.find('audio').attributes('src')).toContain('compi');
      expect(wrapper.find('audio').attributes('autoplay')).toBeUndefined();
    });

    it('inicia la reproducción solo al pulsar el botón', async () => {
      const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
      const wrapper = mountLoginStep({ invitationAlreadyUsed: true });

      expect(play).not.toHaveBeenCalled();
      await wrapper.find('.audio-notice-button').trigger('click');

      expect(play).toHaveBeenCalledOnce();
      play.mockRestore();
    });

    it('mantiene el texto introducido para que el usuario pueda corregirlo', () => {
      const input = mountLoginStep({
        modelValue: 'typo',
        loginError: 'La palabra secreta es incorrecta.',
      }).find<HTMLInputElement>('#secret-word');

      expect(input.element.value).toBe('typo');
    });
  });
});
