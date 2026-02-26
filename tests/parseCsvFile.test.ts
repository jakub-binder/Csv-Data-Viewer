import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseCsvText } from '../src/lib/parser/parseCsvFile.js';

const sampleDir = join(process.cwd(), 'sample-data');
const sampleFiles = readdirSync(sampleDir).filter((name) => name.endsWith('.csv'));

describe('parseCsvText using sample-data files', () => {
  it('parses all sample files with metadata and tests', () => {
    expect(sampleFiles.length).toBeGreaterThan(0);

    for (const fileName of sampleFiles) {
      const text = readFileSync(join(sampleDir, fileName), 'utf8');
      const parsed = parseCsvText(fileName, text);

      expect(parsed.meta.raw.SerialNumber).toBeTruthy();
      expect(parsed.meta.raw.Result).toBeTruthy();
      expect(parsed.tests.length).toBeGreaterThan(0);
    }
  });

  it('produces evaluable and non-evaluable test rows as expected', () => {
    const text = readFileSync(join(sampleDir, sampleFiles[0]), 'utf8');
    const parsed = parseCsvText(sampleFiles[0], text);

    const inLimitValues = parsed.tests.map((row) => row.inLimit);
    expect(inLimitValues.some((value) => value === true || value === false)).toBe(true);
    expect(inLimitValues.some((value) => value === null)).toBe(true);
  });

  it('handles BOM and no-separator fallback behavior', () => {
    const text = readFileSync(join(sampleDir, sampleFiles[0]), 'utf8');
    const withoutSeparator = text.replace(/\r?\n\s*\r?\n/, '\n');
    const bomPrefixed = `\uFEFF${withoutSeparator}`;

    const parsed = parseCsvText(`bom-${sampleFiles[0]}`, bomPrefixed);

    expect(parsed.meta.serialNumber).toBeTruthy();
    expect(parsed.tests.length).toBeGreaterThan(0);
    expect(parsed.warnings.some((w) => w.includes('fallback split'))).toBe(true);
  });
});
