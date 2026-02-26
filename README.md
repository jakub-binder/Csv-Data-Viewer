# CSV Data Viewer

A minimal Vite + React + TypeScript web app for loading and inspecting semicolon-separated CSV measurement files in the browser.

## Features
- Load multiple `.csv` files with a **Load CSV files** control.
- Parse each uploaded file client-side using `parseCsvText` from `src/lib/parser/parseCsvFile.ts`.
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

## CSV format
- Semicolon (`;`) delimited.
- Two sections separated by an empty line:
  1. Metadata table (single row)
  2. Test results table

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
