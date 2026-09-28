import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WelcomeStep from '../../../src/features/survey/presentation/WelcomeStep.vue';

function mountWelcomeStep(participantName = 'Sergio') {
  return mount(WelcomeStep, { props: { participantName } });
}

describe('WelcomeStep', () => {
  describe('renderizado', () => {
    it('saluda por el nombre del participante', () => {
      const wrapper = mountWelcomeStep();

      expect(wrapper.find('h1').text()).toBe('Sergio');
      expect(wrapper.text()).toContain('Empezar la encuesta');
    });

    it('explica que las preguntas saldrán una a una', () => {
      const wrapper = mountWelcomeStep();

      expect(wrapper.text()).toContain('empezarán a salir las preguntas una a una');
      expect(wrapper.text()).toContain('tienes que votar a Miguel como correa obligatoriamente');
    });
  });

  describe('props', () => {
    it('refleja cualquier nombre, no uno fijo', () => {
      expect(mountWelcomeStep('Ana').find('h1').text()).toBe('Ana');
      expect(mountWelcomeStep('').find('h1').text()).toBe('');
    });
  });

  describe('eventos emitidos', () => {
    it('emite continue al pulsar el botón', async () => {
      const wrapper = mountWelcomeStep();

      await wrapper.find('button.button-primary').trigger('click');

      expect(wrapper.emitted('continue')).toHaveLength(1);
    });

    it('declara un único evento propio', () => {
      const wrapper = mountWelcomeStep();

      expect(wrapper.emitted()).toEqual({});
    });
  });

  describe('estados de carga', () => {
    it('mantiene la acción disponible: este paso no bloquea', () => {
      const wrapper = mountWelcomeStep();

      expect(wrapper.find('button.button-primary').attributes('disabled')).toBeUndefined();
      expect(wrapper.find('button.button-primary').attributes('aria-busy')).toBeUndefined();
    });
  });

  describe('estados de error', () => {
    it('no muestra alertas: la validación ya ocurrió en el paso anterior', () => {
      const wrapper = mountWelcomeStep();

      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.find('[aria-invalid]').exists()).toBe(false);
    });
  });
});
