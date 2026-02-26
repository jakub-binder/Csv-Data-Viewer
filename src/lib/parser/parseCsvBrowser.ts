import Papa from 'papaparse';
import { normalizeParsedData, splitMetaAndTests, type ParsedCsvFile } from './normalize';

function parseSemicolonRecordsBrowser(sectionText: string): Array<Record<string, unknown>> {
  if (sectionText.trim().length === 0) {
    return [];
  }

  const result = Papa.parse<Record<string, unknown>>(sectionText, {
    delimiter: ';',
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim()
  });

  return result.data;
}

export function parseCsvTextBrowser(fileName: string, text: string): ParsedCsvFile {
  const { metaSectionText, testsSectionText, warnings } = splitMetaAndTests(fileName, text);

  const metaRecords = parseSemicolonRecordsBrowser(metaSectionText);
  const testRecords = parseSemicolonRecordsBrowser(testsSectionText);

  return normalizeParsedData(fileName, metaRecords[0], testRecords, warnings);
}
