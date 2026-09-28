import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const domainRoot = resolve(__dirname, '../../../src/features/survey/domain');
const applicationRoot = resolve(__dirname, '../../../src/features/survey/application');

/*
 * Las reglas de importación entre capas viven en
 * `tests/unit/contracts/dependencyRules.spec.ts`, para que el sitio donde se
 * declaran sea el mismo donde se comprueban. Aquí solo queda lo que no es una
 * regla de dependencias: que la lógica del wizard siga siendo pura y que las
 * reglas de validación no muten el catálogo.
 */

describe('pureza de la lógica de aplicación', () => {
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

describe('inmutabilidad del catálogo', () => {
  it('mantiene las reglas de validación libres de efectos sobre el catálogo', () => {
    const rules = readFileSync(join(domainRoot, 'survey.rules.ts'), 'utf8');

    expect(rules).not.toMatch(/\bmutate\b|\bpush\s*\(\s*pregunta/);
    expect(rules).toContain('readonly');
  });
});
