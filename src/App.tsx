import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { ParsedCsvFile, TestRow } from './lib/parser/normalize';
import { parseCsvTextBrowser } from './lib/parser/parseCsvBrowser';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type MainTab = 'file-view' | 'compare';

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

function getNormalizedTsName(test: TestRow): string {
  return test.tsName?.trim() ?? '';
}

function truncateName(name: string | undefined): string {
  if (!name) {
    return '-';
  }

  return name.length > 30 ? `${name.slice(0, 30)}…` : name;
}

function collectUniqueNumericTsNames(files: LoadedCsvFile[]): Set<string> {
  return new Set(
    files.flatMap((file) =>
      file.parsed.tests
        .filter(isNumericValueTest)
        .map(getNormalizedTsName)
        .filter((tsName) => tsName.length > 0)
    )
  );
}

function collectUniqueTsNames(files: LoadedCsvFile[]): Set<string> {
  return new Set(
    files.flatMap((file) =>
      file.parsed.tests.map(getNormalizedTsName).filter((tsName) => tsName.length > 0)
    )
  );
}

function truncateFileLabel(label: string): string {
  return label.length > 24 ? `${label.slice(0, 24)}…` : label;
}

export default function App() {
  const [files, setFiles] = useState<LoadedCsvFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('file-view');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedTsNames, setSelectedTsNames] = useState<string[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [draftSelection, setDraftSelection] = useState<string[]>([]);

  const activeFile = useMemo(
    () => files.find((file) => file.id === activeFileId) ?? null,
    [files, activeFileId]
  );

  const allTsNames = useMemo(() => Array.from(collectUniqueNumericTsNames(files)), [files]);
  const allTsNamesSet = useMemo(() => new Set(allTsNames), [allTsNames]);
  const compareTsNames = useMemo(() => Array.from(collectUniqueTsNames(files)), [files]);
  const [selectedCompareTsName, setSelectedCompareTsName] = useState('');

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

    const knownTsNames = collectUniqueNumericTsNames(files);
    const newTsNames = collectUniqueNumericTsNames(parsedFiles);

    setFiles((previous) => {
      const next = [...previous, ...parsedFiles];
      if (activeFileId === null && next.length > 0) {
        setActiveFileId(next[0].id);
      }
      return next;
    });

    setSelectedTsNames((previous) => {
      const next = new Set(previous);

      for (const tsName of newTsNames) {
        if (!knownTsNames.has(tsName)) {
          next.add(tsName);
        }
      }

      return Array.from(next);
    });

    event.target.value = '';
  };

  const numericTests = (activeFile?.parsed.tests ?? []).filter(isNumericValueTest);
  const selectedTsNameSet = useMemo(() => new Set(selectedTsNames), [selectedTsNames]);

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
      return allTsNames;
    }

    return allTsNames.filter((tsName) => tsName.toLowerCase().includes(normalizedSearch));
  }, [allTsNames, filterSearch]);

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
    setDraftSelection(selectedTsNames.filter((tsName) => allTsNamesSet.has(tsName)));
    setFilterSearch('');
    setIsFilterModalOpen(true);
  };

  const applyDraftSelection = () => {
    setSelectedTsNames(draftSelection.filter((tsName) => allTsNamesSet.has(tsName)));
    setIsFilterModalOpen(false);
  };

  const closeFilterModal = () => {
    setIsFilterModalOpen(false);
  };

  const draftSelectionSet = new Set(draftSelection);

  useEffect(() => {
    setSelectedCompareTsName((previous) => {
      if (compareTsNames.includes(previous)) {
        return previous;
      }

      return compareTsNames[0] ?? '';
    });
  }, [compareTsNames]);

  const compareSeries = useMemo(() => {
    if (selectedCompareTsName.length === 0) {
      return {
        labels: files.map((file) => truncateFileLabel(file.fileName)),
        fullLabels: files.map((file) => file.fileName),
        valueSeries: [] as Array<number | null>,
        lowerLimitSeries: [] as Array<number | null>,
        upperLimitSeries: [] as Array<number | null>
      };
    }

    const valueSeries: Array<number | null> = [];
    const lowerLimitSeries: Array<number | null> = [];
    const upperLimitSeries: Array<number | null> = [];

    for (const file of files) {
      const matchingTest = file.parsed.tests.find(
        (test) => getNormalizedTsName(test) === selectedCompareTsName
      );

      valueSeries.push(matchingTest?.value ?? null);
      lowerLimitSeries.push(matchingTest?.lowerLimit ?? null);
      upperLimitSeries.push(matchingTest?.upperLimit ?? null);
    }

    return {
      labels: files.map((file) => truncateFileLabel(file.fileName)),
      fullLabels: files.map((file) => file.fileName),
      valueSeries,
      lowerLimitSeries,
      upperLimitSeries
    };
  }, [files, selectedCompareTsName]);

  const compareChartData = useMemo(
    () => ({
      labels: compareSeries.labels,
      datasets: [
        {
          label: 'Value',
          data: compareSeries.valueSeries,
          borderColor: '#1976d2',
          backgroundColor: '#1976d2',
          spanGaps: false,
          tension: 0.15
        },
        {
          label: 'LSL',
          data: compareSeries.lowerLimitSeries,
          borderColor: '#f57c00',
          backgroundColor: '#f57c00',
          borderDash: [6, 4],
          spanGaps: false,
          tension: 0
        },
        {
          label: 'USL',
          data: compareSeries.upperLimitSeries,
          borderColor: '#388e3c',
          backgroundColor: '#388e3c',
          borderDash: [6, 4],
          spanGaps: false,
          tension: 0
        }
      ]
    }),
    [compareSeries]
  );

  const compareChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Loaded CSV files'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Value'
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (context: Array<{ dataIndex: number }>) => {
              const index = context[0]?.dataIndex ?? 0;
              return compareSeries.fullLabels[index] ?? '';
            }
          }
        }
      }
    }),
    [compareSeries.fullLabels]
  );

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
        <div className="tabs" role="tablist" aria-label="Main view tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'file-view'}
            className={activeTab === 'file-view' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('file-view')}
          >
            File view
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'compare'}
            className={activeTab === 'compare' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('compare')}
          >
            Compare
          </button>
        </div>

        {activeTab === 'compare' && (
          <section className="compare-panel">
            {files.length === 0 ? (
              <p>Load CSV files to compare measurements across files.</p>
            ) : (
              <>
                <label className="compare-select">
                  <span>Measurement (TsName)</span>
                  <select
                    value={selectedCompareTsName}
                    onChange={(event) => setSelectedCompareTsName(event.target.value)}
                  >
                    {compareTsNames.map((tsName) => (
                      <option key={tsName} value={tsName} title={tsName}>
                        {truncateName(tsName)}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedCompareTsName.length === 0 ? (
                  <p>No measurements available.</p>
                ) : (
                  <div className="chart-wrapper">
                    <Line data={compareChartData} options={compareChartOptions} />
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {activeTab === 'file-view' &&
          (activeFile === null ? (
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
                  Filter measurements (global)…
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
                    <h3>Select measurements to display (global)</h3>
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
                    <button type="button" onClick={() => setDraftSelection(allTsNames)}>
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
        ))}
      </main>
    </div>
  );
}
