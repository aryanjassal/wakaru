import { useTuiApp } from '../lib/context/app.js';
import { colorscheme } from '../theme.js';

export function SettingsScreen() {
  const { config } = useTuiApp();

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
          `Provider: ${config.llm.provider}`,
          `Model: ${config.llm.model}`,
          `API base: ${config.llm.apiBase}`,
          `Words directory: ${config.storage.wordsDir}`,
          `Theme: ${config.theme.name}`,
          '',
          'Edit ~/.config/wakaru/config.json, then restart Wakaru.',
        ].join('\n')}
        wrapMode="word"
      />
    </box>
  );
}
