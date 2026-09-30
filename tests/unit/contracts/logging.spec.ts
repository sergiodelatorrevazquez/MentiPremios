import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(__dirname, '../../..');
const srcRoot = join(repositoryRoot, 'src');
const loggerPath = join(srcRoot, 'infrastructure/logging/logger.ts');

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    return entry.isDirectory()
      ? listFiles(path)
      : [path];
  });
}

const sourceFiles = listFiles(srcRoot).filter((file) => /\.(ts|vue)$/.test(file));

function usesConsole(file: string): boolean {
  return /(?<![\w.])console\s*\./.test(readFileSync(file, 'utf8'));
}

describe('logging controlado', () => {
  it('ningún módulo de la aplicación escribe en consola directamente', () => {
    const offenders = sourceFiles
      .filter((file) => file !== loggerPath)
      .filter(usesConsole)
      .map((file) => relative(repositoryRoot, file));

    expect(offenders).toEqual([]);
  });

  it('solo el logger conoce la consola', () => {
    expect(usesConsole(loggerPath)).toBe(true);
  });

  it('el logger redacta antes de emitir, no después', () => {
    const source = readFileSync(loggerPath, 'utf8');

    // La redacción ocurre en el punto de construcción de la entrada, de modo
    // que ningún destino, nuevo o antiguo, puede recibir el dato en claro.
    expect(source).toContain('redactContext(context, { secrets: secretList })');
    expect(source).not.toMatch(/sink\(\{[^}]*context: context\b/);
  });

  it('el logger es silencioso por debajo de error en producción', () => {
    const source = readFileSync(loggerPath, 'utf8');

    expect(source).toContain('minimumLevel: minimumLevelFor(import.meta.env.PROD)');
  });

  });
