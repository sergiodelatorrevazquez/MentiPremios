import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WelcomeStep from '../../../src/features/survey/presentation/WelcomeStep.vue';

function mountWelcomeStep(codigo = 'pitufo') {
  return mount(WelcomeStep, { props: { codigo } });
}

describe('WelcomeStep', () => {
  describe('renderizado', () => {
    it('saluda con el identificador del documento', () => {
      const wrapper = mountWelcomeStep();

      expect(wrapper.find('h1').text()).toBe('pitufo');
      expect(wrapper.text()).toContain('Empezar la encuesta');
    });

    it('explica que las preguntas saldrán una a una', () => {
      const wrapper = mountWelcomeStep();

      expect(wrapper.text()).toContain('empezarán a salir las preguntas una a una');
      expect(wrapper.text()).toContain('tienes que votar a Miguel como correa obligatoriamente');
    });
  });

  describe('props', () => {
    it('refleja cualquier saludo, no uno fijo', () => {
      // El prop recibe el identificador del documento, que es lo que se
      // muestra hoy. Cuando se personalize, solo cambia lo que se le pasa.
      expect(mountWelcomeStep('og').find('h1').text()).toBe('og');
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
