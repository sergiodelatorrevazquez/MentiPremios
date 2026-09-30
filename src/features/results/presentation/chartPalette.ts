/**
 * Paleta de las gráficas de tarta.
 *
 * Los colores son tokens de `style.css` y se leen del DOM en vez de estar
 * escritos aquí, para que el sitio tenga un solo sitio donde se cambian. Si el
 * DOM no está disponible —un test, un entorno sin estilos— se usa la lista de
 * abajo, que es la misma paleta en su valor por defecto.
 */
export const CHART_COLOR_TOKENS = [
  '--chart-color-1',
  '--chart-color-2',
  '--chart-color-3',
  '--chart-color-4',
  '--chart-color-5',
  '--chart-color-6',
  '--chart-color-7',
  '--chart-color-8',
] as const;

export const FALLBACK_CHART_COLORS = [
  '#1b7f3b',
  '#2f6fd0',
  '#d9822b',
  '#8e4ec6',
  '#c2185b',
  '#0f8a8a',
  '#7a5c00',
  '#5d6d7a',
];

/**
 * Un color por opción, en el orden en que aparecen en el catálogo.
 *
 * Se recyclean cuando una pregunta tiene más opciones que colores: la última
 * tarta solo tiene ocho y el catálogo más largo tiene ocho, pero el recycleo
 * evita que una opción nueva se quede sin color si mañana se añade una novena.
 */
export function chartColors(cantidad: number): string[] {
  const paleta = resolvePalette();

  if (cantidad <= paleta.length) return paleta.slice(0, Math.max(cantidad, 0));

  return Array.from(
    { length: cantidad },
    (_, indice) => paleta[indice % paleta.length] ?? FALLBACK_CHART_COLORS[0],
  );
}

function resolvePalette(): string[] {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') {
    return FALLBACK_CHART_COLORS;
  }

  const estilos = getComputedStyle(document.documentElement);
  const leidos = CHART_COLOR_TOKENS
    .map((token) => estilos.getPropertyValue(token).trim())
    .filter((color) => color.length > 0);

  return leidos.length > 0 ? leidos : FALLBACK_CHART_COLORS;
}