import {
  ui,
  type CommandItem,
  type CommandSource,
  type RouteDefinition,
  type RouteRenderContext,
  type VNode,
} from '@rezi-ui/core';
import {
  SPACE,
  stylesForTheme,
  themeSpec,
  themeTokens,
  toHex,
} from '../theme.js';
import {
  toCoreWakaruToast,
  type MiningCandidate,
  type SavedWord,
  type WakaruRouteDeps,
  type WakaruRouteId,
  type WakaruState,
} from '../types.js';
import { ankiImportPath } from './storage.js';

export const WAKARU_ROUTES: readonly Readonly<{
  id: WakaruRouteId;
  title: string;
}>[] = [
  { id: 'mine', title: 'Mine' },
  { id: 'library', title: 'Library' },
  { id: 'settings', title: 'Settings' },
];

function statusVariant(
  status: MiningCandidate['status']
): 'info' | 'success' | 'warning' {
  if (status === 'added') return 'success';
  if (status === 'skipped') return 'warning';
  return 'info';
}

function compactText(value: string, fallback = '—'): string {
  return value.trim() || fallback;
}

function commandItems(): readonly CommandItem[] {
  return [
    {
      id: 'cmd-analyze',
      label: 'Analyze input',
      description: 'Send pasted text to Ollama',
      shortcut: 'ctrl+a',
      icon: '>',
      sourceId: 'commands',
    },
    {
      id: 'cmd-add',
      label: 'Add selected word',
      description: 'Save candidate and refresh Anki TSV',
      shortcut: 'enter',
      icon: '+',
      sourceId: 'commands',
    },
    {
      id: 'cmd-skip',
      label: 'Skip selected word',
      description: 'Mark selected candidate as skipped',
      shortcut: 'x',
      icon: 'x',
      sourceId: 'commands',
    },
    {
      id: 'cmd-export',
      label: 'Export Anki TSV',
      description: 'Rewrite import file from saved words',
      shortcut: 'ctrl+e',
      icon: '#',
      sourceId: 'commands',
    },
    {
      id: 'cmd-theme',
      label: 'Cycle theme',
      description: 'Rotate terminal color theme',
      shortcut: 't',
      icon: '*',
      sourceId: 'commands',
    },
  ];
}

function routeItems(
  routes: readonly Readonly<{ id: WakaruRouteId; title: string }>[]
): readonly CommandItem[] {
  return routes.map((route, index) => ({
    id: `route-${route.id}`,
    label: `Go to ${route.title}`,
    description: `Open ${route.title}`,
    shortcut: String(index + 1),
    icon: '#',
    sourceId: 'routes',
    data: route.id,
  }));
}

function filterItems(
  items: readonly CommandItem[],
  query: string
): readonly CommandItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) =>
    `${item.label} ${item.description ?? ''}`.toLowerCase().includes(normalized)
  );
}

function panel(
  title: string,
  children: readonly VNode[],
  state: WakaruState
): VNode {
  const tokens = themeTokens(state.themeName);
  return ui.box(
    {
      title,
      preset: 'well',
      p: SPACE.sm,
      gap: SPACE.sm,
      width: 'full',
      style: { bg: tokens.bg.panel.base, fg: tokens.text.primary },
      borderStyle: { fg: tokens.border.default },
      inheritStyle: { fg: tokens.text.primary },
    },
    children
  );
}

function selectedCandidate(state: WakaruState): MiningCandidate | null {
  return (
    state.candidates.find(
      (candidate) => candidate.id === state.selectedCandidateId
    ) ?? null
  );
}

function candidateTable(
  ctx: RouteRenderContext<WakaruState>,
  deps: WakaruRouteDeps
): VNode {
  const state = ctx.state;
  const tokens = themeTokens(state.themeName);
  return ui.table<MiningCandidate>({
    id: 'candidate-table',
    columns: [
      { key: 'expression', header: 'Word', width: 16 },
      { key: 'reading', header: 'Reading', width: 18 },
      { key: 'contextMeaning', header: 'Meaning in context', flex: 1 },
      { key: 'status', header: 'Status', width: 10 },
    ],
    data: state.candidates,
    getRowKey: (candidate) => candidate.id,
    selectionMode: 'single',
    selection: state.selectedCandidateId ? [state.selectedCandidateId] : [],
    onSelectionChange: (keys) => {
      const key = keys[0];
      deps.dispatch({
        type: 'select-candidate',
        candidateId: typeof key === 'string' ? key : null,
      });
    },
    onRowPress: (candidate) =>
      deps.dispatch({ type: 'select-candidate', candidateId: candidate.id }),
    stripedRows: true,
    stripeStyle: { even: tokens.bg.panel.base, odd: tokens.bg.panel.inset },
    selectionStyle: {
      bg: tokens.table.rowSelectedBg,
      fg: tokens.state.selectedText,
      bold: true,
    },
    borderStyle: { variant: 'rounded', color: tokens.border.muted },
    dsSize: 'sm',
    virtualized: true,
  });
}

function candidateDetail(state: WakaruState): VNode {
  const candidate = selectedCandidate(state);
  const tokens = themeTokens(state.themeName);
  if (!candidate) {
    return panel(
      'Candidate Detail',
      [
        ui.empty('No candidate selected', {
          description: 'Analyze text or select a row',
        }),
      ],
      state
    );
  }

  return panel(
    'Candidate Detail',
    [
      ui.row({ gap: SPACE.sm, wrap: true }, [
        ui.text(candidate.expression, { variant: 'heading' }),
        ui.badge(candidate.status, {
          variant: statusVariant(candidate.status),
        }),
        candidate.partOfSpeech
          ? ui.tag(candidate.partOfSpeech, { variant: 'info' })
          : ui.text(''),
      ]),
      ui.text(`Reading: ${compactText(candidate.reading)}`, {
        variant: 'label',
      }),
      ui.text(`Meaning: ${compactText(candidate.meaning)}`),
      ui.callout(compactText(candidate.contextMeaning), {
        title: 'In this context',
        variant: 'info',
      }),
      candidate.nuance
        ? ui.callout(candidate.nuance, { title: 'Nuance', variant: 'warning' })
        : ui.text(''),
      ui.divider({ color: toHex(tokens.border.muted) }),
      ui.text(compactText(candidate.exampleJapanese), { variant: 'label' }),
      ui.text(compactText(candidate.exampleEnglish), {
        variant: 'caption',
        style: { fg: tokens.text.muted },
      }),
      ui.row(
        { gap: SPACE.xs, wrap: true },
        candidate.tags.map((tag) => ui.tag(tag, { variant: 'info' }))
      ),
    ],
    state
  );
}

function renderMine(
  ctx: RouteRenderContext<WakaruState>,
  deps: WakaruRouteDeps
): VNode {
  const state = ctx.state;
  const tokens = themeTokens(state.themeName);
  const busy = state.status === 'analyzing' || state.status === 'saving';
  const candidate = selectedCandidate(state);

  return renderShell(ctx, deps, 'Mine Words', [
    ui.row({ gap: SPACE.sm, width: 'full', wrap: state.viewportCols < 110 }, [
      panel(
        'Input',
        [
          ui.form({ id: 'mine-form', gap: SPACE.sm }, [
            ui.field({
              label: 'Japanese text',
              children: ui.textarea({
                id: 'mine-input',
                value: state.inputText,
                rows: Math.max(
                  6,
                  Math.min(12, Math.floor(state.viewportRows / 4))
                ),
                placeholder:
                  'Paste a sentence, paragraph, or newline-separated words',
                onInput: (text) => deps.dispatch({ type: 'set-input', text }),
              }),
            }),
          ]),
          ui.row({ gap: SPACE.sm, wrap: true }, [
            ui.button({
              id: 'analyze',
              label: busy ? 'Working...' : 'Analyze',
              intent: 'primary',
              disabled: busy || !state.inputText.trim(),
              onPress: deps.analyzeInput,
            }),
            ui.button({
              id: 'add-selected',
              label: 'Add',
              intent: 'success',
              disabled: busy || !candidate || candidate.status === 'added',
              onPress: deps.addSelected,
            }),
            ui.button({
              id: 'skip-selected',
              label: 'Skip',
              intent: 'secondary',
              disabled: busy || !candidate || candidate.status !== 'pending',
              onPress: deps.skipSelected,
            }),
          ]),
          state.status === 'analyzing'
            ? ui.progress(0.65, {
                width: Math.max(24, Math.min(54, state.viewportCols - 20)),
              })
            : ui.text(state.statusMessage, {
                variant: 'caption',
                style: { fg: tokens.text.muted },
              }),
          state.errorMessage
            ? ui.callout(state.errorMessage, {
                title: 'Error',
                variant: 'error',
              })
            : ui.text(''),
        ],
        state
      ),
      ui.column({ gap: SPACE.sm, width: 'full' }, [
        panel(
          'Candidates',
          state.candidates.length
            ? [candidateTable(ctx, deps)]
            : [
                ui.empty('No candidates yet', {
                  description: 'Paste text and run Analyze',
                }),
              ],
          state
        ),
        candidateDetail(state),
      ]),
    ]),
  ]);
}

function renderLibrary(
  ctx: RouteRenderContext<WakaruState>,
  deps: WakaruRouteDeps
): VNode {
  const state = ctx.state;
  const tokens = themeTokens(state.themeName);
  const table = ui.table<SavedWord>({
    id: 'saved-word-table',
    columns: [
      { key: 'expression', header: 'Word', width: 16 },
      { key: 'reading', header: 'Reading', width: 18 },
      { key: 'contextMeaning', header: 'Context', flex: 1 },
      { key: 'createdAt', header: 'Added', width: 12 },
    ],
    data: state.savedWords,
    getRowKey: (word) => word.id,
    stripedRows: true,
    stripeStyle: { even: tokens.bg.panel.base, odd: tokens.bg.panel.inset },
    borderStyle: { variant: 'rounded', color: tokens.border.muted },
    dsSize: 'sm',
    virtualized: true,
  });

  return renderShell(ctx, deps, 'Saved Words', [
    panel(
      'Anki Export',
      [
        ui.text(`Saved words: ${state.savedWords.length}`, {
          variant: 'label',
        }),
        ui.text(ankiImportPath(state.config), {
          variant: 'caption',
          style: { fg: tokens.text.muted },
        }),
        ui.actions([
          ui.button({
            id: 'export-anki',
            label: 'Rewrite TSV',
            intent: 'primary',
            onPress: deps.exportAnki,
          }),
        ]),
      ],
      state
    ),
    panel(
      'Library',
      state.savedWords.length
        ? [table]
        : [ui.empty('No saved words', { description: 'Add words from Mine' })],
      state
    ),
  ]);
}

function renderSettings(
  ctx: RouteRenderContext<WakaruState>,
  deps: WakaruRouteDeps
): VNode {
  const state = ctx.state;
  const tokens = themeTokens(state.themeName);
  return renderShell(ctx, deps, 'Settings', [
    panel(
      'Runtime',
      [
        ui.text(`Provider: ${state.config.llm.provider}`),
        ui.text(`Model: ${state.config.llm.model}`),
        ui.text(`API base: ${state.config.llm.apiBase}`),
        ui.text(`Words directory: ${state.config.storage.wordsDir}`),
        ui.divider({ color: toHex(tokens.border.muted) }),
        ui.callout(
          'Edit ~/.config/wakaru/config.json to change the Ollama model or storage path, then restart.',
          { title: 'Config', variant: 'info' }
        ),
      ],
      state
    ),
  ]);
}

function renderShell(
  ctx: RouteRenderContext<WakaruState>,
  deps: WakaruRouteDeps,
  title: string,
  body: readonly VNode[]
): VNode {
  const state = ctx.state;
  const tokens = themeTokens(state.themeName);
  const currentRoute = ctx.router.currentRoute().id as WakaruRouteId;
  const styles = stylesForTheme(state.themeName);
  const theme = themeSpec(state.themeName);
  const sources: readonly CommandSource[] = [
    {
      id: 'routes',
      name: 'Routes',
      getItems: (query: string) => filterItems(routeItems(deps.routes), query),
    },
    {
      id: 'commands',
      name: 'Commands',
      getItems: (query: string) => filterItems(commandItems(), query),
    },
  ];

  const nav = ui.row(
    { gap: SPACE.sm, wrap: true, width: 'full', items: 'center' },
    deps.routes.map((route, index) =>
      ui.button({
        id: `nav-${route.id}`,
        label: `${index + 1} ${route.title}`,
        dsVariant: currentRoute === route.id ? 'solid' : 'ghost',
        dsTone: 'primary',
        dsSize: 'sm',
        onPress: () => deps.navigate(route.id),
      })
    )
  );

  return ui.layers([
    ui.column({ gap: SPACE.sm, width: 'full', height: 'full' }, [
      ui.box(
        {
          preset: 'well',
          p: SPACE.sm,
          gap: SPACE.sm,
          width: 'full',
          style: styles.rootStyle,
          borderStyle: { fg: tokens.border.default },
        },
        [
          ui.row({ gap: SPACE.sm, wrap: true, items: 'center' }, [
            ui.text('Wakaru', { variant: 'heading' }),
            ui.badge(theme.label, { variant: theme.badge }),
            ui.spacer({ flex: 1 }),
            ui.text('ctrl+p commands  q quit', {
              variant: 'caption',
              style: { fg: tokens.text.muted },
            }),
          ]),
          nav,
        ]
      ),
      ui.text(title, { variant: 'heading' }),
      ...body,
    ]),
    state.toasts.length
      ? ui.toastContainer({
          toasts: state.toasts.map(toCoreWakaruToast),
          position: 'bottom-right',
          maxVisible: 4,
          width: Math.max(28, Math.min(58, state.viewportCols - 6)),
          frameStyle: {
            border: tokens.border.focus,
            background: tokens.bg.panel.elevated,
            foreground: tokens.text.primary,
          },
          onClose: (id) =>
            deps.dispatch({ type: 'dismiss-toast', toastId: id }),
        })
      : null,
    state.showCommandPalette
      ? ui.layer({
          id: 'wakaru-command-layer',
          modal: true,
          closeOnEscape: true,
          backdrop: 'dim',
          zIndex: 200,
          frameStyle: {
            border: tokens.border.focus,
            background: tokens.bg.modal,
            foreground: tokens.text.primary,
          },
          onClose: () => deps.dispatch({ type: 'toggle-command-palette' }),
          content: ui.commandPalette({
            id: 'wakaru-command-palette',
            open: state.showCommandPalette,
            query: state.commandQuery,
            sources,
            selectedIndex: state.commandIndex,
            placeholder: 'Type a route or command',
            onChange: (query) =>
              deps.dispatch({ type: 'set-command-query', query }),
            onSelectionChange: (index) =>
              deps.dispatch({ type: 'set-command-index', index }),
            onSelect: (item) => {
              if (typeof item.data === 'string') {
                deps.navigate(item.data as WakaruRouteId);
                return;
              }
              if (item.id === 'cmd-analyze') deps.analyzeInput();
              if (item.id === 'cmd-add') deps.addSelected();
              if (item.id === 'cmd-skip') deps.skipSelected();
              if (item.id === 'cmd-export') deps.exportAnki();
              if (item.id === 'cmd-theme')
                deps.dispatch({ type: 'cycle-theme' });
            },
            onClose: () => deps.dispatch({ type: 'toggle-command-palette' }),
          }),
        })
      : null,
  ]);
}

export function createWakaruRoutes(
  deps: WakaruRouteDeps
): readonly RouteDefinition<WakaruState>[] {
  return [
    {
      id: 'mine',
      title: 'Mine',
      screen: (_params, ctx) => renderMine(ctx, deps),
    },
    {
      id: 'library',
      title: 'Library',
      screen: (_params, ctx) => renderLibrary(ctx, deps),
    },
    {
      id: 'settings',
      title: 'Settings',
      screen: (_params, ctx) => renderSettings(ctx, deps),
    },
  ];
}
