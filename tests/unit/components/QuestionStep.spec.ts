import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import QuestionStep from '../../../src/features/survey/presentation/QuestionStep.vue';
import { preguntas } from '../../../src/features/survey/domain/questions';
import type { Opcion, OptionId, Pregunta } from '../../../src/features/survey/domain/survey.types';

const TOTAL = preguntas.length;

function mountQuestionStep(props: Partial<{
  question: Pregunta;
  selectedOptionId: OptionId | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  progress: number;
  canGoBack: boolean;
  canContinue: boolean;
  isSubmitting: boolean;
  hasSubmissionError: boolean;
}> = {}) {
  return mount(QuestionStep, {
    props: {
      question: preguntas[0],
      selectedOptionId: null,
      currentQuestionIndex: 0,
      totalQuestions: TOTAL,
      progress: 10,
      canGoBack: false,
      canContinue: false,
      isSubmitting: false,
      hasSubmissionError: false,
      ...props,
    },
  });
}

function preguntaConVideo(): Pregunta {
  const video = preguntas.find((question) => question.id === 'video')!;

  return {
    ...video,
    opciones: video.opciones.map((option, index) => (index === 0
      ? {
        ...option,
        multimedia: {
          ...option.multimedia!,
          src: '/assets/video.mp4',
          alt: 'Video 1',
          unavailable: false,
          sources: [
            { src: '/assets/video.mp4', type: 'video/mp4' as const },
            { src: '/assets/video.webm', type: 'video/webm' as const },
          ],
        },
      }
      : option)),
  };
}

describe('QuestionStep', () => {
  describe('renderizado', () => {
    it('muestra el título y una tarjeta por opción', () => {
      const wrapper = mountQuestionStep();

      expect(wrapper.find('h1').text()).toBe(preguntas[0].titulo);
      expect(wrapper.findAll('.option-card')).toHaveLength(preguntas[0].opciones.length);
    });

    it('elige la retícula según el número de opciones', () => {
      for (const question of preguntas) {
        const wrapper = mountQuestionStep({ question });
        const expected = `options-grid--${question.opciones.length}`;

        expect(wrapper.find(`.options-grid.${expected}`).exists()).toBe(true);
      }
    });

    it('indica la posición dentro de la encuesta y el progreso', () => {
      const wrapper = mountQuestionStep({ currentQuestionIndex: 3, progress: 40 });

      expect(wrapper.text()).toContain('Pregunta 4 de 10');
      expect(wrapper.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('40');
      expect(wrapper.find('.progress-bar-fill').attributes('style')).toContain('40%');
    });

    it('no precarga el vídeo antes de que el usuario lo abra', () => {
      const wrapper = mountQuestionStep({ question: preguntaConVideo() });
      const preview = wrapper.find('video.option-media-thumbnail');

      expect(preview.attributes('preload')).toBe('none');
      expect(preview.attributes('playsinline')).toBeDefined();
      expect(preview.attributes('aria-label')).toBe('Video 1');
      expect(preview.findAll('source').map((source) => source.attributes('type')))
        .toEqual(['video/mp4', 'video/webm']);
    });
  });

  describe('props', () => {
    it('expone la opción seleccionada a la tecnología asistiva', () => {
      const wrapper = mountQuestionStep({ selectedOptionId: preguntas[0].opciones[0].id });
      const cards = wrapper.findAll('.option-card');

      expect(cards[0].attributes('aria-pressed')).toBe('true');
      expect(cards[1].attributes('aria-pressed')).toBe('false');
      expect(cards[0].classes()).toContain('option-card--selected');
    });

    it('usa la imagen de reserva cuando el multimedia no está disponible', () => {
      const question = preguntas.find((q) => q.id === 'foto')!;
      const wrapper = mountQuestionStep({ question });
      const imagen = wrapper.find('.option-media-thumbnail');

      expect(imagen.attributes('src')).toBe('/media-unavailable.svg');
      expect(imagen.attributes('alt')).toBeTruthy();
    });

    it('renderiza la miniatura de una imagen disponible', () => {
      const question = preguntas.find((q) => q.id === 'foto')!;
      const conImagen = {
        ...question,
        opciones: question.opciones.map((option, index) => (index === 0
          ? {
            ...option,
            multimedia: {
              tipo: 'imagen' as const,
              src: '/assets/foto-1.jpg',
              alt: 'Foto 1',
              unavailable: false,
            },
          }
          : option)),
      };
      const imagen = mountQuestionStep({ question: conImagen }).find('.option-media-thumbnail');

      expect(imagen.attributes('src')).toBe('/assets/foto-1.jpg');
      expect(imagen.attributes('loading')).toBe('lazy');
      expect(imagen.attributes('alt')).toBe('Foto 1');
    });

    it('habilita o deshabilita la acción principal según canContinue', () => {
      expect(mountQuestionStep({ canContinue: false })
        .find('button.button-primary').attributes('disabled')).toBeDefined();
      expect(mountQuestionStep({ canContinue: true })
        .find('button.button-primary').attributes('disabled')).toBeUndefined();
    });
  });

  describe('eventos emitidos', () => {
    it('emite select-option con el identificador de la opción pulsada', async () => {
      const wrapper = mountQuestionStep();

      await wrapper.findAll('.option-card')[1].trigger('click');

      expect(wrapper.emitted('select-option')).toEqual([[preguntas[0].opciones[1].id]]);
    });

    it('emite submit al pulsar la acción principal', async () => {
      const wrapper = mountQuestionStep({ canContinue: true });

      await wrapper.find('button.button-primary').trigger('click');

      expect(wrapper.emitted('submit')).toHaveLength(1);
    });

    it('emite go-back al pulsar atrás', async () => {
      const wrapper = mountQuestionStep({ canGoBack: true });

      await wrapper.find('button.button-secondary').trigger('click');

      expect(wrapper.emitted('go-back')).toHaveLength(1);
    });

    it('no emite go-back si no se puede volver', async () => {
      const wrapper = mountQuestionStep({ canGoBack: false });

      await wrapper.find('button.button-secondary').trigger('click');

      expect(wrapper.emitted('go-back')).toBeUndefined();
    });

    it('emite el inicio de pulsación solo en opciones con multimedia', async () => {
      const conMedia = {
        ...preguntas[0],
        opciones: [
          {
            ...preguntas[0].opciones[0],
            multimedia: {
              tipo: 'imagen' as const,
              src: '/assets/foto-1.jpg',
              alt: 'Foto 1',
              unavailable: false,
            },
          },
          preguntas[0].opciones[1],
        ],
      };
      const wrapper = mountQuestionStep({ question: conMedia });

      await wrapper.findAll('.option-card')[0].trigger('mousedown');
      await wrapper.findAll('.option-card')[0].trigger('touchstart');
      await wrapper.findAll('.option-card')[1].trigger('mousedown');

      expect(wrapper.emitted('long-press-start')).toHaveLength(2);
      expect(wrapper.emitted('long-press-start')![0]).toHaveLength(1);
    });

    it('emite el fin de la pulsación al soltar o al salir', async () => {
      const wrapper = mountQuestionStep({ question: preguntaConVideo() });
      const card = wrapper.findAll('.option-card')[0];

      await card.trigger('mousedown');
      await card.trigger('mouseup');
      await card.trigger('mouseleave');
      await card.trigger('touchend');

      expect(wrapper.emitted('long-press-end')).toHaveLength(3);
    });
  });

  describe('estados de carga', () => {
    it('anuncia el envío en curso y cambia la etiqueta en la última pregunta', () => {
      const wrapper = mountQuestionStep({
        currentQuestionIndex: TOTAL - 1,
        canContinue: true,
        isSubmitting: true,
      });
      const button = wrapper.find('button.button-primary');

      expect(button.text()).toBe('Guardando...');
      expect(button.attributes('aria-busy')).toBe('true');
    });

    it('mantiene "Siguiente pregunta" mientras no sea la última', () => {
      expect(mountQuestionStep({ isSubmitting: true })
        .find('button.button-primary').text()).toBe('Siguiente pregunta');
    });
  });

  describe('estados de error', () => {
    it('etiqueta el reintento cuando el envío previo falló', () => {
      const wrapper = mountQuestionStep({
        currentQuestionIndex: TOTAL - 1,
        selectedOptionId: 'correa-1',
        progress: 100,
        canGoBack: true,
        canContinue: true,
        hasSubmissionError: true,
      });

      expect(wrapper.find('button.button-primary').text()).toBe('Reintentar envío');
    });

    it('vuelve a la etiqueta de envío normal tras limpiar el error', async () => {
      const wrapper = mountQuestionStep({
        currentQuestionIndex: TOTAL - 1,
        canContinue: true,
        hasSubmissionError: true,
      });

      expect(wrapper.find('button.button-primary').text()).toBe('Reintentar envío');
      await wrapper.setProps({ hasSubmissionError: false });
      expect(wrapper.find('button.button-primary').text()).toBe('Enviar y cerrar');
    });

    it('muestra un estado vacío y bloquea el envío si no hay opciones', () => {
      const wrapper = mountQuestionStep({ question: { ...preguntas[0], opciones: [] } });

      expect(wrapper.find('.status--empty').attributes('role')).toBe('status');
      expect(wrapper.find('.status--empty').text()).toContain('No hay opciones disponibles');
      expect(wrapper.findAll('.option-card')).toHaveLength(0);
      expect(wrapper.find('button.button-primary').attributes('disabled')).toBeDefined();
    });
  });
});
