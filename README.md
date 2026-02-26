# CSV Data Viewer

A minimal Vite + React + TypeScript web app for loading and inspecting multiple semicolon-separated CSV measurement files in the browser.

## Features
- Upload multiple `.csv` files via the browser.
- Parse each file client-side using `parseCsvText` from `src/lib/parser/parseCsvFile.ts`.
- Sidebar with loaded filenames and click-to-select active file.
- Main view with selected file metadata:
  - `serialNumber`
  - `result`
  - `stationId`
  - `date`
  - `time`
- Table of numeric tests showing:
  - `tsName`
  - `value`
  - `lowerLimit`
  - `upperLimit`
  - `unit`
  - `inLimit`

## CSV Format
- Semicolon (`;`) delimited.
- Two sections separated by an empty line:
  1. Metadata table (single row)
  2. Test results table

## Parser
Parser implementation is in:
- `src/lib/parser/parseCsvFile.ts`

It includes robust handling for BOM, line ending normalization, missing separator fallback, and numeric/limit derivations.

## Getting started
```bash
npm install
```

## Run the web app
```bash
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Build
```bash
npm run build
```

## Test
```bash
npm test
```
