import type { ChatContextItem } from '../../lib/types.js';

import { colorscheme } from '../../lib/theme.js';

export function WordDetails({ item }: Readonly<{ item: ChatContextItem }>) {
  const metadata =
    item.kind === 'saved-word'
      ? [`Source: ${item.value.sourceText}`, `Created: ${item.value.createdAt}`]
      : [`Candidate status: ${item.value.status}`];
  const word = item.value;
  const fields = Object.entries(word.ankiFields).map(
    ([name, value]) => `${name}: ${value}`
  );

  return (
    <text
      width="100%"
      fg={colorscheme.text}
      wrapMode="word"
      content={[
        word.expression,
        word.reading,
        '',
        word.meaning,
        `In context: ${word.contextMeaning}`,
        `Part of speech: ${word.partOfSpeech}`,
        word.nuance ? `Nuance: ${word.nuance}` : '',
        '',
        word.exampleJapanese,
        word.exampleEnglish,
        '',
        `Tags: ${word.tags.join(' ') || 'none'}`,
        ...metadata,
        '',
        'Anki fields',
        ...fields,
      ]
        .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
        .join('\n')}
    />
  );
}
