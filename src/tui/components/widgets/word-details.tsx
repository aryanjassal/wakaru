import type { ChatContextItem } from '@/tui/lib/types.js';

import { colorscheme } from '@/tui/lib/theme.js';
import { Separator } from '../primitives/separator.js';

export function WordDetails({ item }: Readonly<{ item: ChatContextItem }>) {
  const metadata =
    item.kind === 'saved-word'
      ? { Source: item.value.sourceText, Created: item.value.createdAt }
      : { Status: item.value.status };
  const word = item.value;

  return (
    <>
      <Separator title=" Word " titleColor={colorscheme.muted} />
      <box>
        <text>{word.expression}</text>
        <text>{word.reading}</text>
      </box>
      <Separator title=" Details " titleColor={colorscheme.muted} />
      <box flexDirection="row" columnGap={3}>
        <box>
          <text>Meaning</text>
          <text>In context</text>
          <text>Part of speech</text>
          {word.nuance ? <text>Nuance</text> : null}
          {Object.keys(metadata).map((v, i) => (
            <text key={i}>{v}</text>
          ))}
        </box>
        <box>
          <text>{word.meaning}</text>
          <text>{word.contextMeaning}</text>
          <text>{word.partOfSpeech}</text>
          {word.nuance ? <text>{word.nuance}</text> : null}
          {Object.values(metadata).map((v, i) => (
            <text key={i}>{v}</text>
          ))}
        </box>
      </box>
      <Separator title=" Anki Fields " titleColor={colorscheme.muted} />
      <box flexDirection="row" columnGap={3}>
        <box>
          {Object.keys(word.ankiFields).map((v, i) => (
            <text key={i}>{v}</text>
          ))}
        </box>
        <box>
          {Object.values(word.ankiFields).map((v, i) => (
            <text key={i}>{v}</text>
          ))}
        </box>
      </box>
    </>
  );
}
