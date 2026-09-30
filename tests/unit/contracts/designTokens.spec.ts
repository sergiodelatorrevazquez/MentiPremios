import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { preguntas } from '../../../src/features/survey/domain/questions';

const globalStyles = readFileSync(resolve(__dirname, '../../../src/style.css'), 'utf8');

describe('global design tokens', () => {
  it('defines color, typography, spacing, radius, shadow, focus and breakpoint tokens centrally', () => {
    const requiredTokens = [
      '--color-primary',
      '--color-text',
      '--font-family-base',
      '--font-size-display',
      '--line-height-base',
      '--space-1',
      '--space-7',
      '--radius-sm',
      '--radius-lg',
      '--shadow-sm',
      '--shadow-lg',
      '--focus-ring',
      '--breakpoint-mobile',
    ];

    for (const token of requiredTokens) {
      expect(globalStyles).toContain(`${token}:`);
    }
  });

  it('defines a visible keyboard focus treatment', () => {
    expect(globalStyles).toMatch(/:focus-visible\s*\{/);
    expect(globalStyles).toContain('outline: 3px solid var(--color-focus)');
  });

  it('defines enough chart colors for the widest question in the catalog', () => {
    // La paleta se lee del CSS, no del código, así que cambiar un color es
    // tocar un token. La pregunta que manda es la que más opciones tiene, no la
    // primera: si el catálogo tuviera una pregunta con más opciones que colores,
    // unas porciones se pintarían del mismo color y no se podrían distinguir.
    const opciones = Math.max(...preguntas.map((pregunta) => pregunta.opciones.length));

    for (let indice = 1; indice <= opciones; indice += 1) {
      expect(globalStyles).toContain(`--chart-color-${indice}:`);
    }
  });

  it('never reuses a chart color, so two slices never look the same', () => {
    const declarados = [...globalStyles.matchAll(/--chart-color-\d+:\s*(#[0-9a-f]{3,8})/gi)]
      .map(([, color]) => color.toLowerCase());

    expect(declarados.length).toBeGreaterThan(1);
    expect(new Set(declarados).size).toBe(declarados.length);
  });
});