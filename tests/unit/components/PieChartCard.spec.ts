import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { preguntas } from '../../../src/features/survey/domain/questions';
import { calcularResultadoPregunta } from '../../../src/features/results/domain/results.rules';
import type { ResultadoPregunta } from '../../../src/features/results/domain/results.types';

interface Instancia {
  configuracion: { data: { datasets: { data: number[]; backgroundColor: string[] }[] } };
  destroyed: boolean;
}

/**
 * Chart.js necesita un contexto de canvas de verdad, y en `happy-dom` no lo hay.
 * Se sustituye por un doble que guarda la configuración: lo que interesa
 * comprobar no son los píxeles, sino los datos que se le pasan al gráfico y que
 * se destruya al desmontar.
 */
const { instancias } = vi.hoisted(() => ({ instancias: [] as Instancia[] }));

vi.mock('chart.js', () => {
  class Chart {
    static register() {}

    configuracion: Instancia['configuracion'];
    /** El mismo objeto que en Chart.js: al recargar, se muta este, no el original. */
    data: Instancia['configuracion']['data'];
    destroyed = false;

    constructor(_lienzo: unknown, configuracion: Instancia['configuracion']) {
      this.configuracion = configuracion;
      this.data = configuracion.data;
      instancias.push(this);
    }

    update() {}
    destroy() {
      this.destroyed = true;
    }
  }

  return {
    Chart,
    DoughnutController: { id: 'doughnut' },
    ArcElement: { id: 'arc' },
  };
});

const { default: PieChartCard } = await import('../../../src/features/results/presentation/PieChartCard.vue');

const [primeraPregunta] = preguntas;
const OPCIONES = primeraPregunta!.opciones.length;
const conVotos = (votos: Record<string, number>): ResultadoPregunta =>
  calcularResultadoPregunta(primeraPregunta!, { ...votos });

const datosDeLaTarta = () => instancias[0]?.configuracion.data.datasets[0]?.data;
const coloresDeLaTarta = () => instancias[0]?.configuracion.data.datasets[0]?.backgroundColor;
/** `[3, 1, ...resto]`: los votos de las opciones que nadie eligió, a cero. */
const votosDeTarta = (...votos: number[]) => [...votos, ...Array(OPCIONES - votos.length).fill(0)];

beforeEach(() => {
  instancias.length = 0;
});

describe('tarjeta de un premio', () => {
  it('pinta una tarta con una opción por cada voto guardado', async () => {
    mount(PieChartCard, { props: { resultado: conVotos({ 'tonto-1': 3, 'tonto-2': 1 }) } });
    await flushPromises();

    expect(datosDeLaTarta()).toEqual(votosDeTarta(3, 1));
  });

  it('da un color distinto a cada opción de la tarta', async () => {
    // Con colores repetidos no se podría distinguir una porción de otra.
    mount(PieChartCard, { props: { resultado: conVotos({ 'tonto-1': 3, 'tonto-2': 1 }) } });
    await flushPromises();

    const colores = coloresDeLaTarta() ?? [];

    expect(colores).toHaveLength(OPCIONES);
    expect(new Set(colores).size).toBe(colores.length);
  });

  it('enseña el título de la pregunta y cuántos votos lleva', () => {
    const wrapper = mount(PieChartCard, { props: { resultado: conVotos({ 'tonto-1': 2 }) } });

    expect(wrapper.find('.chart-title').text()).toBe(primeraPregunta!.titulo);
    expect(wrapper.find('.chart-total').text()).toBe('2 votos');
  });

  it('usa el singular con un solo voto', () => {
    const wrapper = mount(PieChartCard, { props: { resultado: conVotos({ 'tonto-1': 1 }) } });

    expect(wrapper.find('.chart-total').text()).toBe('1 voto');
  });

  it('lista cada opción del catálogo con su porcentaje', () => {
    // También las que no han recibido votos: la tarta debe enseñar el
    // catálogo entero, no solo lo que alguien eligió.

    const wrapper = mount(PieChartCard, { props: { resultado: conVotos({ 'tonto-1': 3, 'tonto-2': 1 }) } });
    const items = wrapper.findAll('.legend-item');

    expect(items).toHaveLength(primeraPregunta!.opciones.length);
    expect(items.map((item) => item.find('.legend-text').text())).toEqual(
      primeraPregunta!.opciones.map((opcion) => opcion.texto),
    );
    expect(items.map((item) => item.find('.legend-value').text())).toEqual(
      ['75%', '25%', ...Array(OPCIONES - 2).fill('0%')],
    );
  });

  it('marca a la ganadora y solo a la ganadora', () => {
    const wrapper = mount(PieChartCard, { props: { resultado: conVotos({ 'tonto-2': 5 }) } });
    const premiadas = wrapper.findAll('.legend-badge');

    expect(premiadas).toHaveLength(1);
    expect(premiadas[0]?.text()).toBe('Ganador');
    expect(wrapper.findAll('.legend-item--winner')).toHaveLength(1);
  });

  it('escribe "Empate" en todas las premiadas cuando hay empate', () => {
    // Si solo se marcara la primera, en pantalla parecería que hay una única
    // ganadora cuando en realidad hay dos.
    const wrapper = mount(PieChartCard, { props: { resultado: conVotos({ 'tonto-1': 2, 'tonto-2': 2 }) } });
    const premiadas = wrapper.findAll('.legend-badge');

    expect(premiadas).toHaveLength(2);
    expect(premiadas.map((item) => item.text())).toEqual(['Empate', 'Empate']);
  });

  it('no marca ninguna ganadora cuando no hay votos', () => {
    const wrapper = mount(PieChartCard, { props: { resultado: conVotos({}) } });

    expect(wrapper.findAll('.legend-badge')).toHaveLength(0);
    expect(wrapper.find('.chart-total').text()).toBe('0 votos');
  });
});

describe('lectura de la tarta sin ver el color', () => {
  it('describe el reparto y la ganadora en el aria-label', () => {
    const resultado = conVotos({ 'tonto-1': 3, 'tonto-2': 1 });
    const wrapper = mount(PieChartCard, { props: { resultado } });
    const etiqueta = wrapper.find('.chart-canvas').attributes('aria-label');

    expect(etiqueta).toContain('75 por ciento');
    expect(etiqueta).toContain('25 por ciento');
    expect(etiqueta).toContain(resultado.ganadora!.texto);
    expect(etiqueta).toContain('gana');
  });

  it('avisa del empate en la descripción', () => {
    const wrapper = mount(PieChartCard, { props: { resultado: conVotos({ 'tonto-1': 2, 'tonto-2': 2 }) } });

    expect(wrapper.find('.chart-canvas').attributes('aria-label')).toContain('empate');
  });

  it('avisa de que la pregunta está vacía cuando todavía no hay votos', () => {
    // Con una pregunta vacía la descripción corta no puede prometer una
    // ganadora, así que lo dice con otras palabras: "todavía no hay votos".
    const wrapper = mount(PieChartCard, { props: { resultado: conVotos({}) } });

    expect(wrapper.find('.chart-canvas').attributes('aria-label'))
      .toContain('todavía no hay votos');
  });
});

describe('carga de la librería de gráficos', () => {
  it('no pinta nada hasta que el módulo ha llegado', async () => {
    // Chart.js entra en el bundle aparte y a propósito: quien está
    // contestando la encuesta no lo descarga. Al abrir la gala sí se pinta, y
    // esa espera es la de una descarga, no la de un fallo.
    mount(PieChartCard, { props: { resultado: conVotos({ 'tonto-1': 2 }) } });

    expect(instancias).toHaveLength(0);

    await flushPromises();

    expect(instancias).toHaveLength(1);
  });

  it('no dibuja sobre un canvas que ya no está', async () => {
    // La tarjeta puede desmontarse mientras baja el paquete. Pintar después
    // dejaría un gráfico huérfano animándose sobre un canvas que ya no existe.
    const wrapper = mount(PieChartCard, { props: { resultado: conVotos({ 'tonto-1': 2 }) } });

    wrapper.unmount();
    await flushPromises();

    expect(instancias).toHaveLength(0);
  });
});

describe('ciclo de vida del gráfico', () => {
  it('destruye el gráfico al desmontar la tarjeta', async () => {
    // Sin destruirlo, cada recarga de la gala dejaría un canvas vivo con su
    // animación pidiendo cuadros al navegador, y acabaría ralentizándolo.
    const wrapper = mount(PieChartCard, { props: { resultado: conVotos({ 'tonto-1': 1 }) } });
    await flushPromises();

    expect(instancias).toHaveLength(1);
    expect(instancias[0]?.destroyed).toBe(false);

    wrapper.unmount();
    await wrapper.vm.$nextTick();

    expect(instancias[0]?.destroyed).toBe(true);
  });

  it('no crea un segundo gráfico cuando llegan votos nuevos', async () => {
    // Un `new Chart` por recarga dibujaría dos veces sobre el mismo canvas.
    const wrapper = mount(PieChartCard, { props: { resultado: conVotos({ 'tonto-1': 1 }) } });
    await flushPromises();

    await wrapper.setProps({ resultado: conVotos({ 'tonto-1': 4, 'tonto-2': 2 }) });

    expect(instancias).toHaveLength(1);
    expect(datosDeLaTarta()).toEqual(votosDeTarta(4, 2));
  });

  it('dibuja aunque el resultado venga sin votos', async () => {
    // El componente no puede fiarse de que la gala siempre llega con contadores.
    mount(PieChartCard, { props: { resultado: conVotos({}) } });
    await flushPromises();

    expect(instancias).toHaveLength(1);
  });
});
