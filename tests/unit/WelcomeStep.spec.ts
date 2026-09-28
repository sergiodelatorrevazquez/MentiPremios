import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WelcomeStep from '../../src/features/survey/presentation/WelcomeStep.vue';

describe('WelcomeStep', () => {
  it('renders the user welcome message and start button', () => {
    const wrapper = mount(WelcomeStep, {
      props: {
        participantName: 'Sergio',
      },
    });

    expect(wrapper.text()).toContain('Sergio');
    expect(wrapper.text()).toContain('Empezar la encuesta');
  });

  it('emits continue when the button is pressed', async () => {
    const wrapper = mount(WelcomeStep, {
      props: {
        participantName: 'Sergio',
      },
    });

    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('continue')).toHaveLength(1);
  });
});
