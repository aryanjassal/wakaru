import { ankiImportPath, writeAnkiImport } from '@/core/storage.js';
import { useTuiApp, useTuiCommand } from '../lib/context/app.js';
import { savedWordRows } from '../lib/utils.js';
import { colorscheme } from '../lib/theme.js';

const LIBRARY_COMMAND_IDS = {
  exportAnki: 'library.exportAnki',
} as const;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function LibraryScreen() {
  const { addToast, config, savedWords } = useTuiApp();

  useTuiCommand({
    id: LIBRARY_COMMAND_IDS.exportAnki,
    title: 'Export Anki import file',
    keybindings: [{ key: 'e', ctrl: true }],
    run: async () => {
      try {
        const path = await writeAnkiImport(config, savedWords);
        addToast(`Wrote ${path}.`, 'success');
      } catch (error) {
        addToast(errorMessage(error), 'error');
      }
    },
  });

  return (
    <box
      id="library-panel"
      flexGrow={1}
      width="100%"
      flexDirection="column"
      border
      borderStyle="single"
      borderColor={colorscheme.gutter}
      padding={1}
      title="Library"
      titleColor={colorscheme.primary}
    >
      <text
        id="library-text"
        flexGrow={1}
        fg={colorscheme.text}
        content={[
          `Saved words: ${savedWords.length}`,
          `Anki import: ${ankiImportPath(config)}`,
          '',
          savedWordRows(savedWords),
        ].join('\n')}
        wrapMode="word"
      />
    </box>
  );
}
