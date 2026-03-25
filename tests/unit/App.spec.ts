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

describe('App - Login', () => {
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

  it('deshabilita el botón de login si no hay texto', async () => {
    const wrapper = mount(App);
    const button = wrapper.find('button.button-primary');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('habilita el botón de login cuando hay texto', async () => {
    const wrapper = mount(App);
    const input = wrapper.find('input.field-input');
    await input.setValue('test-code');
    const button = wrapper.find('button.button-primary');
    expect(button.attributes('disabled')).toBeUndefined();
  });

  it('muestra error cuando la palabra secreta es incorrecta', async () => {
    const { obtenerCodigoPorPalabraSecreta } = await import('../../src/services/premiosService');
    vi.mocked(obtenerCodigoPorPalabraSecreta).mockResolvedValueOnce(null);

    const wrapper = mount(App);
    const input = wrapper.find('input.field-input');
    await input.setValue('palabra-incorrecta');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.field-error').text()).toContain('incorrecta');
  });

  it('muestra error cuando la palabra ya ha sido usada', async () => {
    const { obtenerCodigoPorPalabraSecreta } = await import('../../src/services/premiosService');
    vi.mocked(obtenerCodigoPorPalabraSecreta).mockResolvedValueOnce({
      id: 'secreta-123',
      nombre: 'Sergio',
      usado: true,
    });

    const wrapper = mount(App);
    const input = wrapper.find('input.field-input');
    await input.setValue('palabra-ya-usada');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.field-error').text()).toContain('Ya has respondido');
  });
});

describe('App - Welcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra la pantalla de bienvenida con el nombre del usuario', async () => {
    const wrapper = mount(App);
    const input = wrapper.find('input.field-input');
    await input.setValue('test-code');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.hero-title').text()).toContain('Sergio');
  });
});

describe('App - Questions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra las preguntas con opciones', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    expect(wrapper.find('.hero-title').text()).toContain('del Año');
    expect(wrapper.findAll('.option-card').length).toBeGreaterThan(0);
  });

  it('muestra el progreso correctamente', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    expect(wrapper.find('.progress-bar').text()).toContain('1');
  });

  it('permite seleccionar una opción', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    const opciones = wrapper.findAll('.option-card');
    await opciones[0].trigger('click');
    await wrapper.vm.$nextTick();

    expect(opciones[0].classes()).toContain('option-card--selected');
  });

  it('habilita el botón de siguiente cuando hay opción seleccionada', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    const button = wrapper.find('button.button-primary');
    expect(button.attributes('disabled')).toBeDefined();

    const opciones = wrapper.findAll('.option-card');
    await opciones[0].trigger('click');
    await wrapper.vm.$nextTick();

    expect(button.attributes('disabled')).toBeUndefined();
  });

  it('pasa a la siguiente pregunta al hacer click en siguiente', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    const opciones = wrapper.findAll('.option-card');
    await opciones[0].trigger('click');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.progress-bar').text()).toContain('2');
  });

  it('deshabilita el botón de atrás en la primera pregunta', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    const button = wrapper.find('button.button-secondary');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('permite volver atrás y restaura la respuesta', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    const opciones = wrapper.findAll('.option-card');
    await opciones[0].trigger('click');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    await wrapper.find('button.button-secondary').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.progress-bar').text()).toContain('1');
  });

  it('guarda las respuestas al completar todas las preguntas', async () => {
    const { guardarRespuestaUsuario, marcarCodigoComoUsado } = await import('../../src/services/premiosService');

    const wrapper = mount(App);
    await loginAndStart(wrapper);

    const totalQuestions = wrapper.findAll('.option-card').length > 0 ? 10 : 0;
    for (let i = 0; i < totalQuestions; i++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    expect(guardarRespuestaUsuario).toHaveBeenCalled();
    expect(marcarCodigoComoUsado).toHaveBeenCalledWith('secreta-123');
  });

  it('muestra pantalla de agradecimiento al completar', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    const opciones = wrapper.findAll('.option-card');
    if (opciones.length === 0) return;

    for (let i = 0; i < 10; i++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    expect(wrapper.find('.hero-title').text()).toContain('Gracias');
    expect(wrapper.find('.status--success').exists()).toBe(true);
  });
});

describe('App - Visor de foto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('abre el visor de foto al hacer click en el avatar', async () => {
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

  it('cierra el visor con el botón de cerrar', async () => {
    const wrapper = mount(App);
    await wrapper.find('.avatar-button').trigger('click');
    expect(wrapper.find('.photo-modal').exists()).toBe(true);
    await wrapper.find('.modal-close-btn').trigger('click');
    expect(wrapper.find('.photo-modal').exists()).toBe(false);
  });
});

async function loginAndStart(wrapper: any) {
  const input = wrapper.find('input.field-input');
  await input.setValue('test-code');
  await wrapper.find('button.button-primary').trigger('click');
  await wrapper.vm.$nextTick();
  await wrapper.find('button.button-primary').trigger('click');
  await wrapper.vm.$nextTick();
}