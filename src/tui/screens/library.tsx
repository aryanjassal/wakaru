import type { TuiState } from '../types.js';

import { ankiImportPath } from '@/core/storage.js';
import { savedWordRows } from '../format.js';
import { colorscheme } from '../theme.js';

type LibraryScreenProps = Readonly<{
  state: TuiState;
}>;

export function LibraryScreen({ state }: LibraryScreenProps) {
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
          `Saved words: ${state.savedWords.length}`,
          `Anki import: ${ankiImportPath(state.config)}`,
          '',
          savedWordRows(state.savedWords),
        ].join('\n')}
        wrapMode="word"
      />
    </box>
  );
}
