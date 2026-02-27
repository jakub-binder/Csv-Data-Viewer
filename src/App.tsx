import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { ParsedCsvFile, TestRow } from './lib/parser/normalize';
import { parseCsvTextBrowser } from './lib/parser/parseCsvBrowser';

interface LoadedCsvFile {
  id: string;
  fileName: string;
  parsed: ParsedCsvFile;
}

type MeasurementSelectionByFile = Record<string, string[]>;

function isNumericValueTest(test: TestRow): boolean {
  return test.value !== null;
}

function formatInLimit(inLimit: boolean | null): string {
  if (inLimit === null) {
    return '-';
  }

  return inLimit ? 'Pass' : 'Fail';
}

function getNormalizedTsName(test: TestRow): string {
  return test.tsName?.trim() ?? '';
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
  const [measurementSelections, setMeasurementSelections] =
    useState<MeasurementSelectionByFile>({});
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [draftSelection, setDraftSelection] = useState<string[]>([]);

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

    setMeasurementSelections((previous) => {
      const next = { ...previous };

      for (const file of parsedFiles) {
        if (next[file.fileName] !== undefined) {
          continue;
        }

        const tsNames = Array.from(
          new Set(
            file.parsed.tests
              .filter(isNumericValueTest)
              .map(getNormalizedTsName)
              .filter((tsName) => tsName.length > 0)
          )
        );

        next[file.fileName] = tsNames;
      }

      return next;
    });

    event.target.value = '';
  };

  const numericTests = (activeFile?.parsed.tests ?? []).filter(isNumericValueTest);
  const activeFileTsNames = useMemo(
    () =>
      Array.from(
        new Set(
          numericTests
            .map(getNormalizedTsName)
            .filter((tsName) => tsName.length > 0)
        )
      ),
    [numericTests]
  );

  const activeFileSelection = useMemo(() => {
    if (activeFile === null) {
      return [];
    }

    return measurementSelections[activeFile.fileName] ?? activeFileTsNames;
  }, [activeFile, activeFileTsNames, measurementSelections]);

  const selectedTsNameSet = useMemo(() => new Set(activeFileSelection), [activeFileSelection]);

  const filteredNumericTests = useMemo(
    () =>
      numericTests.filter((test) => {
        const tsName = getNormalizedTsName(test);
        return tsName.length > 0 && selectedTsNameSet.has(tsName);
      }),
    [numericTests, selectedTsNameSet]
  );

  const visibleTsNames = useMemo(() => {
    const normalizedSearch = filterSearch.trim().toLowerCase();
    if (normalizedSearch.length === 0) {
      return activeFileTsNames;
    }

    return activeFileTsNames.filter((tsName) => tsName.toLowerCase().includes(normalizedSearch));
  }, [activeFileTsNames, filterSearch]);

  useEffect(() => {
    if (!isFilterModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterModalOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFilterModalOpen]);

  const openFilterModal = () => {
    setDraftSelection(activeFileSelection);
    setFilterSearch('');
    setIsFilterModalOpen(true);
  };

  const applyDraftSelection = () => {
    if (activeFile !== null) {
      setMeasurementSelections((previous) => ({
        ...previous,
        [activeFile.fileName]: draftSelection
      }));
    }
    setIsFilterModalOpen(false);
  };

  const closeFilterModal = () => {
    setIsFilterModalOpen(false);
  };

  const draftSelectionSet = new Set(draftSelection);

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
              <div className="section-header">
                <h2>Numeric tests (value != null)</h2>
                <button type="button" onClick={openFilterModal}>
                  Filter measurements…
                </button>
              </div>
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
                  {filteredNumericTests.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No numeric tests found.</td>
                    </tr>
                  ) : (
                    filteredNumericTests.map((test, index) => {
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

            {isFilterModalOpen && (
              <div className="modal-overlay" onClick={closeFilterModal}>
                <div className="modal" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Select measurements to display</h3>
                    <button type="button" className="icon-button" onClick={closeFilterModal}>
                      ×
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Search by TsName"
                    value={filterSearch}
                    onChange={(event) => setFilterSearch(event.target.value)}
                  />

                  <div className="measurement-list">
                    {visibleTsNames.map((tsName) => (
                      <label key={tsName} className="measurement-item">
                        <input
                          type="checkbox"
                          checked={draftSelectionSet.has(tsName)}
                          onChange={(event) => {
                            setDraftSelection((previous) => {
                              if (event.target.checked) {
                                return [...previous, tsName];
                              }

                              return previous.filter((item) => item !== tsName);
                            });
                          }}
                        />
                        <span>{tsName}</span>
                      </label>
                    ))}
                  </div>

                  <div className="modal-actions">
                    <button type="button" onClick={() => setDraftSelection(activeFileTsNames)}>
                      All On
                    </button>
                    <button type="button" onClick={() => setDraftSelection([])}>
                      All Off
                    </button>
                    <button type="button" onClick={applyDraftSelection}>
                      Apply
                    </button>
                    <button type="button" onClick={closeFilterModal}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
