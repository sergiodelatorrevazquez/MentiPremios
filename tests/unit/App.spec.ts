import { mount } from '@vue/test-utils';
import { vi } from 'vitest';
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra la pantalla de login inicialmente', async () => {
    const wrapper = mount(App);
    expect(wrapper.find('.hero-title').text()).toContain('Sin Mentirosas no hay Traidores');
  });

  it('tiene input con maxlength de 50', async () => {
    const wrapper = mount(App);
    const input = wrapper.find('input.field-input');
    expect(input.attributes('maxlength')).toBe('50');
  });

  it('tiene textarea con maxlength de 2000', async () => {
    const wrapper = mount(App);
    const input = wrapper.find('input.field-input');
    await input.setValue('test-code');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.find('button.button-primary').trigger('click');

    await new Promise((r) => setTimeout(r, 100));

    const textarea = wrapper.find('textarea.field-textarea');
    expect(textarea.exists()).toBe(true);
    expect(textarea.attributes('maxlength')).toBe('2000');
  });

  it('deshabilita el botón si no hay texto', async () => {
    const wrapper = mount(App);
    const button = wrapper.find('button.button-primary');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('abre el visor de foto al hacer click', async () => {
    const wrapper = mount(App);
    expect(wrapper.find('.photo-modal').exists()).toBe(false);
    await wrapper.find('.avatar-button').trigger('click');
    expect(wrapper.find('.photo-modal').exists()).toBe(true);
  });

  it('cierra el visor de foto al hacer click fuera', async () => {
    const wrapper = mount(App);
    await wrapper.find('.avatar-button').trigger('click');
    expect(wrapper.find('.photo-modal').exists()).toBe(true);
    await wrapper.find('.photo-modal').trigger('click');
    expect(wrapper.find('.photo-modal').exists()).toBe(false);
  });

  it('muestra el botón de cerrar en el modal', async () => {
    const wrapper = mount(App);
    await wrapper.find('.avatar-button').trigger('click');
    expect(wrapper.find('.modal-close-btn').exists()).toBe(true);
  });
});
