import type { ClientConfig } from '@/wakaru/schema/config.js';
import type { SavedWord } from '@/wakaru/types.js';
import type { AppContext } from '../lib/types.js';

import { useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router';
import { Sidebar } from '../components/Sidebar.js';
import { errorMessage } from '../lib/utils.js';

export function App() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [words, setWords] = useState<readonly SavedWord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const sortedWords = useMemo(
    () =>
      [...words].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
      ),
    [words]
  );

  useEffect(() => {
    void initialise();
  }, []);

  async function initialise(): Promise<void> {
    setError(null);
    try {
      const [loadedConfig, loadedWords] = await Promise.all([
        window.wakaru.loadConfig(),
        window.wakaru.listWords(),
      ]);
      setConfig(loadedConfig);
      setWords(loadedWords);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function exportTsv(): Promise<void> {
    setExporting(true);
    setError(null);
    try {
      await window.wakaru.exportTsv();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setExporting(false);
    }
  }

  function addSavedWord(word: SavedWord): void {
    setWords((current) => [word, ...current]);
  }

  const context: AppContext = {
    config,
    words,
    sortedWords,
    exporting,
    setConfig,
    addSavedWord,
    exportTsv,
  };

  return (
    <main className="grid min-h-svh grid-cols-[240px_minmax(0,1fr)] bg-background text-foreground max-md:grid-cols-1">
      <Sidebar />
      <div className="min-w-0 p-6 md:p-8">
        {error ? (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Outlet context={context} />
      </div>
    </main>
  );
}
