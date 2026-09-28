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
      },
    });

    await wrapper.findAll('.option-card')[0].trigger('click');
    await wrapper.find('button.button-primary').trigger('click');

    expect(wrapper.emitted('select-option')).toBeTruthy();
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });
});
