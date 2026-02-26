import { useMemo, useState, type ChangeEvent } from 'react';
import type { ParsedCsvFile, TestRow } from './lib/parser/parseCsvFile';
import { parseCsvText } from './lib/parser/parseCsvFile';

interface LoadedCsvFile {
  id: string;
  fileName: string;
  parsed: ParsedCsvFile;
}

function isNumericTest(test: TestRow): boolean {
  return test.value !== null || test.lowerLimit !== null || test.upperLimit !== null;
}

export default function App() {
  const [files, setFiles] = useState<LoadedCsvFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const activeFile = useMemo(
    () => files.find((file) => file.id === activeFileId) ?? null,
    [files, activeFileId]
  );

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files ?? []);

    if (incomingFiles.length === 0) {
      return;
    }

    const parsedFiles = await Promise.all(
      incomingFiles.map(async (file, index) => {
        const text = await file.text();
        const parsed = parseCsvText(file.name, text);

        return {
          id: `${Date.now()}-${index}-${file.name}`,
          fileName: file.name,
          parsed
        } satisfies LoadedCsvFile;
      })
    );

    setFiles((previous) => {
      const next = [...previous, ...parsedFiles];
      if (!activeFileId && next.length > 0) {
        setActiveFileId(next[0].id);
      }
      return next;
    });

    if (!activeFileId && parsedFiles.length > 0) {
      setActiveFileId(parsedFiles[0].id);
    }

    event.target.value = '';
  };

  const numericTests = (activeFile?.parsed.tests ?? []).filter(isNumericTest);

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>Loaded Files</h2>
        <input type="file" accept=".csv" multiple onChange={handleFilesSelected} />
        <ul>
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
        {!activeFile ? (
          <p>Upload one or more CSV files to start.</p>
        ) : (
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
              <h2>Numeric Tests</h2>
              <table>
                <thead>
                  <tr>
                    <th>tsName</th>
                    <th>value</th>
                    <th>lowerLimit</th>
                    <th>upperLimit</th>
                    <th>unit</th>
                    <th>inLimit</th>
                  </tr>
                </thead>
                <tbody>
                  {numericTests.map((test, index) => (
                    <tr key={`${test.tsName ?? 'row'}-${index}`}>
                      <td>{test.tsName ?? '-'}</td>
                      <td>{test.value ?? '-'}</td>
                      <td>{test.lowerLimit ?? '-'}</td>
                      <td>{test.upperLimit ?? '-'}</td>
                      <td>{test.unit ?? '-'}</td>
                      <td>{test.inLimit === null ? '-' : test.inLimit ? 'Pass' : 'Fail'}</td>
                    </tr>
                  ))}
                  {numericTests.length === 0 && (
                    <tr>
                      <td colSpan={6}>No numeric tests found.</td>
                    </tr>
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
