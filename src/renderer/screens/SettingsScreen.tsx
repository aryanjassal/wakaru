import type { ClientConfig } from '@/wakaru/schema/config.js';
import type { AppContext } from '../app/context.js';

import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router';
import { Button } from '../components/ui/button.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { errorMessage } from '../lib/errors.js';

export function SettingsScreen() {
  const { config, setConfig } = useOutletContext<AppContext>();
  const [draft, setDraft] = useState<ClientConfig | null>(config);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  async function save(): Promise<void> {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      await window.wakaru.writeConfig(draft);
      setConfig(draft);
      setMessage('Settings saved.');
    } catch (cause) {
      setMessage(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  if (!draft) {
    return (
      <section className="grid max-w-5xl gap-6">
        <header>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Loading configuration
            </p>
          </div>
        </header>
      </section>
    );
  }

  return (
    <section className="grid max-w-5xl gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Model endpoint and export schema
          </p>
        </div>
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving' : 'Save'}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Model</CardTitle>
          <CardDescription>
            Wakaru supports OpenAI-compatible local or remote endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="settings-model">Model</Label>
            <Input
              id="settings-model"
              value={draft.model.name}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  model: { ...draft.model, name: event.target.value },
                })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-api-base">API base</Label>
            <Input
              id="settings-api-base"
              value={draft.model.apiBase ?? ''}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  model: {
                    ...draft.model,
                    apiBase: event.target.value || undefined,
                  },
                })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-api-key">API key</Label>
            <Input
              id="settings-api-key"
              value={draft.model.apiKey ?? ''}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  model: {
                    ...draft.model,
                    apiKey: event.target.value || undefined,
                  },
                })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-context-window">Context window</Label>
            <Input
              id="settings-context-window"
              type="number"
              min={1}
              value={draft.model.contextWindow ?? ''}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  model: {
                    ...draft.model,
                    contextWindow: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  },
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export fields</CardTitle>
          <CardDescription>
            These fields preserve the current config shape for TSV export.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {draft.export.fields.map((field) => (
            <article
              key={field.key}
              className="grid gap-1 rounded-md border border-border p-3 md:grid-cols-[180px_minmax(0,1fr)]"
            >
              <strong>{field.key}</strong>
              <span className="text-sm text-muted-foreground">
                {'inherit' in field
                  ? `Inherits ${field.inherit}`
                  : field.modelPrompt}
              </span>
            </article>
          ))}
        </CardContent>
      </Card>

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </section>
  );
}
