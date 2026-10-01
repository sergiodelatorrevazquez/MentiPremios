import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { preguntas } from '../../../src/features/survey/domain/questions';
import { calcularResultadoEncuesta } from '../../../src/features/results/domain/results.rules';
import type { ResumenVotos, ResultadoEncuesta } from '../../../src/features/results/domain/results.types';
import ResultsStep from '../../../src/features/results/presentation/ResultsStep.vue';

/**
 * Las tarjetas se sustituyen por una marca: aquí se prueba la pantalla, no el
 * dibujo de la tarta, que ya tiene su propio spec.
 */
const PieChartCardStub = {
  name: 'PieChartCard',
  props: ['resultado'],
  template: '<div class="chart-stub" :data-pregunta="resultado.pregunta.id" />',
};

function gala(resumen: ResumenVotos): ResultadoEncuesta {
  return calcularResultadoEncuesta(preguntas, resumen);
}

function montar(resumen: ResumenVotos, props: Partial<{ error: string | null; isLoading: boolean }> = {}) {
  return mount(ResultsStep, {
    props: { resultado: gala(resumen), error: null, isLoading: false, ...props },
    global: { stubs: { PieChartCard: PieChartCardStub } },
  });
}

describe('la pantalla de la gala', () => {
  it('dibuja una tarta por cada pregunta del catálogo', () => {
    const wrapper = montar({ 'tonto-1': 2, 'tonto-2': 1 });

    expect(wrapper.findAll('.chart-stub')).toHaveLength(preguntas.length);
  });

  it('dice cuántas personas han votado, en singular y en plural', () => {
    expect(montar({ 'tonto-1': 1 }).text()).toContain('los votos de 1 persona.');
    expect(montar({ 'tonto-1': 7 }).text()).toContain('los votos de 7 personas.');
  });

  it('avisa de los empates y nombra los premios implicadas', () => {
    // Un empate callado es lo peor: quien mira la pantalla cree que hay un
    // ganador único y arranca una discusión que el resultado no respalda.
    const resumen: ResumenVotos = { 'tonto-1': 2, 'tonto-2': 2, 'casper-1': 5, 'casper-2': 1 };
    const texto = montar(resumen).find('.status--success').text();

    expect(texto).toContain('Hay empate en 1 premio');
    expect(texto).toContain(preguntas[0]!.titulo);
  });

  it('no avisa de empates cuando cada premio tiene un ganador claro', () => {
    const wrapper = montar({ 'tonto-1': 5, 'tonto-2': 1 });

    expect(wrapper.find('.status--success').exists()).toBe(false);
  });

  it('usa el plural cuando hay más de un premio empatado', () => {
    const resumen: ResumenVotos = { 'tonto-1': 2, 'tonto-2': 2, 'casper-1': 3, 'casper-2': 3 };

    expect(montar(resumen).find('.status--success').text()).toContain('Hay empate en 2 premios');
  });
});

describe('fallos y recargas', () => {
  it('muestra el error sin quitar las tarts ya pintadas', () => {
    // Si al recargar falla, quitar los gráficos dejaría al organizador con una
    // pantalla en blanco justo cuando más información necesita.
    const wrapper = montar({ 'tonto-1': 2 }, { error: 'Sin conexión. Inténtalo de nuevo.' });

    expect(wrapper.find('.status--error').text()).toBe('Sin conexión. Inténtalo de nuevo.');
    expect(wrapper.findAll('.chart-stub')).toHaveLength(preguntas.length);
  });

  it('no muestra aviso de error cuando no lo hay', () => {
    expect(montar({ 'tonto-1': 2 }).find('.status--error').exists()).toBe(false);
  });

  it('bloquea los botones mientras se está releyendo', () => {
    const wrapper = montar({ 'tonto-1': 2 }, { isLoading: true });
    const botones = wrapper.findAll('.footer-actions button');

    expect(botones).toHaveLength(2);
    expect(botones.every((boton) => boton.attributes('disabled') !== undefined)).toBe(true);
    expect(wrapper.find('.charts-grid').attributes('aria-busy')).toBe('true');
  });

  it('pide recargar y salir de la gala', () => {
    const wrapper = montar({ 'tonto-1': 2 });
    const [recargar, salir] = wrapper.findAll('.footer-actions button');

    recargar!.trigger('click');
    salir!.trigger('click');

    expect(wrapper.emitted('reload')).toHaveLength(1);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
