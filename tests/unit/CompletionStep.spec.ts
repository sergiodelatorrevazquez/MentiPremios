import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CompletionStep from '../../src/features/survey/presentation/CompletionStep.vue';

describe('CompletionStep', () => {
  it('renders success text and saved message', () => {
    const wrapper = mount(CompletionStep, {
      props: {
        participantName: 'Sergio',
        message: '¡Respuestas guardadas correctamente en MentiPremios!',
      },
    });

    expect(wrapper.text()).toContain('Gracias por participar, Sergio');
    expect(wrapper.text()).toContain('¡Respuestas guardadas correctamente en MentiPremios!');
    expect(wrapper.find('[role="status"]').attributes('aria-live')).toBe('polite');
  });
});
