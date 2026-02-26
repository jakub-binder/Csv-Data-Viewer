import { useMemo, useState, type ChangeEvent } from 'react';
import type { ParsedCsvFile, TestRow } from './lib/parser/normalize';
import { parseCsvTextBrowser } from './lib/parser/parseCsvBrowser';

interface LoadedCsvFile {
  id: string;
  fileName: string;
  parsed: ParsedCsvFile;
}

function isNumericValueTest(test: TestRow): boolean {
  return test.value !== null;
}

function formatInLimit(inLimit: boolean | null): string {
  if (inLimit === null) {
    return '-';
  }

  return inLimit ? 'Pass' : 'Fail';
}

function truncateName(name: string | undefined): string {
  if (!name) {
    return '-';
  }

  return name.length > 30 ? `${name.slice(0, 30)}…` : name;
}

export default function App() {
  const [files, setFiles] = useState<LoadedCsvFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const activeFile = useMemo(
    () => files.find((file) => file.id === activeFileId) ?? null,
    [files, activeFileId]
  );

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }

    const parsedFiles = await Promise.all(
      selectedFiles.map(async (file, index) => {
        const text = await file.text();
        return {
          id: `${Date.now()}-${index}-${file.name}`,
          fileName: file.name,
          parsed: parseCsvTextBrowser(file.name, text)
        } satisfies LoadedCsvFile;
      })
    );

    setFiles((previous) => {
      const next = [...previous, ...parsedFiles];
      if (activeFileId === null && next.length > 0) {
        setActiveFileId(next[0].id);
      }
      return next;
    });

    event.target.value = '';
  };

  const numericTests = (activeFile?.parsed.tests ?? []).filter(isNumericValueTest);

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>Files</h2>

        <label className="file-control">
          <span>Load CSV files</span>
          <input type="file" multiple accept=".csv" onChange={handleFilesSelected} />
        </label>

        <ul className="file-list">
          {files.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                className={file.id === activeFileId ? 'active' : ''}
                onClick={() => setActiveFileId(file.id)}
              >
                {file.fileName}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="main">
        {activeFile === null ? (
          <p>Load one or more CSV files to view parsed data.</p>
        ) : (
          <>
            <label className="details-toggle">
              <input
                type="checkbox"
                checked={showDetails}
                onChange={(event) => setShowDetails(event.target.checked)}
              />
              <span>Show details (Metadata & Warnings)</span>
            </label>

            {showDetails && (
              <>
                <section>
                  <h2>Metadata</h2>
                  <div className="metadata-grid">
                    <div>
                      <strong>serialNumber:</strong> {activeFile.parsed.meta.serialNumber ?? '-'}
                    </div>
                    <div>
                      <strong>result:</strong> {activeFile.parsed.meta.result ?? '-'}
                    </div>
                    <div>
                      <strong>stationId:</strong> {activeFile.parsed.meta.stationId ?? '-'}
                    </div>
                    <div>
                      <strong>date:</strong> {activeFile.parsed.meta.date ?? '-'}
                    </div>
                    <div>
                      <strong>time:</strong> {activeFile.parsed.meta.time ?? '-'}
                    </div>
                  </div>
                </section>

                <section>
                  <h2>Warnings</h2>
                  {activeFile.parsed.warnings.length === 0 ? (
                    <p>None</p>
                  ) : (
                    <ul>
                      {activeFile.parsed.warnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>{warning}</li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}

            <section>
              <h2>Numeric tests (value != null)</h2>
              <table>
                <thead>
                  <tr>
                    <th>TsName</th>
                    <th>Value</th>
                    <th>LowerLimit</th>
                    <th>UpperLimit</th>
                    <th>Unit</th>
                    <th>inLimit</th>
                  </tr>
                </thead>
                <tbody>
                  {numericTests.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No numeric tests found.</td>
                    </tr>
                  ) : (
                    numericTests.map((test, index) => {
                      const fullName = test.tsName ?? '-';
                      return (
                        <tr key={`${test.tsName ?? 'row'}-${index}`}>
                          <td title={fullName}>{truncateName(test.tsName)}</td>
                          <td>{test.value ?? '-'}</td>
                          <td>{test.lowerLimit ?? '-'}</td>
                          <td>{test.upperLimit ?? '-'}</td>
                          <td>{test.unit ?? '-'}</td>
                          <td>{formatInLimit(test.inLimit)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
