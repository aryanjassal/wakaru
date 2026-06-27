import type { InputRenderable, TextareaRenderable } from '@opentui/core';
import type { MineState } from './types.js';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/tui/components/button.js';
import { MINE_COMMAND_IDS, useMineCommands } from './commands.js';
import {
  candidateDetailText,
  candidateRows,
  createInitialMineState,
} from './utils.js';
import { colorscheme } from '../../theme.js';
import { Input } from '@/tui/components/input.js';
import { Textarea } from '@/tui/components/textarea.js';

export function MineScreen() {
  const [state, setState] = useState(createInitialMineState);
  const stateRef = useRef(state);
  const contextRef = useRef<TextareaRenderable>(null);
  const wordRef = useRef<InputRenderable>(null);

  const setMineState = useCallback(
    (update: (state: MineState) => MineState) => {
      const next = update(stateRef.current);
      stateRef.current = next;
      setState(next);
    },
    []
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    wordRef.current?.focus();
  }, []);

  useMineCommands({
    stateRef,
    contextRef,
    wordRef,
    setMineState,
  });

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
      <Input
        label="Word"
        ref={wordRef}
        id="mine-word"
        value={state.wordText}
        placeholder="Selected word"
      />
      <box flexDirection="row" width="100%" columnGap={2}>
        <Button
          label="Paste"
          commandIdOrAction={MINE_COMMAND_IDS.pasteClipboard}
        />
        <Button
          label="Analyze"
          commandIdOrAction={MINE_COMMAND_IDS.analyzeWord}
        />
        <Button label="Clear" commandIdOrAction={MINE_COMMAND_IDS.clear} />
      </box>
      <text
        height={1}
        fg={state.status === 'error' ? colorscheme.danger : colorscheme.muted}
        content={`${state.status.toUpperCase()} · ${state.statusMessage}`}
      />
      <Textarea
        label="Context"
        ref={contextRef}
        id="mine-context"
        height={2}
        initialValue={state.contextText}
        placeholder="Optional context sentence"
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
