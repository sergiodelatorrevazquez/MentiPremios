import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { preguntas } from '../../src/features/survey/domain/questions';
import { MULTIMEDIA_ASSET_PATHS, multimediaAssetRegistry } from '../../src/features/survey/domain/multimediaRegistry';

const workspaceRoot = resolve(__dirname, '../..');

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

  it('registers all known paths and validates type, alt text, URL and file existence', () => {
    const registeredPaths = Object.keys(multimediaAssetRegistry);
    expect(registeredPaths.sort()).toEqual(Object.values(MULTIMEDIA_ASSET_PATHS).sort());

    for (const option of preguntas.flatMap((question) => question.opciones)) {
      const media = option.multimedia;
      if (!media) continue;

      expect(['imagen', 'video']).toContain(media.tipo);
      expect(media.alt?.trim().length).toBeGreaterThan(0);
      expect(media.src.trim().length).toBeGreaterThan(0);

      const entry = Object.values(multimediaAssetRegistry)
        .find((registryEntry) => registryEntry.assetPath === media.assetPath);
      expect(entry).toBeDefined();

      if (media.unavailable) {
        expect(existsSync(resolve(workspaceRoot, media.assetPath ?? ''))).toBe(true);
        expect(media.src).toBe('/media-unavailable.svg');
      } else {
        expect(media.assetPath).toMatch(/^src\/assets\//);
        expect(existsSync(resolve(workspaceRoot, media.assetPath ?? ''))).toBe(true);
        expect(media.src).toMatch(/^\/(src\/assets\/.+\.(jpg|mp4)|assets\/.+\.[a-f0-9]+\.(jpg|mp4))$/);
        expect(media.assetPath)
          .toMatch(media.tipo === 'imagen' ? /\.(jpg|png|webp)$/ : /\.(mp4|webm|mov)$/);
      }
    }
  });

  it('keeps avatar imagery out of the survey response catalog', () => {
    const catalogPaths = preguntas.flatMap((question) => question.opciones)
      .flatMap((option) => option.multimedia?.assetPath ?? []);
    expect(catalogPaths).not.toContain('src/assets/foto-amigos.jpg');
  });
});