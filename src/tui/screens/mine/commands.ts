import type { InputRenderable, TextareaRenderable } from '@opentui/core';
import type { RefObject } from 'react';
import type { TuiCommandAvailability } from '@/tui/commands';
import type { SavedWord } from '@/tui/lib/types';
import type { InputSnapshot, MineState } from './types';

import { useCallback } from 'react';
import { analyzeWithOllama } from '@/core/llm';
import { candidateToSavedWord, saveWord } from '@/core/storage';
import { useTuiApp, useTuiCommand } from '@/tui/lib/context/app';
import { errorMessage, readClipboard } from '@/tui/lib/utils';
import {
  clearMineState,
  markCandidate,
  selectedCandidate,
  selectedIndex,
  setCandidates,
  toggleCandidateInbox,
} from './utils';

// List of command identifiers implemented by this page. Simplifies command
// invocation by not requiring memorisation of stringified command identifiers.
export const MINE_COMMAND_IDS = {
  analyzeWord: 'mine.analyzeWord',
  clearWord: 'mine.clearWord',
  clearContext: 'mine.clearContext',
  pasteClipboardAsWord: 'mine.pasteClipboardAsWord',
  pasteClipboardAsContext: 'mine.pasteClipboardAsContext',
  toggleDetails: 'mine.toggleDetails',
  toggleContext: 'mine.toggleContext',
  candidatePrevious: 'candidate.previous',
  candidateNext: 'candidate.next',
  candidateAddSelected: 'candidate.addSelected',
  candidateSkipSelected: 'candidate.skipSelected',
} as const;

export type MineStateUpdater = (
  update: (state: MineState) => MineState
) => void;

export type MineCommandDeps = Readonly<{
  stateRef: RefObject<MineState>;
  contextRef: RefObject<TextareaRenderable | null>;
  wordRef: RefObject<InputRenderable | null>;
  setMineState: MineStateUpdater;
}>;

export function useMineCommands({
  stateRef,
  contextRef,
  wordRef,
  setMineState,
}: MineCommandDeps): void {
  const { addSavedWord, addToast, config } = useTuiApp();

  // const currentInputSnapshot = useCallback((): InputSnapshot => {
  //   return {
  //     contextText:
  //       contextRef.current?.plainText ?? stateRef.current.contextText,
  //     wordText: wordRef.current?.value ?? stateRef.current.wordText,
  //   };
  // }, [contextRef, stateRef, wordRef]);

  const syncInputs = useCallback((): InputSnapshot => {
    const snapshot = {
      contextText: contextRef.current?.plainText ?? '',
      wordText: wordRef.current?.value ?? '',
    };
    setMineState((current) => ({
      ...current,
      ...snapshot,
    }));
    return snapshot;
  }, [contextRef, wordRef, setMineState]);

  const selectedCandidateRequired = useCallback((): TuiCommandAvailability => {
    if (!stateRef.current.selectedCandidateId) {
      return { status: 'disabled', reason: 'No word meaning is selected.' };
    }
    return { status: 'available' };
  }, [stateRef]);

  const analyzeWord = useCallback(async (): Promise<void> => {
    const snapshot = syncInputs();
    const current = stateRef.current;
    const word = snapshot.wordText.trim();
    const contextText = snapshot.contextText.trim();
    if (
      !word ||
      current.status === 'analyzing' ||
      current.status === 'saving'
    ) {
      return;
    }

    setMineState((state) => ({ ...state, status: 'analyzing' }));

    try {
      const candidates = await analyzeWithOllama(config, word, { contextText });
      setMineState((state) => setCandidates(state, candidates));
      addToast(
        `Found ${candidates.length} meaning${candidates.length === 1 ? '' : 's'}.`,
        'success'
      );
    } catch (error) {
      const message = errorMessage(error);
      setMineState((state) => ({ ...state, status: 'error' }));
      addToast(message, 'error');
    }
  }, [addToast, config, setMineState, stateRef, syncInputs]);

  const addSelectedCandidate = useCallback(async (): Promise<void> => {
    const snapshot = syncInputs();
    const current = stateRef.current;
    const candidate = selectedCandidate(current);
    if (
      !candidate ||
      candidate.status === 'added' ||
      candidate.status === 'skipped' ||
      current.status === 'saving'
    ) {
      return;
    }

    setMineState((state) => ({ ...state, status: 'saving' }));

    try {
      const sourceText =
        snapshot.contextText.trim() || snapshot.wordText.trim();
      const word: SavedWord = candidateToSavedWord(candidate, sourceText);
      await saveWord(config, word);
      addSavedWord(word);
      setMineState((state) => ({
        ...markCandidate(state, candidate.id, 'added'),
        status: 'idle',
      }));
      addToast(`Saved ${candidate.expression}.`, 'success');
    } catch (error) {
      const message = errorMessage(error);
      setMineState((state) => ({ ...state, status: 'error' }));
      addToast(message, 'error');
    }
  }, [addSavedWord, addToast, config, setMineState, stateRef, syncInputs]);

  const skipSelectedCandidate = useCallback((): void => {
    const candidate = selectedCandidate(stateRef.current);
    if (!candidate || candidate.status === 'added') return;

    setMineState((state) => toggleCandidateInbox(state, candidate.id));
    addToast(
      candidate.status === 'skipped'
        ? `${candidate.expression} back in inbox.`
        : `${candidate.expression} removed from inbox.`,
      candidate.status === 'skipped' ? 'info' : 'warning'
    );
  }, [addToast, setMineState, stateRef]);

  const clearWord = useCallback((): void => {
    if (wordRef.current) wordRef.current.value = '';
    setMineState((state) => ({
      ...clearMineState(state),
      wordText: '',
    }));
  }, [setMineState, wordRef]);

  const clearContext = useCallback((): void => {
    if (contextRef.current) contextRef.current.clear();
    setMineState((state) => ({
      ...clearMineState(state),
      contextText: '',
    }));
  }, [setMineState, wordRef]);

  const pasteClipboardAsWord = useCallback((): void => {
    const text = readClipboard();
    if (!text) {
      addToast('Clipboard is unavailable.', 'warning');
      return;
    }

    if (wordRef.current) wordRef.current.value = text;
    setMineState((state) => ({ ...state, wordText: text }));
  }, [addToast, setMineState, wordRef]);

  const pasteClipboardAsContext = useCallback((): void => {
    const text = readClipboard();
    if (!text) {
      addToast('Clipboard is unavailable.', 'warning');
      return;
    }

    if (contextRef.current) contextRef.current.setText(text);
    setMineState((state) => ({ ...state, contextText: text }));
  }, [addToast, setMineState, contextRef]);

  const selectCandidateOffset = useCallback(
    (offset: 1 | -1): void => {
      const current = stateRef.current;
      if (!current.candidates.length) return;
      const index = selectedIndex(
        current.candidates,
        current.selectedCandidateId
      );
      const safeIndex = index < 0 ? 0 : index;
      const next =
        current.candidates[
          (safeIndex + offset + current.candidates.length) %
            current.candidates.length
        ];
      setMineState((state) => ({
        ...state,
        selectedCandidateId: next?.id ?? null,
      }));
    },
    [setMineState, stateRef]
  );

  const toggleDetails = useCallback((): void => {
    setMineState((state) => ({ ...state, showDetails: !state.showDetails }));
  }, [setMineState]);

  const toggleContext = useCallback((): void => {
    setMineState((state) => ({ ...state, showContext: !state.showContext }));
  }, [setMineState]);

  useTuiCommand({
    id: MINE_COMMAND_IDS.analyzeWord,
    title: 'Analyze word',
    keybindings: [{ key: 'a', ctrl: true }],
    run: analyzeWord,
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.pasteClipboardAsWord,
    title: 'Paste clipboard as Word',
    run: pasteClipboardAsWord,
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.pasteClipboardAsContext,
    title: 'Paste clipboard as Context',
    run: pasteClipboardAsContext,
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.clearWord,
    title: 'Clear input word',
    keybindings: [{ key: 'c' }],
    run: clearWord,
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.clearContext,
    title: 'Clear context sentence',
    keybindings: [{ key: 'c', shift: true }],
    run: clearContext,
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.toggleContext,
    title: 'Toggle context visibility',
    keybindings: [{ key: 'v' }],
    run: toggleContext,
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.candidatePrevious,
    title: 'Previous candidate',
    keybindings: [{ key: 'up' }],
    availability: selectedCandidateRequired,
    run: () => selectCandidateOffset(-1),
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.candidateNext,
    title: 'Next candidate',
    keybindings: [{ key: 'down' }],
    availability: selectedCandidateRequired,
    run: () => selectCandidateOffset(1),
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.candidateAddSelected,
    title: 'Add selected candidate',
    keybindings: [{ key: 'return' }],
    availability: selectedCandidateRequired,
    run: addSelectedCandidate,
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.candidateSkipSelected,
    title: 'Skip selected candidate',
    keybindings: [{ key: 'x' }],
    availability: selectedCandidateRequired,
    run: skipSelectedCandidate,
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.toggleDetails,
    title: 'Toggle candidate details',
    keybindings: [{ key: 'd' }],
    availability: selectedCandidateRequired,
    run: toggleDetails,
  });
}
