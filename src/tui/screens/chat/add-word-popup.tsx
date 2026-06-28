import type { InputRenderable, ScrollBoxRenderable } from '@opentui/core';
import type { SavedWord } from '@/core/types.js';

import { TextAttributes } from '@opentui/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '../../components/index.js';
import { colorscheme } from '../../lib/theme.js';
import { filterSavedWords } from './utils.js';

function rowId(word: SavedWord): string {
  return `add-word-${word.id}`;
}

export function AddWordPopup({
  words,
  selectedIds,
  onAdd,
  onClose,
}: Readonly<{
  words: readonly SavedWord[];
  selectedIds: ReadonlySet<string>;
  onAdd: (word: SavedWord) => void;
  onClose: () => void;
}>) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<InputRenderable>(null);
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const visibleWords = useMemo(
    () => filterSavedWords(words, query),
    [query, words]
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (selectedIndex < visibleWords.length) return;
    setSelectedIndex(Math.max(0, visibleWords.length - 1));
  }, [selectedIndex, visibleWords.length]);

  useEffect(() => {
    const word = visibleWords[selectedIndex];
    if (word) scrollRef.current?.scrollChildIntoView(rowId(word));
  }, [selectedIndex, visibleWords]);

  return (
    <box
      position="absolute"
      left="10%"
      top={1}
      bottom={1}
      zIndex={80}
      width="80%"
      flexDirection="column"
      rowGap={1}
      border
      borderStyle="single"
      borderColor={colorscheme.primary}
      backgroundColor={colorscheme.bg}
      padding={1}
      title=" Add word to context "
      titleColor={colorscheme.primary}
    >
      <Input
        ref={inputRef}
        id="chat-add-word-search"
        label="Search"
        value={query}
        placeholder="Japanese, reading, romaji, or meaning"
        onInput={setQuery}
        onKeyDown={(key) => {
          if (key.name === 'escape') {
            key.preventDefault();
            onClose();
          } else if (key.name === 'up') {
            key.preventDefault();
            setSelectedIndex((index) =>
              visibleWords.length
                ? (index - 1 + visibleWords.length) % visibleWords.length
                : 0
            );
          } else if (key.name === 'down') {
            key.preventDefault();
            setSelectedIndex((index) =>
              visibleWords.length ? (index + 1) % visibleWords.length : 0
            );
          } else if (key.name === 'return') {
            key.preventDefault();
            const word = visibleWords[selectedIndex];
            if (word) onAdd(word);
          }
        }}
      />
      <scrollbox
        ref={scrollRef}
        width="100%"
        flexGrow={1}
        flexBasis={0}
        minHeight={1}
        scrollY
        scrollX={false}
      >
        {visibleWords.length ? (
          visibleWords.map((word, index) => (
            <box
              key={word.id}
              id={rowId(word)}
              width="100%"
              height={1}
              backgroundColor={
                index === selectedIndex
                  ? colorscheme.bgHighlight
                  : colorscheme.bg
              }
              onMouseOver={() => setSelectedIndex(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                onAdd(word);
              }}
            >
              <text
                height={1}
                content={`${selectedIds.has(word.id) ? '[x]' : '[ ]'} ${word.expression}  ${word.reading}  ${word.meaning}`}
                fg={
                  selectedIds.has(word.id)
                    ? colorscheme.green
                    : index === selectedIndex
                      ? colorscheme.primary
                      : colorscheme.text
                }
                attributes={
                  index === selectedIndex
                    ? TextAttributes.BOLD
                    : TextAttributes.NONE
                }
                selectable={false}
              />
            </box>
          ))
        ) : (
          <text content="No matching saved words." fg={colorscheme.muted} />
        )}
      </scrollbox>
    </box>
  );
}
