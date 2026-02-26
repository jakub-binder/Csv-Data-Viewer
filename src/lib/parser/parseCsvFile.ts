import { parse as parseCsv } from 'csv-parse/sync';
import {
  normalizeParsedData,
  splitMetaAndTests,
  type MetaData,
  type ParsedCsvFile,
  type TestRow
} from './normalize';

export type { MetaData, ParsedCsvFile, TestRow };

function parseSemicolonRecords(sectionText: string): Array<Record<string, unknown>> {
  if (sectionText.trim().length === 0) {
    return [];
  }

  return parseCsv(sectionText, {
    delimiter: ';',
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true
  }) as Array<Record<string, unknown>>;
}

export function parseCsvText(fileName: string, text: string): ParsedCsvFile {
  const { metaSectionText, testsSectionText, warnings } = splitMetaAndTests(fileName, text);

  const metaRecords = parseSemicolonRecords(metaSectionText);
  const testRecords = parseSemicolonRecords(testsSectionText);

  return normalizeParsedData(fileName, metaRecords[0], testRecords, warnings);
}
