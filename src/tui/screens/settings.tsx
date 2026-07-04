import { useTuiApp } from '../lib/context/app.js';
import { colorscheme } from '../lib/theme.js';

export function SettingsScreen() {
  const { config, exportDirectory } = useTuiApp();

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
      <text>Model: {config.model.name}</text>
      <text>API Base: {config.model.apiBase ?? 'provider default'}</text>
      <text>Export directory: {exportDirectory}</text>
      <text></text>
      <text>Edit ~/.config/wakaru/config.json, then restart Wakaru.</text>
    </box>
  );
}
