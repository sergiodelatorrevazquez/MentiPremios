import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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
});