# CSV Data Viewer

## Purpose
Web application for viewing multiple CSV measurement result files.

## CSV Format
- Semicolon (`;`) delimited.
- Two sections separated by an empty line:

1. Metadata table (single row)
2. Test results table

## Requirements
- Load multiple CSV files.
- Switch between them.
- Visualize numeric test values against `LowerLimit` and `UpperLimit`.
- Highlight out-of-limit values.

## Parser layer
This repository includes a TypeScript parser module:
- `src/lib/parser/parseCsvFile.ts`
- exported function: `parseCsvText(fileName, text)`

It handles:
- UTF-8 BOM stripping.
- EOL normalization (`CRLF`/`CR` -> `LF`).
- First blank-line section split with fallback behavior.
- Semicolon CSV parsing.
- Derived fields: `isNumericValue`, `hasAnyLimit`, `inLimit`.

## Setup
```bash
npm install
```

## Run tests
```bash
npm test
```

## Type-check/build
```bash
npm run build
```

## Current Status
Parser foundation and tests are in place. UI implementation is not scaffolded yet.
