import type { InputRenderable, TextareaRenderable } from '@opentui/core';
import type { RefObject } from 'react';
import type { InputSnapshot, MineState } from './types.js';
import type { TuiCommandAvailability } from '../../commands.js';
import type { SavedWord } from '../../types.js';

import { useCallback } from 'react';
import { analyzeWithOllama } from '@/core/llm.js';
import { candidateToSavedWord, saveWord } from '@/core/storage.js';
import { useTuiApp, useTuiCommand } from '../../app-context.js';
import { errorMessage, readClipboard } from '../../lib/utils.js';
import {
  clearMineState,
  markCandidate,
  selectedCandidate,
  selectedIndex,
  setCandidates,
  setError,
  setStatus,
  toggleCandidateInbox,
} from './utils.js';

export const MINE_COMMAND_IDS = {
  analyzeWord: 'mine.analyzeWord',
  clear: 'mine.clear',
  pasteClipboard: 'mine.pasteClipboard',
  toggleDetails: 'mine.toggleDetails',
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

  const currentInputSnapshot = useCallback((): InputSnapshot => {
    return {
      contextText:
        contextRef.current?.plainText ?? stateRef.current.contextText,
      wordText: wordRef.current?.value ?? stateRef.current.wordText,
    };
  }, [contextRef, stateRef, wordRef]);

  const syncInputs = useCallback((): InputSnapshot => {
    const snapshot = currentInputSnapshot();
    setMineState((current) => ({
      ...current,
      contextText: snapshot.contextText,
      wordText: snapshot.wordText,
    }));
    return snapshot;
  }, [currentInputSnapshot, setMineState]);

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

    setMineState((state) => setStatus(state, 'analyzing', 'Analyzing word...'));

    try {
      const candidates = await analyzeWithOllama(config, word, { contextText });
      setMineState((state) => setCandidates(state, candidates));
      addToast(
        `Found ${candidates.length} meaning${candidates.length === 1 ? '' : 's'}.`,
        'success'
      );
    } catch (error) {
      const message = errorMessage(error);
      setMineState((state) => setError(state, message));
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

    setMineState((state) =>
      setStatus(state, 'saving', `Saving ${candidate.expression}...`)
    );

    try {
      const sourceText =
        snapshot.contextText.trim() || snapshot.wordText.trim();
      const word: SavedWord = candidateToSavedWord(candidate, sourceText);
      await saveWord(config, word);
      addSavedWord(word);
      setMineState((state) =>
        setStatus(
          markCandidate(state, candidate.id, 'added'),
          'idle',
          `${candidate.expression} saved to Anki import file.`
        )
      );
      addToast(`Saved ${candidate.expression}.`, 'success');
    } catch (error) {
      const message = errorMessage(error);
      setMineState((state) => setError(state, message));
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

  const clearMine = useCallback((): void => {
    if (wordRef.current) wordRef.current.value = '';
    if (contextRef.current) contextRef.current.initialValue = '';
    setMineState(clearMineState);
  }, [contextRef, setMineState, wordRef]);

  const pasteClipboard = useCallback((): void => {
    const text = readClipboard();
    if (!text) {
      addToast('Clipboard is unavailable.', 'warning');
      return;
    }

    if (wordRef.current) wordRef.current.value = text;
    setMineState((state) => ({ ...state, wordText: text }));
  }, [addToast, setMineState, wordRef]);

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

  useTuiCommand({
    id: MINE_COMMAND_IDS.analyzeWord,
    title: 'Analyze word',
    keybindings: [{ key: 'a', ctrl: true }],
    run: analyzeWord,
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.pasteClipboard,
    title: 'Paste clipboard',
    run: pasteClipboard,
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.clear,
    title: 'Clear mine input',
    keybindings: [{ key: 'c' }],
    run: clearMine,
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
