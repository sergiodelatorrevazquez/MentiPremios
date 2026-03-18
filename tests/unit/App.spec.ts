import { mount } from '@vue/test-utils';
import App from '../../src/App.vue';

vi.mock('../../src/services/premiosService', () => ({
  guardarRespuestaUsuario: vi.fn().mockResolvedValue(undefined),
  marcarCodigoComoUsado: vi.fn().mockResolvedValue(undefined),
  obtenerCodigoPorPalabraSecreta: vi.fn().mockResolvedValue({
    id: 'secreta-123',
    nombre: 'Sergio',
    usado: false,
  }),
}));

describe('App', () => {
  it('deshabilita el botón de entrar si no hay palabra secreta', () => {
    const wrapper = mount(App);
    const button = wrapper.get('button.button-primary');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('permite avanzar a bienvenida con palabra secreta válida', async () => {
    const wrapper = mount(App);
    const input = wrapper.get('input.field-input');
    const button = wrapper.get('button.button-primary');

    await input.setValue('secreta-123');
    await button.trigger('click');

    expect(wrapper.html()).toContain('Hola, Sergio');
  });
});



