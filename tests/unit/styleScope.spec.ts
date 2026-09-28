import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(__dirname, '../../src');

function listVueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listVueFiles(path);
    return entry.isFile() && entry.name.endsWith('.vue') ? [path] : [];
  });
}

describe('component style ownership', () => {
  it('keeps component styles scoped and global styles in style.css', () => {
    const vueFiles = listVueFiles(sourceRoot);
    const unscopedStyleFiles = vueFiles.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /<style(?![^>]*\bscoped\b)[^>]*>/i.test(source);
    });

    expect(unscopedStyleFiles).toEqual([]);
  });
});