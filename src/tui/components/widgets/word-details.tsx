import type { ChatContextItem } from '@/tui/lib/types.js';

import { colorscheme } from '@/tui/lib/theme.js';
import { Separator } from '../primitives/separator.js';
import { FormattedText } from './formatted-text.js';

export function WordDetails({ item }: Readonly<{ item: ChatContextItem }>) {
  const metadata =
    item.kind === 'saved-word'
      ? { Source: item.value.sourceText, Created: item.value.createdAt }
      : {};
  const candidate =
    item.kind === 'saved-word' ? item.value.candidate : item.value;

  return (
    <>
      <Separator title=" Word " titleColor={colorscheme.muted} />
      <box>
        <text>{candidate.expression}</text>
        <text>{candidate.reading ?? ''}</text>
      </box>
      <Separator title=" Details " titleColor={colorscheme.muted} />
      <box flexDirection="row" columnGap={3}>
        <box>
          <text>Meaning</text>
          {candidate.details?.contextMeaning ? <text>In context</text> : null}
          {candidate.details?.partOfSpeech?.length ? (
            <text>Part of speech</text>
          ) : null}
          {candidate.details?.nuance ? <text>Nuance</text> : null}
          {Object.keys(metadata).map((v, i) => (
            <text key={i}>{v}</text>
          ))}
        </box>
        <box>
          <text>{candidate.meanings.join('; ')}</text>
          {candidate.details?.contextMeaning ? (
            <text>{candidate.details.contextMeaning}</text>
          ) : null}
          {candidate.details?.partOfSpeech?.length ? (
            <text>{candidate.details.partOfSpeech.join(', ')}</text>
          ) : null}
          {candidate.details?.nuance ? (
            <text>{candidate.details.nuance}</text>
          ) : null}
          {Object.values(metadata).map((v, i) => (
            <text key={i}>{v}</text>
          ))}
        </box>
      </box>
      <Separator title=" Export Fields " titleColor={colorscheme.muted} />
      <box flexDirection="row" columnGap={3}>
        <box>
          {Object.keys(candidate.extension?.exportFields ?? {}).map((v, i) => (
            <text key={i}>{v}</text>
          ))}
        </box>
        <box>
          {Object.values(candidate.extension?.exportFields ?? {}).map(
            (v, i) => (
              <FormattedText key={i} value={v} />
            )
          )}
        </box>
      </box>
    </>
  );
}
