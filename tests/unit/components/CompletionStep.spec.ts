import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CompletionStep from '../../../src/features/survey/presentation/CompletionStep.vue';

function mountCompletionStep(props: Partial<{ codigo: string; message: string | null }> = {}) {
  return mount(CompletionStep, {
    props: {
      codigo: 'pitufo',
      message: '¡Respuestas guardadas correctamente en MentiPremios!',
      ...props,
    },
  });
}

describe('CompletionStep', () => {
  describe('renderizado', () => {
    it('agradece al participante y muestra el mensaje de guardado', () => {
      const wrapper = mountCompletionStep();

      expect(wrapper.find('h1').text()).toBe('Gracias por participar, pitufo');
      expect(wrapper.find('.status--success').text())
        .toBe('¡Respuestas guardadas correctamente en MentiPremios!');
    });

    it('anuncia el resultado de forma cortés', () => {
      const status = mountCompletionStep().find('[role="status"]');

      expect(status.exists()).toBe(true);
      expect(status.attributes('aria-live')).toBe('polite');
    });

    it('explica para qué se guardan las respuestas', () => {
      expect(mountCompletionStep().text()).toContain('montar una gala de premios inolvidable');
    });
  });

  describe('props', () => {
    it('usa un texto de reserva cuando no llega mensaje', () => {
      const wrapper = mountCompletionStep({ message: null });

      expect(wrapper.find('.status--success').text())
        .toBe('Tus respuestas se han guardado correctamente.');
    });

    it('refleja el codigo que recibe en el encabezado', () => {
      expect(mountCompletionStep({ codigo: 'og' }).find('h1').text())
        .toBe('Gracias por participar, og');
    });
  });

  describe('eventos emitidos', () => {
    it('no emite nada: el paso es terminal', () => {
      expect(mountCompletionStep().emitted()).toEqual({});
    });
  });

  describe('estados de carga', () => {
    it('no muestra estado de guardado en curso porque ya terminó', () => {
      const wrapper = mountCompletionStep();

      expect(wrapper.find('[aria-busy]').exists()).toBe(false);
      expect(wrapper.find('button').exists()).toBe(false);
      expect(wrapper.find('[disabled]').exists()).toBe(false);
    });
  });

  describe('estados de error', () => {
    it('no muestra alertas: aquí ya no puede haber fallo', () => {
      const wrapper = mountCompletionStep();

      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    });
  });
});
