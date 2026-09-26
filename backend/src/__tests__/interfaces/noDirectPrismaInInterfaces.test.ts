/**
 * Static analysis test — verify interfaces never import Prisma directly.
 *
 * Scans all TypeScript files under src/interfaces/ and asserts that none
 * of them contain an import from '@prisma/client' or 'prismaClient'.
 *
 * This enforces the Clean Architecture rule: the interfaces layer must
 * depend only on application use cases and domain types — never on
 * infrastructure or database drivers.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

const INTERFACES_DIR = resolve(__dirname, '../../interfaces');
const FORBIDDEN_PATTERNS = [
  /@prisma\/client/,
  /prismaClient/,
  /from\s+['"].*prisma.*/i,
];

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Architecture — interfaces layer has no direct Prisma imports', () => {
  const files = collectTsFiles(INTERFACES_DIR);

  it('finds at least one file in src/interfaces/', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const filePath of files) {
    it(`${filePath.replace(INTERFACES_DIR, '').replace(/\\/g, '/')} contains no Prisma import`, () => {
      const content = readFileSync(filePath, 'utf-8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        const match = pattern.test(content);
        if (match) {
          // Report the offending line for easy debugging
          const offending = content
            .split('\n')
            .filter((line) => pattern.test(line))
            .join('\n');
          expect.fail(
            `File imports Prisma directly:\n  ${filePath}\nOffending lines:\n${offending}`,
          );
        }
      }
    });
  }
});
