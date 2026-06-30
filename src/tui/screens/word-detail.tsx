import type { TuiRouteTarget, ChatContextItem } from '../lib/types.js';

import { Button, Separator, WordDetails } from '../components/index.js';
import { useTuiApp } from '../lib/context/app.js';
import { colorscheme } from '../lib/theme.js';

export function WordDetailScreen({
  item,
  returnTo,
}: Readonly<{
  item: ChatContextItem;
  returnTo?: TuiRouteTarget | undefined;
}>) {
  const { navigate } = useTuiApp();
  return (
    <box
      id="word-detail-panel"
      width="100%"
      flexDirection="column"
      rowGap={1}
      border
      borderStyle="single"
      borderColor={colorscheme.gutter}
      padding={1}
      title=" Details "
      titleColor={colorscheme.primary}
    >
      <box flexDirection="row" columnGap={2}>
        <Button
          label="Back"
          action={() =>
            navigate(
              returnTo ?? (item.kind === 'saved-word' ? 'library' : 'mine')
            )
          }
        />
        <Button
          label="Chat"
          action={() =>
            navigate({
              id: 'chat',
              sessionId: `word-${item.kind}-${item.value.id}`,
              contexts: [item],
            })
          }
        />
      </box>
      <WordDetails item={item} />
    </box>
  );
}
