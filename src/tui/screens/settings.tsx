import type { WakaruState } from '../types.js';

import { colorscheme } from '../theme.js';

type SettingsScreenProps = Readonly<{
  state: WakaruState;
}>;

export function SettingsScreen({ state }: SettingsScreenProps) {
  return (
    <box
      id="settings-panel"
      flexGrow={1}
      width="100%"
      flexDirection="column"
      border
      borderStyle="single"
      borderColor={colorscheme.gutter}
      padding={1}
      title="Settings"
      titleColor={colorscheme.primary}
    >
      <text
        id="settings-text"
        flexGrow={1}
        fg={colorscheme.text}
        content={[
          `Provider: ${state.config.llm.provider}`,
          `Model: ${state.config.llm.model}`,
          `API base: ${state.config.llm.apiBase}`,
          `Words directory: ${state.config.storage.wordsDir}`,
          `Theme: ${state.config.theme.name}`,
          '',
          'Edit ~/.config/wakaru/config.json, then restart Wakaru.',
        ].join('\n')}
        wrapMode="word"
      />
    </box>
  );
}
