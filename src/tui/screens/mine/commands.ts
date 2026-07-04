import type { InputRenderable, TextareaRenderable } from '@opentui/core';
import type { RefObject } from 'react';
import type { TuiCommandAvailability } from '@/tui/commands';
import type { SavedWord } from '@/tui/lib/types';
import type { InputSnapshot, MineState } from './types';

import { useCallback } from 'react';
import { candidateToSavedWord } from '@/client/storage/words';
import { useTuiApp, useTuiCommand } from '@/tui/lib/context/app';
import { errorMessage, readClipboard } from '@/tui/lib/utils';
import {
  clearMineState,
  markCandidate,
  selectedCandidate,
  selectedIndex,
  setCandidates,
} from './utils';

// List of command identifiers implemented by this page. Simplifies command
// invocation by not requiring memorisation of stringified command identifiers.
export const MINE_COMMAND_IDS = {
  analyseWord: 'mine.analyseWord',
  chatSelected: 'mine.chatSelected',
  clearWord: 'mine.clearWord',
  clearContext: 'mine.clearContext',
  pasteClipboardAsWord: 'mine.pasteClipboardAsWord',
  pasteClipboardAsContext: 'mine.pasteClipboardAsContext',
  toggleDetails: 'mine.toggleDetails',
  toggleContext: 'mine.toggleContext',
  candidatePrevious: 'candidate.previous',
  candidateNext: 'candidate.next',
  candidateAddSelected: 'candidate.addSelected',
  candidateAddSelectedDirect: 'candidate.addSelectedDirect',
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

// Register commands for the mine page
export function useMineCommands({
  stateRef,
  contextRef,
  wordRef,
  setMineState,
}: MineCommandDeps): void {
  const { addToast, config, navigate, wakaru, wordStore } = useTuiApp();

  // Synchronise page state to input state
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

  // Requires a candidate to be selected in order for a command to be usable
  const selectedCandidateRequired = useCallback((): TuiCommandAvailability => {
    if (!stateRef.current.selectedCandidateId) {
      return { status: 'disabled', reason: 'No word meaning is selected.' };
    }
    return { status: 'available' };
  }, [stateRef]);

  const chatAvailable = useCallback((): TuiCommandAvailability => {
    const selected = selectedCandidateRequired();
    if (selected.status === 'disabled') return selected;
    if (!wakaru.llmAvailable) {
      return {
        status: 'disabled',
        reason: 'Chat is unavailable while Wakaru is offline.',
      };
    }
    return { status: 'available' };
  }, [selectedCandidateRequired, wakaru]);

  // Use a LLM to analyse the selected word, including the context if provided
  const analyseWord = useCallback(async (): Promise<void> => {
    const snapshot = syncInputs();
    const current = stateRef.current;
    const word = snapshot.wordText.trim();
    const contextText = snapshot.contextText.trim();
    if (
      !word ||
      current.status === 'analysing' ||
      current.status === 'saving'
    ) {
      return;
    }

    setMineState((state) => ({ ...state, status: 'analysing' }));

    // Analyse word if possible, otherwise bail out and inform user
    try {
      const result = await wakaru.analyseVocabulary({
        expression: word,
        ...(contextText ? { context: contextText } : {}),
      });
      const candidates = result.candidates;
      const saved = candidates.map((candidate) => wordStore.isSaved(candidate));
      const addedCandidateIds = new Set(
        candidates
          .filter((_candidate, index) => saved[index])
          .map((candidate) => candidate.id)
      );
      setMineState((state) =>
        setCandidates(state, candidates, addedCandidateIds)
      );
      if (contextText && !wakaru.llmAvailable) {
        addToast(
          'Context ranking is unavailable while Wakaru is offline.',
          'warning'
        );
      }
      addToast(
        `Found ${candidates.length} meaning${candidates.length === 1 ? '' : 's'}`,
        'success'
      );
    } catch (error) {
      const message = errorMessage(error);
      setMineState((state) => ({ ...state, status: 'error' }));
      addToast(message, 'error');
    }
  }, [addToast, setMineState, stateRef, syncInputs, wakaru, wordStore]);

  // Add the selected candidate to inbox
  const addSelectedCandidate = useCallback(
    async (useModel: boolean): Promise<void> => {
      const snapshot = syncInputs();
      const current = stateRef.current;
      const candidate = selectedCandidate(current);
      if (
        !candidate ||
        current.addedCandidateIds.has(candidate.id) ||
        current.status === 'saving'
      ) {
        return;
      }

      setMineState((state) => ({ ...state, status: 'saving' }));

      try {
        const sourceText =
          snapshot.contextText.trim() || snapshot.wordText.trim();
        const prepared = useModel
          ? await wakaru.prepareVocabulary(candidate, sourceText)
          : candidate;
        const word: SavedWord = candidateToSavedWord(
          prepared,
          sourceText,
          config
        );
        wordStore.save(word);
        setMineState((state) => ({
          ...markCandidate(state, candidate.id),
          status: 'idle',
        }));
        addToast(
          `Saved ${candidate.expression}${useModel ? '' : ' without LLM processing'}.`,
          'success'
        );
      } catch (error) {
        const message = errorMessage(error);
        setMineState((state) => ({ ...state, status: 'error' }));
        addToast(message, 'error');
      }
    },
    [addToast, config, setMineState, stateRef, syncInputs, wakaru, wordStore]
  );

  // Clear the word input along with any related results
  const clearWord = useCallback((): void => {
    if (wordRef.current) wordRef.current.value = '';
    setMineState((state) => ({
      ...clearMineState(state),
      wordText: '',
    }));
  }, [setMineState, wordRef]);

  // Clear the context sentence input along with any related results
  const clearContext = useCallback((): void => {
    if (contextRef.current) contextRef.current.clear();
    setMineState((state) => ({
      ...clearMineState(state),
      contextText: '',
    }));
  }, [setMineState, wordRef]);

  // Paste clipboard contents into the word input. Note that the text replaces
  // existing input.
  const pasteClipboardAsWord = useCallback((): void => {
    const text = readClipboard();
    if (!text) {
      addToast('Clipboard unavailable', 'warning');
      return;
    }
    if (wordRef.current) wordRef.current.value = text;
    setMineState((state) => ({ ...state, wordText: text }));
  }, [addToast, setMineState, wordRef]);

  // Paste clipboard contents into the context sentence input. Note that the
  // text replaces existing input.
  const pasteClipboardAsContext = useCallback((): void => {
    const text = readClipboard();
    if (!text) {
      addToast('Clipboard unavailable', 'warning');
      return;
    }
    if (contextRef.current) contextRef.current.setText(text);
    setMineState((state) => ({ ...state, contextText: text }));
  }, [addToast, setMineState, contextRef]);

  // Select the candidate at the selected relative offset, i.e. the previous
  // or next candidate.
  const selectCandidateOffset = useCallback(
    (offset: 1 | -1): void => {
      // Get index of current selected candidate
      const current = stateRef.current;
      if (!current.candidates.length) return;
      const index = selectedIndex(
        current.candidates,
        current.selectedCandidateId
      );

      // Start from first candidate if no selection exists
      const next =
        current.candidates[
          index < 0
            ? 0
            : (index + offset + current.candidates.length) %
              current.candidates.length
        ];

      // Update state
      setMineState((state) => ({
        ...state,
        selectedCandidateId: next?.id ?? null,
      }));
    },
    [setMineState, stateRef]
  );

  // Toggle the visibility of the details section for the selected candidate
  const toggleDetails = useCallback((): void => {
    setMineState((state) => ({ ...state, showDetails: !state.showDetails }));
  }, [setMineState]);

  // Toggle the visibility of the context sentence input
  const toggleContext = useCallback((): void => {
    setMineState((state) => ({ ...state, showContext: !state.showContext }));
  }, [setMineState]);

  // Navigate to the Chat page with the selected candidate added as context
  const chatSelected = useCallback((): void => {
    const candidate = selectedCandidate(stateRef.current);
    if (!candidate) return;
    navigate({
      id: 'chat',
      sessionId: `candidate-${candidate.id}-${Date.now()}`,
      contexts: [{ kind: 'candidate', value: candidate }],
    });
  }, [navigate, stateRef]);

  // Register commands

  useTuiCommand({
    id: MINE_COMMAND_IDS.analyseWord,
    title: 'Analyse word',
    keybindings: [{ key: 'a', ctrl: true }],
    run: analyseWord,
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.chatSelected,
    title: 'Chat about selected candidate',
    availability: chatAvailable,
    run: chatSelected,
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
    run: () => addSelectedCandidate(true),
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.candidateAddSelectedDirect,
    title: 'Add selected candidate without LLM processing',
    keybindings: [{ key: 'return', shift: true }],
    availability: selectedCandidateRequired,
    run: () => addSelectedCandidate(false),
  });

  useTuiCommand({
    id: MINE_COMMAND_IDS.toggleDetails,
    title: 'Toggle candidate details',
    keybindings: [{ key: 'd' }],
    availability: selectedCandidateRequired,
    run: toggleDetails,
  });
}
