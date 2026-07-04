import type { InputRenderable, TextareaRenderable } from '@opentui/core';
import type { MineState } from './types.js';

import { useCallback, useEffect, useRef } from 'react';
import { Button, Input, Loader, Separator, Textarea } from '../../components';
import { MINE_COMMAND_IDS, useMineCommands } from './commands.js';
import { colorscheme } from '../../lib/theme.js';
import { usePersistentRouteState } from '../../lib/context/app.js';
import { candidateDetailText, createInitialMineState } from './utils.js';
import { Candidate } from '@/tui/components/widgets/candidate.js';

function MineStatus({ status }: Readonly<{ status: MineState['status'] }>) {
  switch (status) {
    case 'analysing':
      return <Loader label="ANALYSING" />;
    case 'saving':
      return <text height={1} fg={colorscheme.info} content="SAVING" />;
    case 'error':
      return <text height={1} fg={colorscheme.danger} content="ERROR" />;
    case 'idle':
      return <text height={1} fg={colorscheme.muted} content="IDLE" />;
  }
}

export function MineScreen() {
  const [state, setState] = usePersistentRouteState(
    'mine',
    createInitialMineState
  );
  const stateRef = useRef(state);
  const contextRef = useRef<TextareaRenderable>(null);
  const wordRef = useRef<InputRenderable>(null);

  // Updates state for both the reference and the real state
  const setMineState = useCallback(
    (update: (state: MineState) => MineState) => {
      const next = update(stateRef.current);
      stateRef.current = next;
      setState(next);
    },
    []
  );

  // Synchronize stateRef and state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Dynamically register page commands
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
      <Input
        label="Word"
        ref={wordRef}
        id="mine-word"
        value={state.wordText}
        placeholder="Selected word"
        onInput={(wordText) =>
          setMineState((current) => ({ ...current, wordText }))
        }
      />
      <box flexDirection="row" width="100%" columnGap={2}>
        <Button
          label="Paste"
          action={(ctx) =>
            ctx.runCommand(MINE_COMMAND_IDS.pasteClipboardAsWord)
          }
        />
        <Button
          label="Clear"
          action={(ctx) => ctx.runCommand(MINE_COMMAND_IDS.clearWord)}
        />
      </box>
      <Separator />
      {state.showContext && (
        <>
          <box rowGap={1}>
            <Textarea
              label="Context"
              ref={contextRef}
              id="mine-context"
              height={2}
              initialValue={state.contextText}
              placeholder="Optional context sentence"
              wrapMode="word"
              onContentChange={() => {
                const contextText = contextRef.current?.plainText ?? '';
                setMineState((current) => ({ ...current, contextText }));
              }}
            />
            <box flexDirection="row" width="100%" columnGap={2}>
              <Button
                label="Paste"
                action={(ctx) =>
                  ctx.runCommand(MINE_COMMAND_IDS.pasteClipboardAsContext)
                }
              />
              <Button
                label="Clear"
                action={(ctx) => ctx.runCommand(MINE_COMMAND_IDS.clearContext)}
              />
            </box>
          </box>
          <Separator />
        </>
      )}
      <box width="100%" flexDirection="row" columnGap={2}>
        <Button
          label="Analyse"
          action={(ctx) => ctx.runCommand(MINE_COMMAND_IDS.analyseWord)}
        />
        <Button
          label="Chat"
          action={(ctx) => ctx.runCommand(MINE_COMMAND_IDS.chatSelected)}
        />
      </box>
      <MineStatus status={state.status} />
      <box rowGap={1}>
        {state.candidates.length ? (
          state.candidates.map((candidate, i) => (
            <Candidate
              key={i}
              candidate={candidate}
              focused={candidate.id === state.selectedCandidateId}
              addedCandidateIds={state.addedCandidateIds}
            />
          ))
        ) : (
          <text>No candidates yet.</text>
        )}
      </box>
      {/* <text
        id="candidate-list"
        flexShrink={0}
        width="100%"
        fg={colorscheme.text}
        content={candidateRows(state)}
        wrapMode="word"
      /> */}
      <text
        id="candidate-detail"
        width="100%"
        fg={colorscheme.muted}
        content={candidateDetailText(state)}
        wrapMode="word"
      />
    </box>
  );
}
