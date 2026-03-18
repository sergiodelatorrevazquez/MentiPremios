import { mount } from '@vue/test-utils';
import App from '../../src/App.vue';

vi.mock('../../src/services/premiosService', () => ({
  guardarRespuestaUsuario: vi.fn().mockResolvedValue(undefined),
  guardarPalabrasClaveUsuario: vi.fn().mockResolvedValue(undefined),
}));

describe('App', () => {
  it('deshabilita el botón de enviar si faltan datos', () => {
    const wrapper = mount(App);
    const buttons = wrapper.findAll('button.button-primary');
    const submitButton = buttons[buttons.length - 1];
    expect(submitButton.attributes('disabled')).toBeDefined();
  });

  it('añade palabras clave', async () => {
    const wrapper = mount(App);
    const input = wrapper.get('input.field-input');

    await input.setValue('memes');
    await input.trigger('keyup.enter');

    expect(wrapper.html()).toContain('memes');
  });
});


