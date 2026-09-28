import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workspaceRoot = resolve(__dirname, '../..');

describe('favicon configuration', () => {
  it('points to an existing public asset', () => {
    const html = readFileSync(resolve(workspaceRoot, 'index.html'), 'utf8');
    const faviconHref = html.match(/<link\s+rel="icon"[^>]*href="([^"]+)"/i)?.[1];

    expect(faviconHref).toBe('/foto-amigos.jpg');
    expect(existsSync(resolve(workspaceRoot, 'public', faviconHref?.slice(1) ?? ''))).toBe(true);
  });
});