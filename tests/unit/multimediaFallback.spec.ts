import { describe, expect, it } from 'vitest';
import { preguntas } from '../../src/features/survey/domain/questions';

describe('multimedia asset fallback', () => {
  it('uses the controlled placeholder for assets missing from the catalog', () => {
    const missingOptions = preguntas
      .flatMap((question) => question.opciones)
      .filter((option) => option.multimedia?.unavailable);

    expect(missingOptions).toHaveLength(11);
    expect(missingOptions.every((option) => (
      option.multimedia?.src === '/media-unavailable.svg'
      && option.multimedia.alt?.includes('recurso no disponible')
    ))).toBe(true);
  });

  it('never exposes multimedia options with an undefined source', () => {
    const mediaOptions = preguntas.flatMap((question) => question.opciones)
      .filter((option) => option.multimedia);

    expect(mediaOptions.every((option) => typeof option.multimedia?.src === 'string')).toBe(true);
  });
});