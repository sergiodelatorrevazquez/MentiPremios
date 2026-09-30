import { config, flushPromises, mount } from '@vue/test-utils';
import { vi } from 'vitest';
import App from '../../src/app/App.vue';
import { APP_SERVICES_KEY, type AppServices } from '../../src/app/bootstrap';
import { InvitationAlreadyUsedError, InvalidInvitationError } from '../../src/features/survey/application/errors';
import type { SurveySubmission } from '../../src/features/survey/domain/survey.types';
import { preguntas } from '../../src/features/survey/domain/questions';
import { calcularResultadoEncuesta } from '../../src/features/results/domain/results.rules';
import { logger, type LogEntry } from '../../src/infrastructure/logging/logger';
import { metrics } from '../../src/infrastructure/metrics/metrics';

const entries: LogEntry[] = [];

const mockAppServices: AppServices = {
  validateInvitation: vi.fn().mockResolvedValue({
    id: 'secreta-123',
    voted: false,
  }),
  submitSurvey: vi.fn().mockResolvedValue({} as SurveySubmission),
  getResults: vi.fn().mockResolvedValue(null),
};

config.global.provide = { [APP_SERVICES_KEY]: mockAppServices };

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
    vi.mocked(mockAppServices.validateInvitation).mockRejectedValueOnce(
      new InvalidInvitationError('invitation-not-found'),
    );

    const wrapper = mount(App);
    const input = wrapper.find('input.field-input');
    await input.setValue('palabra-incorrecta');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.field-error').text()).toContain('incorrecta');
  });

  it('muestra error cuando la palabra ya ha sido usada', async () => {
    vi.mocked(mockAppServices.validateInvitation).mockRejectedValueOnce(
      new InvitationAlreadyUsedError(),
    );

    const wrapper = mount(App);
    const input = wrapper.find('input.field-input');
    await input.setValue('palabra-ya-usada');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.field-error').text()).toContain('Ya has respondido');
  });

  it('muestra estado de comprobación y deshabilita login mientras espera', async () => {
    let resolveValidation: ((value: { id: string; voted: false }) => void) | undefined;
    vi.mocked(mockAppServices.validateInvitation).mockImplementationOnce(
      () => new Promise((resolve) => { resolveValidation = resolve; }),
    );

    const wrapper = mount(App);
    await wrapper.find('input.field-input').setValue('test-code');
    const submit = wrapper.find('button.button-primary');
    const validation = submit.trigger('click');
    await wrapper.vm.$nextTick();

    expect(submit.text()).toBe('Comprobando...');
    expect(submit.attributes('disabled')).toBeDefined();

    resolveValidation?.({ id: 'secreta-123', voted: false });
    await validation;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.hero-title').text()).toContain('secreta-123');
  });
});

describe('App - Welcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra la pantalla de bienvenida con el identificador del documento', async () => {
    const wrapper = mount(App);
    const input = wrapper.find('input.field-input');
    await input.setValue('test-code');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.hero-title').text()).toContain('secreta-123');
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

  it('restaura la opción seleccionada al volver atrás, no solo el índice', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    // Se elige la tercera opción, no la primera: volver a marcar la primera
    // pasaría con un test que solo comprobara "hay algo seleccionado".
    const elegidas = wrapper.findAll('.option-card');
    await elegidas[2].trigger('click');
    expect(elegidas[2].classes()).toContain('option-card--selected');
    expect(elegidas[0].classes()).not.toContain('option-card--selected');

    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.progress-bar').text()).toContain('2');

    await wrapper.find('button.button-secondary').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.progress-bar').text()).toContain('1');
    const restauradas = wrapper.findAll('.option-card');
    expect(restauradas[2].classes()).toContain('option-card--selected');
    expect(restauradas[2].attributes('aria-pressed')).toBe('true');
    expect(restauradas[0].attributes('aria-pressed')).toBe('false');
    expect(restauradas[1].attributes('aria-pressed')).toBe('false');
  });

  it('mantiene la respuesta guardada al volver atrás y avanzar de nuevo', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    await wrapper.findAll('.option-card')[1].trigger('click');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    await wrapper.find('button.button-secondary').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    // Al volver a avanzar se llega a la segunda pregunta y la primera sigue guardada,
    // lo que se comprueba en el envío completo de más abajo.
    expect(wrapper.find('.progress-bar').text()).toContain('2');
  });

  it('acumula las respuestas de varias preguntas al retroceder', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    await wrapper.findAll('.option-card')[1].trigger('click');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.findAll('.option-card')[3].trigger('click');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.progress-bar').text()).toContain('3');

    await wrapper.find('button.button-secondary').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.progress-bar').text()).toContain('2');
    expect(wrapper.findAll('.option-card')[3].classes()).toContain('option-card--selected');

    await wrapper.find('button.button-secondary').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.progress-bar').text()).toContain('1');
    expect(wrapper.findAll('.option-card')[1].classes()).toContain('option-card--selected');

    // Las dos respuestas previas siguen ahí: el envío final las lleva.
    for (let index = 0; index < 10; index++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }
  });

  it('permite cambiar una respuesta anterior y usar la nueva en el envío', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    await wrapper.findAll('.option-card')[0].trigger('click');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.find('button.button-secondary').trigger('click');
    await wrapper.vm.$nextTick();

    await wrapper.findAll('.option-card')[2].trigger('click');
    expect(wrapper.findAll('.option-card')[0].classes()).not.toContain('option-card--selected');
    expect(wrapper.findAll('.option-card')[2].classes()).toContain('option-card--selected');

    // Se avanza solo una vez para no volver a elegir la primera opción de la pregunta 1.
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    for (let index = 1; index < 10; index++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    expect(vi.mocked(mockAppServices.submitSurvey).mock.calls[0][0].answers.tonto).toBe('tonto-3');
  });

  it('envía exactamente el payload con invitación, nombre y respuestas', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    for (let questionIndex = 0; questionIndex < 10; questionIndex++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    // toHaveBeenCalledWith sin objectContaining: si aparece un campo extra,
    // la comparación falla. El formato en memoria incluye `questions` porque
    // submitSurvey necesita el catálogo para validar; lo que se guarda queda
    // reducido a { invitationId, answers }, como fijan bootstrap.spec y
    // repositoryContracts.spec. El nombre no viaja: lo identifica el id.
    expect(mockAppServices.submitSurvey).toHaveBeenCalledTimes(1);
    expect(mockAppServices.submitSurvey).toHaveBeenCalledWith({
      invitationId: 'secreta-123',
      questions: preguntas,
      answers: {
        tonto: 'tonto-1',
        casper: 'casper-1',
        comefeas: 'comefeas-1',
        soltero: 'soltero-1',
        anecdota: 'anecdota-1',
        meme: 'meme-1',
        mensaje: 'mensaje-1',
        foto: 'foto-1',
        video: 'video-1',
        correa: 'correa-1',
      },
    });
  });

  it('envía las diez respuestas y ningún campo de más', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    for (let questionIndex = 0; questionIndex < 10; questionIndex++) {
      await wrapper.findAll('.option-card')[1].trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    const payload = vi.mocked(mockAppServices.submitSurvey).mock.calls[0][0];

    expect(Object.keys(payload).sort())
      .toEqual(['answers', 'invitationId', 'questions']);
    expect(Object.keys(payload.answers)).toHaveLength(10);
    expect(payload.answers).toEqual({
      tonto: 'tonto-2',
      casper: 'casper-2',
      comefeas: 'comefeas-2',
      soltero: 'soltero-2',
      anecdota: 'anecdota-2',
      meme: 'meme-2',
      mensaje: 'mensaje-2',
      foto: 'foto-2',
      video: 'video-2',
      correa: 'correa-2',
    });
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

  it('bloquea envios duplicados mientras se guardan las respuestas', async () => {
    let resolveSave: (() => void) | undefined;
    vi.mocked(mockAppServices.submitSurvey).mockImplementationOnce(
      () => new Promise<SurveySubmission>((resolve) => {
        resolveSave = () => resolve({} as SurveySubmission);
      }),
    );

    const wrapper = mount(App);
    await loginAndStart(wrapper);

    for (let questionIndex = 0; questionIndex < 9; questionIndex++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    await wrapper.find('.option-card').trigger('click');
    const submitButton = wrapper.find('button.button-primary');
    await submitButton.trigger('click');
    await submitButton.trigger('click');

    expect(mockAppServices.submitSurvey).toHaveBeenCalledTimes(1);
    expect(submitButton.attributes('disabled')).toBeDefined();

    resolveSave?.();
    await wrapper.vm.$nextTick();
  });

  it('mantiene las respuestas y permite reintentar si falla el envío', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(mockAppServices.submitSurvey)
      .mockRejectedValueOnce(new Error('temporarily unavailable'))
      .mockResolvedValueOnce({} as SurveySubmission);

    const wrapper = mount(App);
    await loginAndStart(wrapper);

    for (let index = 0; index < 10; index++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    expect(wrapper.find('.status--error').exists()).toBe(true);
    expect(wrapper.find('button.button-primary').text()).toBe('Reintentar envío');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    expect(mockAppServices.submitSurvey).toHaveBeenCalledTimes(2);
    expect(wrapper.find('.status--success').exists()).toBe(true);
    consoleError.mockRestore();
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

describe('App - Visor multimedia de respuestas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('abre y cierra el visor de una imagen mediante pulsacion larga', async () => {
    vi.useFakeTimers();
    const wrapper = mount(App);

    await loginAndStart(wrapper);
    for (let questionIndex = 0; questionIndex < 6; questionIndex++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    const multimediaOption = wrapper.find('.option-card');
    await multimediaOption.trigger('mousedown');
    vi.advanceTimersByTime(300);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.photo-modal').exists()).toBe(true);
    expect(wrapper.find('.photo-modal-image').exists()).toBe(true);

    await wrapper.find('.modal-close-btn').trigger('click');
    expect(wrapper.find('.photo-modal').exists()).toBe(false);
    vi.useRealTimers();
  });

  it('no selecciona la opción al abrir el visor con pulsación larga', async () => {
    vi.useFakeTimers();
    const wrapper = mount(App);

    await loginAndStart(wrapper);
    for (let questionIndex = 0; questionIndex < 6; questionIndex++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    const multimediaOption = wrapper.find('.option-card');
    expect(multimediaOption.classes()).not.toContain('option-card--selected');

    await multimediaOption.trigger('mousedown');
    vi.advanceTimersByTime(300);
    await wrapper.vm.$nextTick();
    await multimediaOption.trigger('mouseup');
    await multimediaOption.trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.photo-modal').exists()).toBe(true);
    expect(wrapper.find('.option-card').classes()).not.toContain('option-card--selected');
    expect(wrapper.find('button.button-primary').attributes('disabled')).toBeDefined();
    vi.useRealTimers();
  });

  it('vuelve a seleccionar con un clic corto tras una pulsación larga', async () => {
    vi.useFakeTimers();
    const wrapper = mount(App);

    await loginAndStart(wrapper);
    for (let questionIndex = 0; questionIndex < 6; questionIndex++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    await wrapper.find('.option-card').trigger('mousedown');
    vi.advanceTimersByTime(300);
    await wrapper.vm.$nextTick();
    await wrapper.find('.option-card').trigger('mouseup');
    await wrapper.find('.modal-close-btn').trigger('click');
    vi.advanceTimersByTime(20);

    await wrapper.findAll('.option-card')[1].trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.option-card')[1].classes()).toContain('option-card--selected');
    vi.useRealTimers();
  });
});

describe('App - métricas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    metrics.reset();
  });

  it('cuenta un inicio por cada paso a las preguntas', async () => {
    const wrapper = mount(App);
    expect(metrics.value('survey_started')).toBe(0);

    await loginAndStart(wrapper);

    expect(metrics.value('survey_started')).toBe(1);
  });

  it('cuenta el acierto, la invitación usada y ningún fallo al enviar bien', async () => {
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    for (let index = 0; index < 10; index++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    expect(metrics.value('submission_succeeded')).toBe(1);
    expect(metrics.value('invitation_used')).toBe(1);
    expect(metrics.value('submission_failed')).toBe(0);
  });

  it('cuenta un fallo por intento y no por reintento acertado', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(mockAppServices.submitSurvey)
      .mockRejectedValueOnce(new Error('temporarily unavailable'))
      .mockResolvedValueOnce({} as SurveySubmission);
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    for (let index = 0; index < 10; index++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }
    expect(metrics.value('submission_failed')).toBe(1);

    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    expect(metrics.value('submission_failed')).toBe(1);
    expect(metrics.value('submission_succeeded')).toBe(1);
    consoleError.mockRestore();
  });

  it('cuenta un fallo de multimedia al abrir un asset no disponible', async () => {
    vi.useFakeTimers();
    // En el entorno de test todos los assets existen, así que se simula la
    // situación de despliegue en la que un archivo falta.
    const opcion = preguntas[6].opciones[0];
    const multimediaOriginal = opcion.multimedia;
    opcion.multimedia = { ...multimediaOriginal!, unavailable: true };

    const wrapper = mount(App);
    await loginAndStart(wrapper);
    for (let questionIndex = 0; questionIndex < 6; questionIndex++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    expect(metrics.value('multimedia_failed')).toBe(0);

    await wrapper.find('.option-card').trigger('mousedown');
    vi.advanceTimersByTime(300);
    await wrapper.vm.$nextTick();

    expect(metrics.value('multimedia_failed')).toBe(1);
    expect(wrapper.find('.photo-modal').exists()).toBe(true);
    opcion.multimedia = multimediaOriginal;
    vi.useRealTimers();
  });

  it('no cuenta fallo de multimedia cuando el asset está disponible', async () => {
    vi.useFakeTimers();
    const wrapper = mount(App);
    await loginAndStart(wrapper);
    for (let questionIndex = 0; questionIndex < 6; questionIndex++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    await wrapper.find('.option-card').trigger('mousedown');
    vi.advanceTimersByTime(300);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.photo-modal').exists()).toBe(true);
    expect(metrics.value('multimedia_failed')).toBe(0);
    vi.useRealTimers();
  });

  it('no cuenta invitaciones usadas cuando el envío falla', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(mockAppServices.submitSurvey).mockRejectedValue(new Error('db down'));
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    for (let index = 0; index < 10; index++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    expect(metrics.value('invitation_used')).toBe(0);
    expect(metrics.value('submission_succeeded')).toBe(0);
    consoleError.mockRestore();
  });
});

describe('App - errores de red', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    metrics.reset();
  });

  async function enviarYLeerError(submitError: unknown): Promise<string> {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(mockAppServices.submitSurvey).mockRejectedValue(submitError);
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    for (let index = 0; index < 10; index++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }
    const mensaje = wrapper.find('.status--error').text();
    consoleError.mockRestore();

    return mensaje;
  }

  it('distingue sin conexión, timeout, permisos y servicio caído en el envío', async () => {
    const sinConexion = await enviarYLeerError(new TypeError('Failed to fetch'));
    const timeout = await enviarYLeerError({ code: 'functions/deadline-exceeded' });
    const permisos = await enviarYLeerError({ code: 'functions/permission-denied' });
    const caido = await enviarYLeerError({ code: 'functions/internal' });

    expect(sinConexion).toMatch(/conexión a internet/i);
    expect(timeout).toMatch(/tardado demasiado/i);
    expect(permisos).toMatch(/permiso/i);
    expect(caido).toMatch(/servicio no está disponible/i);
  });

  it('cae en desconocido cuando no hay pistas', async () => {
    expect(await enviarYLeerError(new Error('raro'))).toMatch(/inesperado/i);
  });

  it('ofrece reintentar en todos los casos de red', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(mockAppServices.submitSurvey).mockRejectedValueOnce({ code: 'functions/unavailable' });
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    for (let index = 0; index < 10; index++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    expect(wrapper.find('button.button-primary').text()).toBe('Reintentar envío');
    consoleError.mockRestore();
  });

  it('usa el mensaje de red también al validar la invitación', async () => {
    vi.mocked(mockAppServices.validateInvitation).mockRejectedValueOnce({
      code: 'functions/unavailable',
    });
    const wrapper = mount(App);
    await wrapper.find('input.field-input').setValue('secreta-123');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.status--error').text()).toMatch(/servicio no está disponible/i);
    expect(wrapper.find('.field-error').exists()).toBe(false);
  });

  it('trata como acierto un envío que el servidor ya tenía guardado', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(mockAppServices.submitSurvey).mockRejectedValueOnce(
      new InvitationAlreadyUsedError(),
    );
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    for (let index = 0; index < 10; index++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    expect(wrapper.find('.status--success').text()).toMatch(/ya estaban guardadas/i);
    expect(wrapper.find('.status--error').exists()).toBe(false);
    expect(metrics.value('submission_succeeded')).toBe(1);
    expect(metrics.value('invitation_used')).toBe(1);
    expect(metrics.value('submission_failed')).toBe(0);
    consoleError.mockRestore();
  });

  it('mantiene el mensaje específico si la invitación ya se usó', async () => {
    vi.mocked(mockAppServices.validateInvitation).mockRejectedValueOnce(
      new InvitationAlreadyUsedError(),
    );
    const wrapper = mount(App);
    await wrapper.find('input.field-input').setValue('secreta-123');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.field-error').text()).toMatch(/Ya has respondido/);
    expect(wrapper.find('.status--error').exists()).toBe(false);
  });
});

describe('App - logging controlado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logger.clear();
    entries.length = 0;
    logger.setSink((entry) => entries.push(entry));
  });

  afterEach(() => {
    logger.setSink(null);
  });

  it('no escribe nada en consola directamente', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(mockAppServices.submitSurvey).mockRejectedValueOnce(new Error('boom'));
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    for (let index = 0; index < 10; index++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    // El sink del logger se ha sustituido, así que nada debe llegar a la consola.
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  it('registra el fallo de envío sin la palabra secreta ni el nombre', async () => {
    vi.mocked(mockAppServices.submitSurvey).mockRejectedValueOnce(
      new Error('fallo incluyendo test-code'),
    );
    const wrapper = mount(App);
    await loginAndStart(wrapper);

    for (let index = 0; index < 10; index++) {
      await wrapper.find('.option-card').trigger('click');
      await wrapper.find('button.button-primary').trigger('click');
      await wrapper.vm.$nextTick();
    }

    const registro = entries.find((entry) => entry.message.includes('enviar la encuesta'));

    expect(registro).toBeDefined();
    expect(registro!.level).toBe('error');
    const serializado = JSON.stringify(registro);
    expect(serializado).not.toContain('test-code');
    expect(serializado).not.toContain('secreta-123');
    expect(serializado).toContain('[redactado]');
  });

  it('registra el fallo de validación sin la palabra secreta', async () => {
    vi.mocked(mockAppServices.validateInvitation).mockRejectedValueOnce(new Error('red interna'));
    const wrapper = mount(App);
    await wrapper.find('input.field-input').setValue('secreta-123');
    await wrapper.find('button.button-primary').trigger('click');
    await wrapper.vm.$nextTick();

    const registro = entries.find((entry) => entry.message.includes('validar la invitación'));

    expect(registro).toBeDefined();
    expect(JSON.stringify(registro)).not.toContain('secreta-123');
  });
});

describe('App - la gala de premios', () => {
  const CONTADORES = { 'tonto-1': 3, 'tonto-2': 1, 'casper-1': 2, 'casper-2': 2 };

  /**
   * La tarta se sustituye por una marca: aquí se prueba el camino desde la
   * palabra hasta la pantalla de resultados, y el dibujo tiene su propio spec.
   */
  const montarApp = () => mount(App, {
    global: { stubs: { PieChartCard: { template: '<div class="chart-stub" />' } } },
  });

  const entrar = async (secreta: string) => {
    const wrapper = montarApp();
    await wrapper.find('input.field-input').setValue(secreta);
    await wrapper.find('button.button-primary').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    return wrapper;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    metrics.reset();
    // `clearAllMocks` no vacía la cola de `...Once`, así que lo que un test
    // deja preparado se lo encontraría el siguiente y mediría otra cosa. Aquí
    // la gala se deja apagada, que es lo mismo que una invitación normal.
    vi.mocked(mockAppServices.getResults).mockReset();
    vi.mocked(mockAppServices.getResults).mockResolvedValue(null);
  });

  it('abre la gala con la palabra de quien organiza, sin pasar por el cuestionario', async () => {
    vi.mocked(mockAppServices.getResults).mockResolvedValue(
      calcularResultadoEncuesta(preguntas, CONTADORES),
    );

    const wrapper = await entrar('admindltv');

    expect(wrapper.find('.hero-title').text()).toBe('Los premios');
    expect(wrapper.findAll('.chart-stub')).toHaveLength(preguntas.length);
    // La palabra es válida, pero quien organiza no vuelve a contestar su propia
    // encuesta: ya está voted por la gala.
    expect(mockAppServices.validateInvitation).not.toHaveBeenCalled();
    expect(mockAppServices.submitSurvey).not.toHaveBeenCalled();
  });

  it('sigue el camino normal del login cuando la palabra no es de quien organiza', async () => {
    // Es el caso de todas las invitaciones: si esto fallara, la fiesta entera
    // se quedaría en la pantalla de login.
    const wrapper = await entrar('admindltv');

    expect(mockAppServices.validateInvitation).toHaveBeenCalledWith('admindltv');
    expect(wrapper.find('.hero-title').text()).not.toBe('Los premios');
    // La pantalla de bienvenida ha sustituido al formulario de la palabra.
    expect(wrapper.find('input.field-input').exists()).toBe(false);
    expect(wrapper.text()).toContain('a salir las preguntas');
  });

  it('pasa la palabra ya recortada a los resultados y a la validación', async () => {
    // Normalizar a minúsculas es cosa de cada caso de uso, que la recibe cruda;
    // aquí solo se recorta para no mandar espacios que no existen en la clave.
    await entrar('  ADMINDLTV  ');

    expect(mockAppServices.getResults).toHaveBeenCalledWith('ADMINDLTV');
    expect(mockAppServices.validateInvitation).toHaveBeenCalledWith('ADMINDLTV');
  });

  it('no deja pasar a la encuesta si los resultados no se pueden leer', async () => {
    // Un fallo de red al leer la gala no puede dejar entrar al cuestionario:
    // quien organiza vería un formulario vacío y creería que su palabra se ha
    // gastado.
    vi.mocked(mockAppServices.getResults).mockRejectedValue(new TypeError('Failed to fetch'));

    const wrapper = await entrar('admindltv');

    expect(mockAppServices.validateInvitation).not.toHaveBeenCalled();
    expect(wrapper.findAll('.chart-stub')).toHaveLength(0);
    expect(wrapper.text()).toContain('conexión');
  });

  it('vuelve a pedir los contadores al recargar', async () => {
    // Quien llega tarde a la fiesta necesita ver los votos que se han añadido
    // desde la última vez que miró.
    vi.mocked(mockAppServices.getResults).mockResolvedValue(
      calcularResultadoEncuesta(preguntas, CONTADORES),
    );

    const wrapper = await entrar('admindltv');
    expect(wrapper.text()).toContain('votos de 4 personas');

    vi.mocked(mockAppServices.getResults).mockResolvedValue(
      calcularResultadoEncuesta(preguntas, { ...CONTADORES, 'tonto-1': 9 }),
    );
    const [recargar] = wrapper.findAll('.footer-actions button');
    await recargar!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(mockAppServices.getResults).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('votos de 10 personas');
  });

  it('avisa si al recargar ya no hay resultados con esa palabra', async () => {
    // El resumen puede desaparecer si el organizador lo limpia entre medias.
    vi.mocked(mockAppServices.getResults).mockResolvedValue(
      calcularResultadoEncuesta(preguntas, CONTADORES),
    );

    const wrapper = await entrar('admindltv');

    vi.mocked(mockAppServices.getResults).mockResolvedValue(null);
    const [recargar] = wrapper.findAll('.footer-actions button');
    await recargar!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.status--error').text()).toContain('Ya no hay resultados');
    // Las tarts de antes siguen en pantalla: es mejor un aviso sobre datos
    // viejos que una pantalla en blanco.
    expect(wrapper.findAll('.chart-stub')).toHaveLength(preguntas.length);
  });

  it('mantiene la gala y su error visible si la recarga falla', async () => {
    vi.mocked(mockAppServices.getResults).mockResolvedValue(
      calcularResultadoEncuesta(preguntas, CONTADORES),
    );

    const wrapper = await entrar('admindltv');

    vi.mocked(mockAppServices.getResults).mockRejectedValue(new TypeError('Failed to fetch'));
    const [recargar] = wrapper.findAll('.footer-actions button');
    await recargar!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.status--error').text()).toContain('conexión');
    expect(wrapper.findAll('.chart-stub')).toHaveLength(preguntas.length);
  });

  it('vuelve al login al salir de la gala, sin validar la palabra otra vez', async () => {
    vi.mocked(mockAppServices.getResults).mockResolvedValue(
      calcularResultadoEncuesta(preguntas, CONTADORES),
    );

    const wrapper = await entrar('admindltv');
    const [, salir] = wrapper.findAll('.footer-actions button');
    await salir!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.hero-title').text()).toContain('Sin Mentirosas');
    expect(wrapper.findAll('.chart-stub')).toHaveLength(0);
  });

  it('cuenta cada vez que se enseñan resultados, recargas incluidas', async () => {
    // Es el número de veces que alguien ha mirado el reparto, no el de sesiones
    // abiertas: recargar la gala para ver los votos que acaban de caer también
    // es mirar el reparto, y para el organizador es justo lo que quiere saber.
    vi.mocked(mockAppServices.getResults).mockResolvedValue(
      calcularResultadoEncuesta(preguntas, CONTADORES),
    );

    const wrapper = await entrar('admindltv');

    expect(metrics.value('results_viewed')).toBe(1);

    const [recargar] = wrapper.findAll('.footer-actions button');
    await recargar!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(metrics.value('results_viewed')).toBe(2);
  });

  it('no cuenta una recarga que falla, porque no se enseñó nada nuevo', async () => {
    vi.mocked(mockAppServices.getResults).mockResolvedValue(
      calcularResultadoEncuesta(preguntas, CONTADORES),
    );

    const wrapper = await entrar('admindltv');

    vi.mocked(mockAppServices.getResults).mockRejectedValue(new TypeError('Failed to fetch'));
    const [recargar] = wrapper.findAll('.footer-actions button');
    await recargar!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(metrics.value('results_viewed')).toBe(1);
  });

  it('no cuenta ninguna vista de la gala en una invitación normal', async () => {
    await entrar('secreta-123');

    expect(metrics.value('results_viewed')).toBe(0);
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