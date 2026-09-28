import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const domainRoot = resolve(__dirname, '../../../src/features/survey/domain');
const applicationRoot = resolve(__dirname, '../../../src/features/survey/application');

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

const domainFiles = listFiles(domainRoot).filter((file) => file.endsWith('.ts'));

describe('aislamiento del dominio', () => {
  it('tiene ficheros que comprobar', () => {
    expect(domainFiles.length).toBeGreaterThan(0);
  });

  it('no importa Vue ni ningun otro framework de presentacion', () => {
    const offenders = domainFiles
      .filter((file) => /from\s+['"]vue['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(domainRoot, 'domain'));

    expect(offenders).toEqual([]);
  });

  it('no importa nada de infrastructure ni de app', () => {
    const offenders = domainFiles
      .filter((file) => /from\s+['"][^'"]*(infrastructure|features\/[^/]+\/app|\/app\/)/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(domainRoot, 'domain'));

    expect(offenders).toEqual([]);
  });

  it('solo usa dependencias externas de tipo y de Firebase-free utilities', () => {
    const offenders = domainFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(/from\s+['"]([^.'"][^'"]*)['"]/g)]
        .map((match) => match[1])
        .filter((specifier) => !specifier.startsWith('node:'))
        .map((specifier) => `${file.replace(domainRoot, 'domain')} -> ${specifier}`);
    });

    expect(offenders).toEqual([]);
  });

  it('mantiene las reglas de validación libres de efectos sobre el catálogo', () => {
    const rules = readFileSync(join(domainRoot, 'survey.rules.ts'), 'utf8');

    expect(rules).not.toMatch(/\bmutate\b|\bpush\s*\(\s*pregunta/);
    expect(rules).toContain('readonly');
  });
});

describe('aislamiento de la lógica de aplicación', () => {
  const wizard = join(applicationRoot, 'surveyWizard.ts');

  it('implementa el wizard sin depender de Vue', () => {
    const source = readFileSync(wizard, 'utf8');

    expect(source).not.toMatch(/from\s+['"]vue['"]/);
    expect(source).not.toMatch(/\b(ref|reactive|computed|watch)\b/);
  });

  it('devuelve un estado nuevo en lugar de mutar el recibido', () => {
    const source = readFileSync(wizard, 'utf8');

    // Toda transición parte de `...state` en lugar de asignar propiedades.
    expect(source).not.toMatch(/state\.[a-zA-Z]+\s*=/);
    expect([...source.matchAll(/\.\.\.state/g)].length).toBeGreaterThanOrEqual(5);
  });
});
