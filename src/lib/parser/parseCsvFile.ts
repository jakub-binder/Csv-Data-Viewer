import { parse as parseCsv } from 'csv-parse/sync';

export interface MetaData {
  serialNumber?: string;
  result?: string;
  detailResult?: string;
  stationId?: string;
  testName?: string;
  testDefinitionFile?: string;
  testVersion?: string;
  testDefinitionVersion?: string;
  testTimeSeconds?: number | null;
  sitesNumber?: number | null;
  date?: string;
  time?: string;
  serial1?: string;
  raw: Record<string, string>;
}

export interface TestRow {
  status?: string;
  tsId?: string;
  tsName?: string;
  siteId?: string;
  siteSn?: string;
  expectedRegex?: string;
  lowerLimitRaw?: string;
  upperLimitRaw?: string;
  valueRaw?: string;
  lowerLimit?: number | null;
  upperLimit?: number | null;
  value?: number | null;
  unit?: string;
  type?: string;
  skipped?: boolean | null;
  passFail?: string;
  testTimeRaw?: string;
  testTime?: number | null;
  isNumericValue: boolean;
  hasAnyLimit: boolean;
  inLimit: boolean | null;
  raw: Record<string, string>;
}

export interface ParsedCsvFile {
  meta: MetaData;
  tests: TestRow[];
  warnings: string[];
}

function normalizeInput(text: string): string {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return withoutBom.replace(/\r\n?/g, '\n');
}

function toNumberOrNull(raw: string | undefined): number | null {
  if (raw == null) {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBooleanOrNull(raw: string | undefined): boolean | null {
  if (raw == null) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  return null;
}

function computeInLimit(value: number | null, lower: number | null, upper: number | null): boolean | null {
  if (value === null) {
    return null;
  }
  if (lower === null && upper === null) {
    return null;
  }
  if (lower !== null && value < lower) {
    return false;
  }
  if (upper !== null && value > upper) {
    return false;
  }
  return true;
}

function parseSemicolonRows(lines: string[]): string[][] {
  if (lines.length === 0) {
    return [];
  }

  return parseCsv(lines.join('\n'), {
    delimiter: ';',
    relax_column_count: true,
    skip_empty_lines: false,
    trim: false
  }) as string[][];
}

function rowToObject(headers: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < headers.length; i += 1) {
    const key = headers[i]?.trim() ?? '';
    if (!key) {
      continue;
    }
    obj[key] = (row[i] ?? '').trim();
  }
  return obj;
}

export function parseCsvText(fileName: string, text: string): ParsedCsvFile {
  const warnings: string[] = [];
  const normalized = normalizeInput(text);
  const lines = normalized.split('\n');

  const separatorIndex = lines.findIndex((line) => line.trim() === '');
  let metaLines: string[];
  let testLines: string[];

  if (separatorIndex >= 0) {
    metaLines = lines.slice(0, separatorIndex);
    testLines = lines.slice(separatorIndex + 1).filter((line) => line.trim().length > 0);
  } else {
    warnings.push(`${fileName}: no blank separator line found; applied positional fallback split.`);
    metaLines = [lines[0] ?? '', lines[1] ?? ''];
    testLines = lines.slice(2);
  }

  if (metaLines.length < 2) {
    warnings.push(`${fileName}: metadata section has fewer than two rows.`);
  }

  const metaRows = parseSemicolonRows(metaLines.slice(0, 2));
  const metaHeader = metaRows[0] ?? [];
  const metaValue = metaRows[1] ?? [];
  const metaRaw = rowToObject(metaHeader, metaValue);

  const meta: MetaData = {
    serialNumber: metaRaw.SerialNumber,
    result: metaRaw.Result,
    detailResult: metaRaw.DetailResult,
    stationId: metaRaw.StationID,
    testName: metaRaw.TestName,
    testDefinitionFile: metaRaw.TestDefinitionFile,
    testVersion: metaRaw.TestVersion,
    testDefinitionVersion: metaRaw.TestDefinitionVersion,
    testTimeSeconds: toNumberOrNull(metaRaw.TestTime),
    sitesNumber: toNumberOrNull(metaRaw.SitesNumber),
    date: metaRaw.Date,
    time: metaRaw.Time,
    serial1: metaRaw.Serial1,
    raw: metaRaw
  };

  if (testLines.length === 0) {
    warnings.push(`${fileName}: test section is empty.`);
    return { meta, tests: [], warnings };
  }

  const testRows = parseSemicolonRows(testLines);
  const testHeader = (testRows[0] ?? []).map((entry) => entry.trim());
  const bodyRows = testRows.slice(1);

  if (testHeader.length === 0) {
    warnings.push(`${fileName}: test section has no header row.`);
  }

  const tests = bodyRows
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row, index) => {
      const raw = rowToObject(testHeader, row);

      const lowerLimit = toNumberOrNull(raw.LowerLimit);
      const upperLimit = toNumberOrNull(raw.UpperLimit);
      const value = toNumberOrNull(raw.Value);

      const hasAnyLimit = lowerLimit !== null || upperLimit !== null;
      const inLimit = computeInLimit(value, lowerLimit, upperLimit);

      if (raw.PassFail === 'Fail' && raw.Status === 'Skipped') {
        warnings.push(`${fileName}: row ${index + 2} has PassFail=Fail with Status=Skipped.`);
      }

      return {
        status: raw.Status,
        tsId: raw.TsId,
        tsName: raw.TsName,
        siteId: raw.SiteId,
        siteSn: raw.SiteSN,
        expectedRegex: raw['Expected/Regex'],
        lowerLimitRaw: raw.LowerLimit,
        upperLimitRaw: raw.UpperLimit,
        valueRaw: raw.Value,
        lowerLimit,
        upperLimit,
        value,
        unit: raw.Unit,
        type: raw.Type,
        skipped: parseBooleanOrNull(raw.Skipped),
        passFail: raw.PassFail,
        testTimeRaw: raw.TestTime,
        testTime: toNumberOrNull(raw.TestTime),
        isNumericValue: value !== null,
        hasAnyLimit,
        inLimit,
        raw
      } satisfies TestRow;
    });

  return { meta, tests, warnings };
}
