import type { InputRenderable, TextareaRenderable } from '@opentui/core';
import type { RefObject } from 'react';
import type { WakaruState } from '../types.js';

import { candidateDetailText, candidateRows } from '../format.js';
import { colorscheme } from '../theme.js';

export type MineInputRefs = Readonly<{
  input: RefObject<TextareaRenderable | null>;
  context: RefObject<TextareaRenderable | null>;
  customWord: RefObject<InputRenderable | null>;
}>;

type MineScreenProps = Readonly<{
  state: WakaruState;
  refs: MineInputRefs;
}>;

export function MineScreen({ state, refs }: MineScreenProps) {
  return (
    <box
      id="mine-panel"
      flexGrow={1}
      width="100%"
      flexDirection="column"
      rowGap={1}
      border
      borderStyle="single"
      borderColor={colorscheme.gutter}
      padding={1}
      title=" Mine "
      titleColor={colorscheme.primary}
    >
      <text
        height={1}
        fg={colorscheme.muted}
        content="Define words and save them for studying later"
      />
      <input
        ref={refs.customWord}
        id="mine-word"
        width="100%"
        value={state.wordText}
        placeholder="Selected word"
        backgroundColor={colorscheme.bgDark}
        focusedBackgroundColor={colorscheme.bgSecondary}
        textColor={colorscheme.text}
        cursorColor={colorscheme.primary}
      />
      <box flexDirection="row" width="100%" columnGap={2}>
        <text content=" Paste " bg={colorscheme.bgHighlight} />
        <text content=" Analyze " bg={colorscheme.bgHighlight} />
        <text content=" Clear " bg={colorscheme.bgHighlight} />
      </box>
      <textarea
        ref={refs.context}
        id="mine-context"
        height={2}
        width="100%"
        initialValue={state.contextText}
        placeholder="Optional context sentence"
        backgroundColor={colorscheme.bgDark}
        focusedBackgroundColor={colorscheme.bgSecondary}
        textColor={colorscheme.text}
        cursorColor={colorscheme.primary}
        wrapMode="word"
      />
      <text
        id="candidate-list"
        flexGrow={1}
        width="100%"
        fg={colorscheme.text}
        content={candidateRows(state)}
        wrapMode="word"
      />
      <text
        id="candidate-detail"
        width="100%"
        height={10}
        fg={colorscheme.muted}
        content={candidateDetailText(state)}
        wrapMode="word"
      />
    </box>
  );
}
