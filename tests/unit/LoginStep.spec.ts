import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import LoginStep from '../../src/features/survey/presentation/LoginStep.vue';

describe('LoginStep', () => {
  it('renders the login screen content', () => {
    const wrapper = mount(LoginStep, {
      props: {
        modelValue: '',
        loginError: null,
        isSubmitting: false,
      },
    });

    expect(wrapper.text()).toContain('Bienvenido a los premios de');
    expect(wrapper.text()).toContain('Entrar a mi encuesta');
  });

  it('emits submit when the user presses enter or clicks the button with a valid secret', async () => {
    const wrapper = mount(LoginStep, {
      props: {
        modelValue: 'abc123',
        loginError: null,
        isSubmitting: false,
      },
    });

    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('submit')).toHaveLength(1);
  });
});
