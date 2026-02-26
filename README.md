# CSV Data Viewer

A minimal Vite + React + TypeScript web app for loading and inspecting semicolon-separated CSV measurement files in the browser.

## Features
- Load multiple `.csv` files with a **Load CSV files** control.
- Parse each uploaded file client-side using `parseCsvTextBrowser` from `src/lib/parser/parseCsvBrowser.ts` (PapaParse-based, browser-safe).
- Keep parsed files in memory and switch active file from a left-side filename list.
- Show selected file metadata (`serialNumber`, `result`, `stationId`, `date`, `time`).
- Show parser warnings (if present).
- Show a numeric tests table for rows where `value != null` with columns:
  - `TsName`
  - `Value`
  - `LowerLimit`
  - `UpperLimit`
  - `Unit`
  - `inLimit`

## Parser architecture
- Shared normalization and derived-field logic: `src/lib/parser/normalize.ts`
- Node parser (tests / Node runtime): `src/lib/parser/parseCsvFile.ts` using `csv-parse/sync`
- Browser parser (Vite React app): `src/lib/parser/parseCsvBrowser.ts` using `papaparse`

This avoids Node-only globals like `Buffer` in the browser app while keeping Node tests working.

## Install
```bash
npm install
```

## Run tests
```bash
npm test
```

## Run app
```bash
npm run dev
```

Then open the URL printed by Vite (typically `http://localhost:5173`).
