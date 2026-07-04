import type { SavedWord } from '@/client/types.js';

import { tsvExportPath, writeTsvExport } from '@/client/export/tsv.js';
import { useEffect, useState } from 'react';
import { Button, Separator } from '../components/index.js';
import { useTuiApp, useTuiCommand } from '../lib/context/app.js';
import { colorscheme } from '../lib/theme.js';

const LIBRARY_COMMAND_IDS = {
  exportTsv: 'library.exportTsv',
} as const;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function LibraryScreen() {
  const { addToast, config, exportDirectory, navigate, wordStore } =
    useTuiApp();
  const [savedWords, setSavedWords] = useState<readonly SavedWord[]>([]);

  useEffect(() => {
    try {
      setSavedWords(wordStore.list());
    } catch (error) {
      addToast(errorMessage(error), 'error');
    }
  }, [addToast, wordStore]);

  useTuiCommand({
    id: LIBRARY_COMMAND_IDS.exportTsv,
    title: 'Export TSV file',
    keybindings: [{ key: 'e', ctrl: true }],
    run: async () => {
      try {
        const path = await writeTsvExport(config, exportDirectory, savedWords);
        addToast(`Wrote ${path}.`, 'success');
      } catch (error) {
        addToast(errorMessage(error), 'error');
      }
    },
  });

  return (
    <box
      id="library-panel"
      width="100%"
      flexDirection="column"
      rowGap={1}
      border
      borderStyle="single"
      borderColor={colorscheme.gutter}
      padding={1}
      title=" Library "
      titleColor={colorscheme.primary}
    >
      <text
        content={`Saved words: ${savedWords.length}`}
        fg={colorscheme.muted}
      />
      <text
        content={`TSV export: ${tsvExportPath(exportDirectory)}`}
        fg={colorscheme.muted}
      />
      <Separator />
      {savedWords.length ? (
        savedWords.map((word) => (
          <Button
            key={word.candidate.id}
            id={`library-word-${word.candidate.id}`}
            width="100%"
            label={`${word.candidate.expression}  ${word.candidate.reading ?? ''}  ${word.candidate.meanings.join('; ')}`}
            action={() =>
              navigate({
                id: 'word-detail',
                item: { kind: 'saved-word', value: word },
                returnTo: { id: 'library' },
              })
            }
          />
        ))
      ) : (
        <text content="No saved words yet." fg={colorscheme.muted} />
      )}
    </box>
  );
}
