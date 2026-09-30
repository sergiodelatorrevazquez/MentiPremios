import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CompletionStep from '../../../src/features/survey/presentation/CompletionStep.vue';
import QuestionStep from '../../../src/features/survey/presentation/QuestionStep.vue';
import { preguntas } from '../../../src/features/survey/domain/questions';

const workspaceRoot = resolve(__dirname, '../../../');
const sourceRoot = resolve(workspaceRoot, 'src');
const globalStyles = readFileSync(resolve(sourceRoot, 'style.css'), 'utf8');
const indexHtml = readFileSync(resolve(workspaceRoot, 'index.html'), 'utf8');

const RESPONSIVE_COMPONENTS = [
  'LoginStep.vue',
  'WelcomeStep.vue',
  'QuestionStep.vue',
  'CompletionStep.vue',
  'MultimediaViewer.vue',
  'AvatarPhotoViewer.vue',
] as const;

const MODAL_COMPONENTS = ['MultimediaViewer.vue', 'AvatarPhotoViewer.vue'] as const;

const WRAPPABLE_TEXT = ['.hero-title', '.status', '.option-text'];
const MIN_TOUCH_TARGET_PX = 44;
const MIN_VIEWPORT_PX = 320;
const CLOSE_BUTTON_MIN_MARGIN_PX = 8;

interface CssRule {
  selector: string;
  media: string | null;
  declarations: string;
}

function parseRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const frames: ('at-rule' | 'rule')[] = [];
  const atRules: string[] = [];
  let pending: CssRule | null = null;
  let buffer = '';

  for (const char of css) {
    if (char === '{') {
      const prelude = buffer.trim();
      buffer = '';
      if (prelude.startsWith('@media')) {
        frames.push('at-rule');
        atRules.push(prelude);
        pending = null;
      } else {
        frames.push('rule');
        pending = { selector: prelude, media: atRules.at(-1) ?? null, declarations: '' };
        rules.push(pending);
      }
    } else if (char === '}') {
      if (pending) pending.declarations = buffer;
      pending = null;
      buffer = '';
      if (frames.pop() === 'at-rule') atRules.pop();
    } else {
      buffer += char;
    }
  }

  return rules;
}

function listVueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listVueFiles(path);
    return entry.isFile() && entry.name.endsWith('.vue') ? [path] : [];
  });
}

function componentStyles(name: string): string {
  const source = readFileSync(resolve(sourceRoot, 'features/survey/presentation', name), 'utf8');
  return source.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? '';
}

const stylesheets: Record<string, string> = {
  'src/style.css': globalStyles,
  ...Object.fromEntries(RESPONSIVE_COMPONENTS.map((name) => [name, componentStyles(name)])),
};

const modalStylesheets: Record<string, string> = {
  'src/style.css': globalStyles,
  ...Object.fromEntries(MODAL_COMPONENTS.map((name) => [name, componentStyles(name)])),
};

function rulesFor(css: string, selector: string): CssRule[] {
  return parseRules(css).filter((rule) =>
    rule.selector.split(',').some((part) => part.trim() === selector),
  );
}

function effectiveValue(
  css: string,
  selector: string,
  property: string,
  scope: 'base' | 'mobile' = 'base',
): string | undefined {
  const declarations = rulesFor(css, selector)
    .filter((rule) => (scope === 'base' ? rule.media === null : rule.media !== null))
    .map((rule) => rule.declarations.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'm'))?.[1])
    .filter((value): value is string => value !== undefined);
  return declarations.at(-1)?.trim();
}

function pixelValues(value: string | undefined): number[] {
  return Array.from(value?.matchAll(/(-?[\d.]+)px/g) ?? []).map(([, number]) => Number(number));
}

describe('responsive shell', () => {
  it('follows the device width without blocking zoom', () => {
    const viewport = indexHtml.match(/<meta\s+name="viewport"\s+content="([^"]+)"/i)?.[1];

    expect(viewport).toContain('width=device-width');
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/);
    expect(viewport).not.toMatch(/maximum-scale\s*=\s*(?:0|0\.[0-8])\b/);
  });

  it('shares a single mobile breakpoint between the token and every media query', () => {
    const breakpoint = globalStyles.match(/--breakpoint-mobile:\s*([\d.]+px)/)?.[1];
    const conditions = Object.values(stylesheets).flatMap((css) =>
      Array.from(css.matchAll(/@media\s*\(([^)]*)\)/g)).map(([, condition]) => condition.trim()),
    );

    expect(breakpoint).toBeDefined();
    expect(conditions.length).toBeGreaterThan(0);
    expect(conditions.filter((condition) => condition !== `max-width: ${breakpoint}`)).toEqual([]);
  });

  it('gives every presentational component its own mobile rule', () => {
    const withoutMobileRule = RESPONSIVE_COMPONENTS.filter((name) =>
      parseRules(stylesheets[name]).every((rule) => rule.media === null),
    );

    expect(withoutMobileRule).toEqual([]);
  });

  it('wraps long titles, error messages and option labels instead of overflowing', () => {
    const wrapsText = (css: string, selector: string) => rulesFor(css, selector)
      .some((rule) => /overflow-wrap|word-break\s*:\s*break-word/.test(rule.declarations));
    const missingGuards = WRAPPABLE_TEXT
      .filter((selector) => !wrapsText(globalStyles, selector))
      .filter((selector) => !RESPONSIVE_COMPONENTS.some((name) => wrapsText(stylesheets[name], selector)))
      .map((selector) => selector);

    expect(missingGuards).toEqual([]);
  });

  it('never reserves a width larger than a small phone', () => {
    const offenders = Object.entries(stylesheets).flatMap(([source, css]) =>
      parseRules(css)
        .filter((rule) => pixelValues(effectiveValue(css, rule.selector.split(',')[0].trim(), 'min-width'))
          .some((value) => value > MIN_VIEWPORT_PX))
        .map((rule) => `${source} ${rule.selector}`),
    );

    expect(offenders).toEqual([]);
  });

  it('lets grid columns shrink below the intrinsic width of their content', () => {
    const unguarded = Object.entries(stylesheets).flatMap(([source, css]) =>
      parseRules(css)
        .filter((rule) => /grid-template-columns:\s*repeat\(\s*\d+\s*,\s*1fr\s*\)/.test(rule.declarations))
        .map((rule) => `${source} ${rule.selector}`),
    );

    expect(unguarded).toEqual([]);
  });

  it('keeps option cards tappable and action buttons stacked on mobile', () => {
    const questionStep = stylesheets['QuestionStep.vue'];
    const mobileRules = parseRules(questionStep).filter((rule) => rule.media !== null);
    const columns = (effectiveValue(questionStep, '.options-grid--8', 'grid-template-columns', 'mobile') ?? '').replace(/\s/g, '');

    expect(columns).toMatch(/^(1fr|minmax\(0,1fr\))$/);
    expect(mobileRules.some((rule) => rule.selector.includes('.footer-actions') && /flex-direction:\s*column/.test(rule.declarations))).toBe(true);
    expect(mobileRules.some((rule) => rule.selector.includes('.footer-actions > button') && /width:\s*100%/.test(rule.declarations))).toBe(true);
  });

  it('shrinks the sticky header on mobile', () => {
    const mobileHeader = pixelValues(effectiveValue(globalStyles, '.app-header', 'padding', 'mobile') ?? '');
    const mobileTitle = pixelValues(effectiveValue(globalStyles, '.app-title', 'font-size', 'mobile') ?? '')[0];
    const desktopTitle = pixelValues(
      effectiveValue(globalStyles, '.app-title', 'font-size')?.replace('var(--font-size-lg)', '20px') ?? '',
    )[0];

    expect(mobileHeader).toEqual([10, 12]);
    expect(mobileTitle).toBeLessThan(desktopTitle);
  });
});

describe('responsive modals', () => {
  it('keeps the close button inside the viewport for any media height', () => {
    const offenders = Object.entries(modalStylesheets).flatMap(([source, css]) => {
      const overlayPaddingTop = pixelValues(effectiveValue(css, '.photo-modal', 'padding'))[0] ?? 0;
      const buttonOffset = pixelValues(effectiveValue(css, '.modal-close-btn', 'top'))[0] ?? 0;
      const buttonHeight = pixelValues(effectiveValue(css, '.modal-close-btn', 'height'))[0] ?? 0;
      const topEdge = overlayPaddingTop + buttonOffset;

      if (buttonOffset >= 0 || buttonHeight < MIN_TOUCH_TARGET_PX) {
        return [`${source} must hang the close button above the media and keep it ${MIN_TOUCH_TARGET_PX}px tall`];
      }

      return topEdge >= CLOSE_BUTTON_MIN_MARGIN_PX
        ? []
        : [`${source} places the close button at ${topEdge}px from the viewport top`];
    });

    expect(offenders).toEqual([]);
  });

  it('caps the media against the dynamic viewport height with a static fallback', () => {
    const offenders = Object.entries(modalStylesheets).flatMap(([source, css]) => {
      const heights = rulesFor(css, '.photo-modal-image')
        .flatMap((rule) => Array.from(rule.declarations.matchAll(/max-height:\s*([^;]+)/g)).map(([, value]) => value.trim()));
      const hasFallback = heights.some((value) => value.includes('100vh'));
      const hasDynamic = heights.some((value) => value.includes('100dvh'));

      return hasFallback && hasDynamic ? [] : [`${source} declares ${JSON.stringify(heights)}`];
    });

    expect(offenders).toEqual([]);
  });
});

describe('responsive markup', () => {
  const questionProps = {
    selectedOptionId: null,
    currentQuestionIndex: 5,
    totalQuestions: preguntas.length,
    progress: 60,
    canGoBack: true,
    canContinue: true,
    isSubmitting: false,
    hasSubmissionError: false,
  };

  it('marks a question with many options so the grid can collapse on mobile', () => {
    const crowded = preguntas.find((question) => question.opciones.length === 8)!;
    const wrapper = mount(QuestionStep, { props: { ...questionProps, question: crowded } });

    expect(wrapper.find('.options-grid').classes()).toContain('options-grid--8');
    expect(wrapper.findAll('.option-card')).toHaveLength(8);
  });

  it('announces the busy state while the final answer is being saved', () => {
    const last = preguntas[preguntas.length - 1];
    const wrapper = mount(QuestionStep, {
      props: { ...questionProps, question: last, currentQuestionIndex: preguntas.length - 1, isSubmitting: true },
    });
    const submit = wrapper.find('button.button-primary');

    expect(submit.text()).toBe('Guardando...');
    expect(submit.attributes('aria-busy')).toBe('true');
  });

  it('renders an unbreakable greeting in full', () => {
    const saludo = 'María-José Fernández de la Vega y Sanz de Santamaría';
    const wrapper = mount(CompletionStep, {
      props: { codigo: saludo, message: null },
    });

    expect(wrapper.find('.hero-title').text()).toContain(saludo);
  });
});
