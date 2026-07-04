import type { ScrollBoxRenderable, TextareaRenderable } from '@opentui/core';
import type { ChatMessage, AssistantCandidate } from '@/core/types.js';
import type { SavedWord } from '@/client/types.js';
import type { ChatContextItem, TuiReturnRoute } from '../../lib/types.js';
import type { ChatCommandFragment } from './commands.js';

import { SyntaxStyle, TextAttributes } from '@opentui/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { candidateToSavedWord } from '@/client/storage/words.js';
import {
  Button,
  Loader,
  Separator,
  Textarea,
  WordDetails,
} from '../../components/index.js';
import { usePersistentRouteState, useTuiApp } from '../../lib/context/app.js';
import { colorscheme } from '../../lib/theme.js';
import { errorMessage } from '../../lib/utils.js';
import { AddWordPopup } from './add-word-popup.js';
import { ChatCommandPopup } from './command-popup.js';
import {
  findChatCommand,
  matchingChatCommands,
  parseTemperature,
  removeChatCommand,
} from './commands.js';
import { preprocessChatMarkdown } from './render.js';

type ChatTurn = ChatMessage &
  Readonly<{
    id: string;
    attachments?: readonly ChatContextItem[] | undefined;
    candidate?: AssistantCandidate | undefined;
  }>;

type ChatState = Readonly<{
  attachments: readonly ChatContextItem[];
  turns: readonly ChatTurn[];
  prompt: string;
  temperature: number;
  showFurigana: boolean;
}>;

function createChatState(attachments: readonly ChatContextItem[]): ChatState {
  return {
    attachments,
    turns: [],
    prompt: '',
    temperature: 0.3,
    showFurigana: false,
  };
}

function contextKey(item: ChatContextItem): string {
  return `${item.kind}:${contextCandidate(item).id}`;
}

function contextCandidate(item: ChatContextItem): AssistantCandidate {
  return item.kind === 'saved-word' ? item.value.candidate : item.value;
}

function uniqueContexts(
  contexts: readonly ChatContextItem[]
): readonly ChatContextItem[] {
  return [
    ...new Map(contexts.map((item) => [contextKey(item), item])).values(),
  ];
}

function ContextChip({
  item,
  returnTo,
}: Readonly<{ item: ChatContextItem; returnTo: TuiReturnRoute }>) {
  const { navigate } = useTuiApp();
  return (
    <Button
      label={contextCandidate(item).expression}
      fg={colorscheme.primary}
      bg={colorscheme.bg}
      attributes={TextAttributes.UNDERLINE}
      action={() => navigate({ id: 'word-detail', item, returnTo })}
    />
  );
}

function AttachmentRow({
  items,
  returnTo,
}: Readonly<{
  items: readonly ChatContextItem[];
  returnTo: TuiReturnRoute;
}>) {
  if (!items.length) return null;
  return (
    <box
      width="100%"
      flexDirection="row"
      flexWrap="wrap"
      columnGap={1}
      rowGap={1}
    >
      {items.map((item) => (
        <ContextChip key={contextKey(item)} item={item} returnTo={returnTo} />
      ))}
    </box>
  );
}

function AssistantTurn({
  turn,
  syntaxStyle,
  showFurigana,
  onSave,
}: Readonly<{
  turn: ChatTurn;
  syntaxStyle: SyntaxStyle;
  showFurigana: boolean;
  onSave: (candidate: AssistantCandidate) => void;
}>) {
  return (
    <box width="100%" flexDirection="column" rowGap={1}>
      <markdown
        width="100%"
        content={preprocessChatMarkdown(turn.content, showFurigana)}
        syntaxStyle={syntaxStyle}
        fg={colorscheme.text}
        conceal
      />
      {turn.candidate ? (
        <box
          width="100%"
          flexDirection="column"
          rowGap={1}
          border
          borderStyle="single"
          borderColor={colorscheme.gutter}
          padding={1}
          title=" Verified candidate "
          titleColor={colorscheme.primary}
        >
          <WordDetails item={{ kind: 'candidate', value: turn.candidate }} />
          <Button
            label="Save candidate"
            action={() => onSave(turn.candidate as AssistantCandidate)}
          />
        </box>
      ) : null}
    </box>
  );
}

export function ChatScreen({
  sessionId = 'default',
  initialContexts = [],
}: Readonly<{
  sessionId?: string | undefined;
  initialContexts?: readonly ChatContextItem[] | undefined;
}>) {
  const app = useTuiApp();
  const composerRef = useRef<TextareaRenderable>(null);
  const historyRef = useRef<ScrollBoxRenderable>(null);
  const [state, setState] = usePersistentRouteState<ChatState>(
    `chat:${sessionId}`,
    () => createChatState(initialContexts)
  );
  const [busy, setBusy] = useState(false);
  const [commandFragment, setCommandFragment] =
    useState<ChatCommandFragment | null>(null);
  const [commandIndex, setCommandIndex] = useState(0);
  const [showAddWord, setShowAddWord] = useState(false);
  const [savedWords, setSavedWords] = useState<readonly SavedWord[]>([]);
  const syntaxStyle = useMemo(
    () =>
      SyntaxStyle.fromStyles({
        default: { fg: colorscheme.text },
        keyword: { fg: colorscheme.primary, bold: true },
        string: { fg: colorscheme.green },
        comment: { fg: colorscheme.muted, italic: true },
        'markup.raw': { fg: colorscheme.muted },
      }),
    []
  );
  const matchingCommands = useMemo(
    () => (commandFragment ? matchingChatCommands(commandFragment) : []),
    [commandFragment]
  );
  const routeBack: TuiReturnRoute = useMemo(
    () => ({ id: 'chat', sessionId }),
    [sessionId]
  );

  useEffect(() => () => syntaxStyle.destroy(), [syntaxStyle]);
  useEffect(() => composerRef.current?.focus(), []);
  useEffect(() => {
    if (!showAddWord) return;
    try {
      setSavedWords(app.wordStore.list());
    } catch (error) {
      app.addToast(errorMessage(error), 'error');
    }
  }, [app.addToast, app.wordStore, showAddWord]);
  useEffect(() => {
    if (!app.wakaru.llmAvailable) {
      app.addToast('Chat is unavailable while Wakaru is offline.', 'warning');
    }
  }, [app.addToast, app.wakaru]);
  useEffect(() => {
    if (commandIndex < matchingCommands.length) return;
    setCommandIndex(Math.max(0, matchingCommands.length - 1));
  }, [commandIndex, matchingCommands.length]);

  const refreshComposer = useCallback(() => {
    const composer = composerRef.current;
    if (!composer) return;
    const prompt = composer.plainText;
    setState((current) => ({ ...current, prompt }));
    setCommandFragment(findChatCommand(prompt, composer.cursorOffset));
    setCommandIndex(0);
  }, [setState]);

  const replaceComposerText = useCallback(
    (text: string, cursorOffset = text.length) => {
      const composer = composerRef.current;
      composer?.setText(text);
      if (composer) composer.cursorOffset = cursorOffset;
      setState((current) => ({ ...current, prompt: text }));
      setCommandFragment(null);
    },
    [setState]
  );

  const addContext = useCallback(
    (item: ChatContextItem) => {
      setState((current) => ({
        ...current,
        attachments: uniqueContexts([...current.attachments, item]),
      }));
    },
    [setState]
  );

  const runSlashCommand = useCallback(() => {
    const composer = composerRef.current;
    const prompt = composer?.plainText ?? state.prompt;
    const fragment = findChatCommand(
      prompt,
      composer?.cursorOffset ?? prompt.length
    );
    if (!fragment) return;
    const freshMatches = matchingChatCommands(fragment);
    const command =
      freshMatches.find((candidate) => candidate.id === fragment.name) ??
      freshMatches[commandIndex];
    if (!command) return;
    const nextPrompt = removeChatCommand(prompt, fragment);
    replaceComposerText(nextPrompt, fragment.start);

    if (command.id === 'addword') {
      setShowAddWord(true);
      return;
    }
    if (command.id === 'temperature') {
      const temperature = parseTemperature(fragment.args[0]);
      if (temperature === null) {
        app.addToast('Temperature must be a number from 0 to 2.', 'warning');
        return;
      }
      setState((current) => ({ ...current, temperature }));
      app.addToast(`Chat temperature set to ${temperature}.`, 'success');
      return;
    }

    const requested = fragment.args[0]?.toLowerCase();
    const showFurigana =
      requested === 'on'
        ? true
        : requested === 'off'
          ? false
          : !state.showFurigana;
    setState((current) => ({ ...current, showFurigana }));
    app.addToast(`Furigana ${showFurigana ? 'shown' : 'hidden'}.`, 'success');
  }, [
    app,
    commandIndex,
    replaceComposerText,
    setState,
    state.prompt,
    state.showFurigana,
  ]);

  const send = useCallback(async () => {
    const prompt = (composerRef.current?.plainText ?? state.prompt).trim();
    if (!prompt || busy) return;
    if (!app.wakaru.llmAvailable) {
      app.addToast('Chat is unavailable while Wakaru is offline.', 'warning');
      return;
    }
    const attachments = state.attachments;
    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      attachments,
    };
    const turns = [...state.turns, userTurn];
    const messages: readonly ChatMessage[] = turns.map(({ role, content }) => ({
      role,
      content,
    }));
    const contexts = uniqueContexts(
      turns.flatMap((turn) => turn.attachments ?? [])
    );
    setState((current) => ({
      ...current,
      prompt: '',
      attachments: [],
      turns: [...current.turns, userTurn],
    }));
    replaceComposerText('');
    setBusy(true);
    try {
      const response = await app.wakaru.chat(
        contexts.map(contextCandidate),
        messages,
        { temperature: state.temperature }
      );
      setState((current) => ({
        ...current,
        turns: [
          ...current.turns,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: response.markdown,
            candidate: response.candidate,
          },
        ],
      }));
    } catch (error) {
      app.addToast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
      composerRef.current?.focus();
    }
  }, [app, busy, replaceComposerText, setState, state]);

  const saveCandidate = useCallback(
    async (candidate: AssistantCandidate) => {
      const sourceItem = state.turns
        .flatMap((turn) => turn.attachments ?? [])
        .at(-1);
      const source = sourceItem ? contextCandidate(sourceItem) : undefined;
      const sourceText =
        sourceItem?.kind === 'saved-word'
          ? sourceItem.value.sourceText
          : (source?.details?.example?.japanese ??
            candidate.details?.example?.japanese ??
            '');
      try {
        const prepared = await app.wakaru.prepareVocabulary(
          candidate,
          sourceText
        );
        const word = candidateToSavedWord(prepared, sourceText, app.config);
        app.wordStore.save(word);
        app.addToast(`Saved ${word.candidate.expression}.`, 'success');
      } catch (error) {
        app.addToast(errorMessage(error), 'error');
      }
    },
    [app, state.turns]
  );

  return (
    <box
      id="chat-panel"
      width="100%"
      height="100%"
      minHeight={0}
      flexDirection="column"
      border
      borderStyle="single"
      borderColor={colorscheme.gutter}
      padding={1}
      title=" Chat "
      titleColor={colorscheme.primary}
    >
      <scrollbox
        ref={historyRef}
        width="100%"
        flexGrow={1}
        flexBasis={0}
        minHeight={1}
        scrollY
        scrollX={false}
        stickyScroll
        stickyStart="bottom"
        contentOptions={{ flexDirection: 'column', rowGap: 1 }}
      >
        {!app.wakaru.llmAvailable ? (
          <text
            content="Chat is unavailable while Wakaru is offline. Dictionary lookup remains available."
            fg={colorscheme.warning}
          />
        ) : state.turns.length ? (
          state.turns.map((turn) =>
            turn.role === 'user' ? (
              <box
                key={turn.id}
                width="100%"
                flexDirection="column"
                rowGap={1}
                paddingLeft={2}
              >
                <text content={`You: ${turn.content}`} fg={colorscheme.info} />
                <AttachmentRow
                  items={turn.attachments ?? []}
                  returnTo={routeBack}
                />
              </box>
            ) : (
              <AssistantTurn
                key={turn.id}
                turn={turn}
                syntaxStyle={syntaxStyle}
                showFurigana={state.showFurigana}
                onSave={(candidate) => void saveCandidate(candidate)}
              />
            )
          )
        ) : (
          <text
            content="Start a conversation about Japanese vocabulary."
            fg={colorscheme.muted}
          />
        )}
        {busy ? <Loader label="THINKING" /> : null}
      </scrollbox>
      <Separator />
      <box position="relative" width="100%" flexDirection="column" rowGap={1}>
        <AttachmentRow items={state.attachments} returnTo={routeBack} />
        {commandFragment ? (
          <ChatCommandPopup
            commands={matchingCommands}
            selectedIndex={commandIndex}
          />
        ) : null}
        <Textarea
          ref={composerRef}
          id={`chat-prompt-${sessionId}`}
          label="Message"
          height={4}
          initialValue={state.prompt}
          placeholder="Ask about attached words or type / for commands"
          wrapMode="word"
          keyBindings={[{ name: 'return', action: 'submit' }]}
          onContentChange={() => queueMicrotask(refreshComposer)}
          onCursorChange={() => queueMicrotask(refreshComposer)}
          onBlur={() => setCommandFragment(null)}
          onSubmit={() => void send()}
          onKeyDown={(key) => {
            const composer = composerRef.current;
            const prompt = composer?.plainText ?? state.prompt;
            const liveCommand = findChatCommand(
              prompt,
              composer?.cursorOffset ?? prompt.length
            );
            if (key.name === 'escape' && (commandFragment || liveCommand)) {
              key.preventDefault();
              setCommandFragment(null);
            } else if (key.name === 'up' && (commandFragment || liveCommand)) {
              key.preventDefault();
              setCommandIndex((index) =>
                matchingCommands.length
                  ? (index - 1 + matchingCommands.length) %
                    matchingCommands.length
                  : 0
              );
            } else if (
              key.name === 'down' &&
              (commandFragment || liveCommand)
            ) {
              key.preventDefault();
              setCommandIndex((index) =>
                matchingCommands.length
                  ? (index + 1) % matchingCommands.length
                  : 0
              );
            } else if (key.name === 'return') {
              if (liveCommand) {
                key.preventDefault();
                runSlashCommand();
              }
            } else if (
              key.name === 'backspace' &&
              !(composerRef.current?.plainText ?? '') &&
              state.attachments.length
            ) {
              key.preventDefault();
              setState((current) => ({
                ...current,
                attachments: current.attachments.slice(0, -1),
              }));
            }
          }}
        />
        <text
          content={`temperature ${state.temperature.toFixed(1)} · furigana ${state.showFurigana ? 'shown' : 'hidden'}`}
          fg={colorscheme.muted}
          attributes={TextAttributes.ITALIC}
        />
      </box>
      {showAddWord ? (
        <AddWordPopup
          words={savedWords}
          selectedIds={
            new Set(
              state.attachments
                .filter((item) => item.kind === 'saved-word')
                .map((item) => item.value.candidate.id)
            )
          }
          onClose={() => {
            setShowAddWord(false);
            composerRef.current?.focus();
          }}
          onAdd={(word: SavedWord) =>
            addContext({ kind: 'saved-word', value: word })
          }
        />
      ) : null}
    </box>
  );
}
