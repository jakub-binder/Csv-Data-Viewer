# Architecture Proposal: CSV Data Viewer

## Scope
This document summarizes the observed CSV format and proposes a minimal parsing/data-model approach for a TypeScript frontend MVP.

---

## 1) CSV structure summary

### Delimiter
- The files are semicolon-delimited (`;`).
- Both the metadata section and test table use the same delimiter.

### Section separation logic
Observed layout in all sample files:
1. Metadata header row (line 1)
2. Metadata value row (line 2)
3. Empty line (line 3; can appear as blank/whitespace-only)
4. Test table header row
5. Test table data rows

Proposed safe split rule:
- Normalize line endings (`\r\n` and `\r` to `\n`).
- Find the **first blank line** (`line.trim() === ''`) and treat it as separator between metadata and tests.
- If no blank line is present, fallback to:
  - Assume line 1 is metadata header, line 2 is metadata data, line 3 is test header, rest are test rows.
  - Emit a warning (non-fatal parse issue).

### Metadata structure
Metadata is a single-row key/value table with stable header names in samples:
- `SerialNumber`
- `Result` (overall run result: `Pass`/`Fail`)
- `DetailResult` (e.g., `P`/`F`)
- `StationID`
- `TestName`
- `TestDefinitionFile`
- `TestVersion`
- `TestDefinitionVersion`
- `TestTime` (appears numeric, likely duration)
- `SitesNumber`
- `Date`
- `Time`
- `Serial1`

### Test table structure
Header columns observed:
- `Status`
- `TsId`
- `TsName`
- `SiteId`
- `SiteSN`
- `Expected/Regex`
- `LowerLimit`
- `UpperLimit`
- `Value`
- `Unit`
- `Type`
- `Skipped`
- `PassFail`
- `TestTime`

The table includes mixed types:
- Numeric measurements (`Type` often `Double Float`) with limits/value populated.
- String/functional checks (`Type` often `String`) with empty limits and textual values like `()` or empty string.
- Rows with `Status=Skipped` and `PassFail=Fail` (important nuance for UI semantics).

### Important columns
For charting and in-limit calculations:
- `TsName`: metric/test label
- `Value`: measured value (may be non-numeric)
- `LowerLimit`, `UpperLimit`: optional bounds
- `Unit`: display unit
- `Type`: helps identify numeric vs textual tests
- `PassFail` and `Status`: vendor verdict and execution state

For file/run summary:
- Metadata `Result`, `Date`, `Time`, `SerialNumber`, `StationID`, `TestTime`

### Potential edge cases
1. **Missing separator line** or multiple blank lines.
2. **Whitespace-only blank lines** instead of truly empty lines.
3. **BOM at file start** (`\uFEFF`) impacting first header key.
4. **Missing metadata data row** or truncated file.
5. **Variable column order** or additional unexpected columns.
6. **Rows with missing cells** (fewer delimiters than header count).
7. **Non-numeric values in `Value`/limits** (empty strings, text, `()`).
8. **Only one-sided limits** (only lower or only upper present).
9. **`PassFail=Fail` with `Status=Skipped`**; should not be treated as numeric out-of-limit.
10. **Locale-style decimals** in future data (comma decimal separator) even though current samples use `.`.
11. **Very long `TsName` values** affecting UI readability.

---

## 2) What this app is supposed to do (README + AGENTS + sample data)

In plain language:
- The app is a small **frontend-only** viewer for multiple production-test CSV files.
- Users load several files, switch between them, and inspect the measurement results.
- The key UX goal is to visualize test values against `LowerLimit`/`UpperLimit`, and clearly highlight out-of-limit cases.
- Parsing must be robust and defensive because rows are heterogeneous (numeric and non-numeric), with many missing limits and occasional skipped/fail semantics.
- The project should remain lightweight (no backend) and TypeScript-oriented, with parser unit tests and clear README/npm scripts.

---

## 3) Proposed data model + parsing strategy

## TypeScript interfaces

```ts
export interface MetaData {
  serialNumber?: string;
  result?: 'Pass' | 'Fail' | string;
  detailResult?: string;
  stationId?: string;
  testName?: string;
  testDefinitionFile?: string;
  testVersion?: string;
  testDefinitionVersion?: string;
  testTimeSeconds?: number | null;
  sitesNumber?: number | null;
  date?: string; // Keep raw; parse later if needed
  time?: string; // Keep raw; parse later if needed
  serial1?: string;

  // Keep all unknown/original keys for forward compatibility
  raw: Record<string, string>;
}

export interface TestRow {
  status?: string;         // e.g., Pass, Fail, Skipped
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

  // Derived fields for UI/filter/chart logic
  isNumericValue: boolean;
  hasAnyLimit: boolean;
  inLimit: boolean | null; // null = cannot evaluate

  raw: Record<string, string>;
}
```

## Parsing strategy (safe section split + normalization)

1. **Pre-normalization**
   - Remove BOM from first character if present.
   - Normalize EOL to `\n`.
   - Split into lines.

2. **Section split**
   - Find first blank/whitespace-only line.
   - `metaLines = lines[0..separator-1]`
   - `testLines = lines[separator+1..end]`
   - Validate minimum expected rows for each section.

3. **CSV row parse utility**
   - Parse each row with semicolon delimiter.
   - For this dataset, unquoted simple split may work, but better to use a proper CSV parser configured with `delimiter: ';'` and quote support.

4. **Metadata parse**
   - Take metadata header row + first data row.
   - Map known keys to normalized camelCase fields.
   - Store `raw` map for all source fields.
   - Convert numeric candidates (`TestTime`, `SitesNumber`) with safe number parser.

5. **Test table parse**
   - First row = test headers.
   - Parse each subsequent row to object with missing cells padded as empty string.
   - Trim string values (but preserve internal spaces).
   - Derive numeric fields via a safe parser:
     - empty => `null`
     - valid finite number => numeric value
     - otherwise => `null`

6. **Derived fields**
   - `isNumericValue = value !== null`
   - `hasAnyLimit = lowerLimit !== null || upperLimit !== null`
   - `inLimit` computed as described below.

7. **Non-fatal diagnostics**
   - Collect parse warnings (missing separator, missing headers, bad numeric conversion count, etc.) to expose in UI/dev tools.

## How to compute `inLimit`
Recommended logic:

```ts
function computeInLimit(value: number | null, lower: number | null, upper: number | null): boolean | null {
  if (value === null) return null;
  if (lower === null && upper === null) return null;
  if (lower !== null && value < lower) return false;
  if (upper !== null && value > upper) return false;
  return true;
}
```

Notes:
- Inclusive bounds (`>= lower` and `<= upper`).
- If value missing/non-numeric, return `null` (not evaluable).
- If no limits exist, return `null` (not limit-based test).
- UI can render `null` as “N/A” and avoid marking as pass/fail by limit.

## Handling non-numeric or missing limits
- Keep both raw and parsed forms (`*Raw` + parsed numeric).
- Use parsed numeric only for chart and `inLimit` logic.
- Rows with text values or missing limits:
  - remain visible in table,
  - excluded from numeric limit charts by default,
  - can still display vendor `PassFail`/`Status` badges.
- When only one limit exists:
  - evaluate against the available bound only.
- Never coerce non-numeric placeholders like `()`, `N/A`, empty to zero.

---

## 4) Minimal MVP feature list (proposal only)

1. **Multi-file upload**
   - Select and load multiple CSV files in one action.

2. **File/run switcher**
   - List loaded files with quick selection.
   - Show run-level summary: serial, result, station, date/time.

3. **Robust parser layer**
   - Parse metadata + test section with safe split and warning collection.

4. **Results table view**
   - Sort/filter by `TsName`, `PassFail`, `Status`, numeric-only.
   - Show raw and normalized numeric fields.

5. **Limit chart (numeric rows only)**
   - Plot `Value` with lower/upper bounds.
   - Highlight out-of-limit points.

6. **Out-of-limit and issue highlighting**
   - Distinguish:
     - measured out-of-limit (`inLimit=false`)
     - non-evaluable (`inLimit=null`)
     - vendor-reported fail/skipped cases

7. **Parser unit tests (small but critical set)**
   - Valid 2-section parse.
   - Missing blank separator fallback.
   - Non-numeric value/limit behavior.
   - One-sided limits.
   - BOM handling.

8. **Documentation and scripts**
   - README quickstart and parsing behavior notes.
   - npm scripts for test/build/dev (to be added in implementation phase).

---

## Conclusion
The sample dataset confirms a stable two-section semicolon CSV format with mixed test row types and imperfect pass/fail semantics. A resilient parser with typed normalized fields plus raw-field preservation will provide a solid base for reliable visualization and filtering in the MVP.
