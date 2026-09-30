import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = resolve(__dirname, '../../../src');
const featuresRoot = join(srcRoot, 'features');
const appRoot = join(srcRoot, 'app');
const infrastructureRoot = join(srcRoot, 'infrastructure');

/**
 * Una capa puede vivir en varias features. `results` es una feature entera —
 * dominio, aplicación y presentación—, así que cada capa se comprueba en todas
 * las que la tienen: si solo se mirara `survey`, la mitad del proyecto se
 * escapingaría de estos contratos sin que nadie se entere.
 */
const LAYERS = {
  domain: [
    join(featuresRoot, 'survey', 'domain'),
    join(featuresRoot, 'results', 'domain'),
  ],
  application: [
    join(featuresRoot, 'survey', 'application'),
    join(featuresRoot, 'results', 'application'),
  ],
  presentation: [
    join(featuresRoot, 'survey', 'presentation'),
    join(featuresRoot, 'results', 'presentation'),
  ],
  infrastructure: [infrastructureRoot],
  app: [appRoot],
} as const;

/** `keywords` es una feature opcional con su propio `domain/`. */
const domainRoots = [
  ...LAYERS.domain,
  join(featuresRoot, 'keywords', 'domain'),
];

type Layer = keyof typeof LAYERS;

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

const filesByLayer = new Map<Layer, string[]>(
  (Object.keys(LAYERS) as Layer[]).map((layer) => [
    layer,
    LAYERS[layer].flatMap((root) => listFiles(root)).filter((file) => /\.(ts|vue)$/.test(file)),
  ]),
);

const IMPORT_PATTERN = /(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

interface Dependency {
  from: string;
  specifier: string;
  /** Ruta absoluta si la importación es relativa, si no el nombre del paquete. */
  target: string;
}

function dependenciesOf(file: string): Dependency[] {
  const source = readFileSync(file, 'utf8');
  const found: Dependency[] = [];

  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2];
    if (!specifier) continue;
    found.push({
      from: relative(srcRoot, file),
      specifier,
      target: specifier.startsWith('.') ? resolve(file, '..', specifier) : specifier,
    });
  }

  return found;
}

function describeDependency(dependency: Dependency): string {
  return `${dependency.from} -> ${dependency.specifier}`;
}

function inside(target: string, layer: Layer): boolean {
  return LAYERS[layer].some((root) => target === root || target.startsWith(`${root}/`));
}

function insideAnyDomain(target: string): boolean {
  return domainRoots.some((root) => target === root || target.startsWith(`${root}/`));
}

function anyLayer(target: string): Layer | undefined {
  return (Object.keys(LAYERS) as Layer[]).find((layer) => inside(target, layer));
}

function isFirebaseSdk(target: string): boolean {
  return target === 'firebase' || target.startsWith('firebase/');
}

function isVuePackage(target: string): boolean {
  return target === 'vue' || target.startsWith('vue/') || target.startsWith('@vue/');
}

function offenders(layer: Layer, isForbidden: (target: string) => boolean): string[] {
  return filesByLayer
    .get(layer)!
    .flatMap(dependenciesOf)
    .filter((dependency) => isForbidden(dependency.target))
    .map(describeDependency)
    .sort();
}

/** Los paquetes de `node:` son la única dependencia externa de las capas puras. */
function isExternalPackage(dependency: Dependency): boolean {
  return !dependency.specifier.startsWith('.') && !dependency.specifier.startsWith('node:');
}

describe('reglas de dependencia entre capas', () => {
  it('cubre todas las capas con ficheros que comprobar', () => {
    for (const [layer, files] of filesByLayer) {
      expect(files.length, `sin ficheros en ${layer}`).toBeGreaterThan(0);
    }
  });

  it('cada capa vive en el sitio que dice la arquitectura', () => {
    expect(LAYERS.domain).toContain(join(srcRoot, 'features/survey/domain'));
    expect(LAYERS.domain).toContain(join(srcRoot, 'features/results/domain'));
    expect(LAYERS.presentation).toContain(join(srcRoot, 'features/survey/presentation'));
    expect(LAYERS.presentation).toContain(join(srcRoot, 'features/results/presentation'));
  });

  describe('1. domain no importa Vue ni Firebase', () => {
    it('no importa Vue', () => {
      expect(offenders('domain', isVuePackage)).toEqual([]);
    });

    it('no importa el SDK de Firebase', () => {
      expect(offenders('domain', isFirebaseSdk)).toEqual([]);
    });

    it('no sale de ningún dominio: nada de app, infrastructure ni presentation', () => {
      expect(offenders('domain', (target) => {
        const layer = anyLayer(target);

        return layer !== undefined && layer !== 'domain';
      })).toEqual([]);
    });

    it('no depende de ningún paquete que no sea node:', () => {
      const offenders = filesByLayer
        .get('domain')!
        .flatMap(dependenciesOf)
        .filter(isExternalPackage)
        .map(describeDependency)
        .sort();

      expect(offenders).toEqual([]);
    });
  });

  describe('2. application no importa componentes', () => {
    it('no importa nada de presentation', () => {
      expect(offenders('application', (target) => inside(target, 'presentation'))).toEqual([]);
    });

    it('no importa SFC', () => {
      expect(offenders('application', (target) => target.endsWith('.vue'))).toEqual([]);
    });

    it('no importa app ni infrastructure', () => {
      expect(offenders('application', (target) => inside(target, 'app') || inside(target, 'infrastructure')))
        .toEqual([]);
    });
  });

  describe('3. presentation no accede directamente a Firestore', () => {
    it('no importa el SDK de Firebase', () => {
      expect(offenders('presentation', isFirebaseSdk)).toEqual([]);
    });

    it('no importa infrastructure', () => {
      expect(offenders('presentation', (target) => inside(target, 'infrastructure'))).toEqual([]);
    });

    it('no importa app', () => {
      expect(offenders('presentation', (target) => inside(target, 'app'))).toEqual([]);
    });
  });

  describe('4. infrastructure no contiene reglas de interfaz', () => {
    it('no importa Vue', () => {
      expect(offenders('infrastructure', isVuePackage)).toEqual([]);
    });

    it('no importa SFC ni presentation', () => {
      expect(offenders('infrastructure', (target) => target.endsWith('.vue') || inside(target, 'presentation')))
        .toEqual([]);
    });

    it('no importa app', () => {
      expect(offenders('infrastructure', (target) => inside(target, 'app'))).toEqual([]);
    });

    it('no decide nada de interfaz: sin clases CSS ni selectores', () => {
      const offenders = filesByLayer
        .get('infrastructure')!
        .filter((file) => /\.(ts|vue)$/.test(file))
        .filter((file) => /\.[a-z-]+\s*\{|class=|<template>/.test(readFileSync(file, 'utf8')))
        .map((file) => relative(srcRoot, file))
        .sort();

      expect(offenders).toEqual([]);
    });
  });

  describe('excepciones declaradas', () => {
    it('el composition root puede conocer el SDK de Firebase', () => {
      const firebaseImports = filesByLayer
        .get('app')!
        .flatMap(dependenciesOf)
        .filter((dependency) => isFirebaseSdk(dependency.target));

      expect(firebaseImports.length).toBeGreaterThan(0);
    });

    it('la capa application puede usar Vue solo en el adaptador del wizard', () => {
      const usesVue = filesByLayer
        .get('application')!
        .flatMap(dependenciesOf)
        .filter((dependency) => isVuePackage(dependency.target))
        .map((dependency) => dependency.from);

      expect([...new Set(usesVue)]).toEqual(['features/survey/application/useSurveyWizard.ts']);
    });
  });

  describe('lo que sí está permitido', () => {
    it('presentation puede leer los tipos del dominio', () => {
      const readsDomain = filesByLayer
        .get('presentation')!
        .flatMap(dependenciesOf)
        .filter((dependency) => insideAnyDomain(dependency.target));

      expect(readsDomain.length).toBeGreaterThan(0);
    });

    it('infrastructure puede implementar los tipos del dominio', () => {
      const readsDomain = filesByLayer
        .get('infrastructure')!
        .flatMap(dependenciesOf)
        .filter((dependency) => insideAnyDomain(dependency.target));

      expect(readsDomain.length).toBeGreaterThan(0);
    });
  });
});
