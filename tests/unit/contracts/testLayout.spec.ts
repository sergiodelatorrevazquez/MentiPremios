import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(__dirname, '../../..');
const testsRoot = join(repositoryRoot, 'tests');

const UNIT_LAYERS = [
  'application',
  'components',
  'contracts',
  'domain',
  'infrastructure',
] as const;

const LEVELS = ['e2e', 'integration', 'unit'] as const;

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function specFiles(): string[] {
  return listFiles(testsRoot).filter((file) => file.endsWith('.spec.ts'));
}

function directoriesInside(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

describe('test layout', () => {
  it('exposes exactly the three levels as directories of tests/', () => {
    expect(directoriesInside(testsRoot)).toEqual([...LEVELS]);
  });

  it('organises unit specs into the hexagonal layers', () => {
    expect(directoriesInside(join(testsRoot, 'unit'))).toEqual([...UNIT_LAYERS]);
  });

  it('gives every spec a level and, when unit, a layer', () => {
    const misplaced = specFiles().filter((file) => {
      const segments = relative(testsRoot, file).split(/[\\/]/);
      const [level, ...rest] = segments;

      if (!LEVELS.includes(level as (typeof LEVELS)[number])) return true;
      if (level === 'unit') {
        return !UNIT_LAYERS.includes(rest[0] as (typeof UNIT_LAYERS)[number]);
      }
      return false;
    });

    expect(misplaced).toEqual([]);
  });

  it('keeps the unit root free of loose files', () => {
    const unitRoot = join(testsRoot, 'unit');
    const looseFiles = readdirSync(unitRoot).filter((name) => statSync(join(unitRoot, name)).isFile());

    expect(looseFiles).toEqual([]);
  });

  it('keeps playwright specs out of the vitest include', () => {
    const config = readFileSync(join(repositoryRoot, 'vite.config.ts'), 'utf8');
    const include = /include:\s*\[([^\]]*)\]/.exec(config)?.[1] ?? '';

    expect(include).toContain('tests/unit/**/*.spec.ts');
    expect(include).toContain('tests/integration/**/*.spec.ts');
    expect(include).not.toContain('e2e');
  });
});
