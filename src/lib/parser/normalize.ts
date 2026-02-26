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

export function normalizeInput(text: string): string {
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

export function splitMetaAndTests(fileName: string, text: string): {
  metaSectionText: string;
  testsSectionText: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const normalized = normalizeInput(text);
  const lines = normalized.split('\n');

  const separatorIndex = lines.findIndex((line, index) => {
    if (line.trim() !== '') {
      return false;
    }

    return lines.slice(index + 1).some((candidate) => candidate.trim().length > 0);
  });

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

  return {
    metaSectionText: metaLines.slice(0, 2).join('\n'),
    testsSectionText: testLines.join('\n'),
    warnings
  };
}

function sanitizeRawRecord(record: Record<string, unknown>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(record)) {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      continue;
    }

    sanitized[trimmedKey] = String(value ?? '').trim();
  }

  return sanitized;
}

export function normalizeParsedData(
  fileName: string,
  metaRecord: Record<string, unknown> | undefined,
  testRecords: Array<Record<string, unknown>>,
  initialWarnings: string[] = []
): ParsedCsvFile {
  const warnings = [...initialWarnings];
  const metaRaw = sanitizeRawRecord(metaRecord ?? {});

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

  if (testRecords.length === 0) {
    warnings.push(`${fileName}: test section is empty.`);
    return { meta, tests: [], warnings };
  }

  const tests = testRecords
    .map((record) => sanitizeRawRecord(record))
    .filter((record) => Object.values(record).some((value) => value.length > 0))
    .map((raw, index) => {
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
