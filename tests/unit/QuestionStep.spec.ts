import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import QuestionStep from '../../src/features/survey/presentation/QuestionStep.vue';
import { preguntas } from '../../src/features/survey/domain/questions';

describe('QuestionStep', () => {
  it('renders question text and option list', () => {
    const wrapper = mount(QuestionStep, {
      props: {
        question: preguntas[0],
        selectedOptionId: null,
        currentQuestionIndex: 0,
        totalQuestions: preguntas.length,
        progress: 10,
        canGoBack: false,
        canContinue: false,
        isSubmitting: false,
        hasSubmissionError: false,
      },
    });

    expect(wrapper.text()).toContain(preguntas[0].titulo);
    expect(wrapper.findAll('.option-card').length).toBeGreaterThan(0);
  });

  it('emits select-option and submit events', async () => {
    const wrapper = mount(QuestionStep, {
      props: {
        question: preguntas[0],
        selectedOptionId: null,
        currentQuestionIndex: 0,
        totalQuestions: preguntas.length,
        progress: 10,
        canGoBack: false,
        canContinue: true,
        isSubmitting: false,
        hasSubmissionError: false,
      },
    });

    await wrapper.findAll('.option-card')[0].trigger('click');
    await wrapper.find('button.button-primary').trigger('click');

    expect(wrapper.emitted('select-option')).toBeTruthy();
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it('does not preload a video preview before the user opens it', () => {
    const videoQuestion = preguntas.find((question) => question.id === 'video');
    const questionWithVideo = {
      ...videoQuestion!,
      opciones: videoQuestion!.opciones.map((option, index) => index === 0
        ? {
          ...option,
          multimedia: {
            ...option.multimedia!,
            src: '/assets/video.mp4',
            alt: 'Video 1',
            assetPath: 'src/assets/video-1.mp4',
            unavailable: false,
            sources: [
              { src: '/assets/video.mp4', type: 'video/mp4' as const },
              { src: '/assets/video.webm', type: 'video/webm' as const },
            ],
          },
        }
        : option),
    };
    const wrapper = mount(QuestionStep, {
      props: {
        question: questionWithVideo,
        selectedOptionId: null,
        currentQuestionIndex: 0,
        totalQuestions: preguntas.length,
        progress: 10,
        canGoBack: false,
        canContinue: false,
        isSubmitting: false,
        hasSubmissionError: false,
      },
    });

    const preview = wrapper.find('video.option-media-thumbnail');
    expect(preview.attributes('preload')).toBe('none');
    expect(preview.attributes('playsinline')).toBeDefined();
    expect(preview.attributes('aria-label')).toBe('Video 1');
    expect(preview.findAll('source').map((source) => source.attributes('type')))
      .toEqual(['video/mp4', 'video/webm']);
  });

  it('shows an empty state when a question has no available options', () => {
    const wrapper = mount(QuestionStep, {
      props: {
        question: { ...preguntas[0], opciones: [] },
        selectedOptionId: null,
        currentQuestionIndex: 0,
        totalQuestions: preguntas.length,
        progress: 10,
        canGoBack: false,
        canContinue: false,
        isSubmitting: false,
        hasSubmissionError: false,
      },
    });

    expect(wrapper.find('.status--empty').text()).toContain('No hay opciones disponibles');
    expect(wrapper.findAll('.option-card')).toHaveLength(0);
    expect(wrapper.find('button.button-primary').attributes('disabled')).toBeDefined();
  });

  it('labels a failed final submission as a retry', () => {
    const wrapper = mount(QuestionStep, {
      props: {
        question: preguntas[9],
        selectedOptionId: 'correa-1',
        currentQuestionIndex: 9,
        totalQuestions: preguntas.length,
        progress: 100,
        canGoBack: true,
        canContinue: true,
        isSubmitting: false,
        hasSubmissionError: true,
      },
    });

    expect(wrapper.find('button.button-primary').text()).toBe('Reintentar envío');
  });
});
