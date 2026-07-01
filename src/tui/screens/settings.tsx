import { useTuiApp } from '../lib/context/app.js';
import { colorscheme } from '../lib/theme.js';

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
      <text>Provider: {config.llm.provider}</text>
      <text>Model: {config.llm.model}</text>
      <text>API Base: {config.llm.apiBase}</text>
      <text>Words directory: {config.storage.wordsDir}</text>
      <text></text>
      <text>Edit ~/.config/wakaru/config.json, then restart Wakaru.</text>
    </box>
  );
}
