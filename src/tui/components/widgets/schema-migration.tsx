import type {
  ExportSchemaMigration,
  ExportSchemaState,
} from '@/client/storage/schema-diff.js';

import { useState } from 'react';
import { colorscheme } from '../../lib/theme.js';
import { Button } from '../primitives/button.js';

export type SchemaResolutionAction = 'proceed' | 'skip' | 'revert';

export function SchemaMigrationPopup({
  state,
  resolve,
}: Readonly<{
  state: ExportSchemaState;
  resolve: (
    action: SchemaResolutionAction,
    migration: ExportSchemaMigration
  ) => Promise<void>;
}>) {
  const [renames, setRenames] = useState<
    Readonly<Record<string, string | null | undefined>>
  >({});
  const [busy, setBusy] = useState(false);
  const addedKeys = state.diff.added.map((field) => field.key);
  const unanswered = state.diff.removed.some(
    (field) => renames[field.key] === undefined
  );

  const run = async (action: SchemaResolutionAction) => {
    if (busy) return;
    setBusy(true);
    try {
      await resolve(action, {
        renames: Object.fromEntries(
          state.diff.removed.map((field) => [
            field.key,
            renames[field.key] ?? null,
          ])
        ),
      });
    } finally {
      setBusy(false);
    }
  };

  const cycleRename = (field: string) => {
    const options: readonly (string | null)[] = [...addedKeys, null];
    const current = renames[field];
    const index = options.findIndex((option) => option === current);
    const next = options[(index + 1) % options.length] ?? null;
    setRenames((values) => ({ ...values, [field]: next }));
  };

  return (
    <box
      position="absolute"
      left="10%"
      top="10%"
      zIndex={100}
      width="80%"
      maxHeight="80%"
      flexDirection="column"
      rowGap={1}
      border
      borderStyle="double"
      borderColor={colorscheme.warning}
      backgroundColor={colorscheme.bg}
      padding={1}
      title=" Export schema changed "
      titleColor={colorscheme.warning}
    >
      <text fg={colorscheme.text}>
        The configured export fields differ from the database schema.
      </text>
      {state.diff.added.length ? (
        <text fg={colorscheme.green}>
          Added: {state.diff.added.map((field) => field.key).join(', ')}
        </text>
      ) : null}
      {state.diff.changed.length ? (
        <text fg={colorscheme.info}>
          Changed: {state.diff.changed.map((field) => field.key).join(', ')}
        </text>
      ) : null}
      {state.diff.removed.map((field) => (
        <box key={field.key} flexDirection="row" columnGap={1}>
          <text>Was “{field.key}” renamed?</text>
          <Button
            focusScope="schema-migration"
            label={
              renames[field.key] === undefined
                ? 'Choose'
                : (renames[field.key] ?? 'Deleted')
            }
            action={() => cycleRename(field.key)}
          />
        </box>
      ))}
      <box flexDirection="row" columnGap={1}>
        <Button
          focusScope="schema-migration"
          label={busy ? 'Working...' : 'Proceed'}
          action={(app) => {
            if (unanswered) {
              app.addToast('Answer each field migration question.', 'warning');
              return;
            }
            void run('proceed');
          }}
        />
        <Button
          focusScope="schema-migration"
          label="Skip"
          action={() => void run('skip')}
        />
        <Button
          focusScope="schema-migration"
          label="Revert config"
          action={() => void run('revert')}
        />
      </box>
      <text fg={colorscheme.muted}>
        Skip uses the stored schema for this session and asks again next time.
      </text>
    </box>
  );
}
