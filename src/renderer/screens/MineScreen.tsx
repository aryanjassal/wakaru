import type { AssistantCandidate } from '@/wakaru/types.js';
import type { AnalyseVocabularyResult } from '@/wakaru/vocabulary.js';
import type { AppContext } from '../app/context.js';

import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { CandidateCard } from '../components/CandidateCard.js';
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
import { Textarea } from '../components/ui/textarea.js';
import { errorMessage } from '../lib/errors.js';

export function MineScreen() {
  const { addSavedWord } = useOutletContext<AppContext>();
  const [expression, setExpression] = useState('');
  const [sentence, setSentence] = useState('');
  const [result, setResult] = useState<AnalyseVocabularyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  async function analyse(): Promise<void> {
    const word = expression.trim();
    if (!word) return;

    setAnalysing(true);
    setError(null);
    try {
      setResult(
        await window.wakaru.analyseVocabulary({
          expression: word,
          ...(sentence.trim() ? { context: sentence } : {}),
        })
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setAnalysing(false);
    }
  }

  async function save(candidate: AssistantCandidate): Promise<void> {
    setSavingId(candidate.id);
    setError(null);
    try {
      const saved = await window.wakaru.saveWord({
        candidate,
        sourceText: expression.trim(),
        ...(sentence.trim() ? { context: sentence } : {}),
      });
      setSavedIds((current) => new Set(current).add(candidate.id));
      addSavedWord(saved);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="grid max-w-5xl gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Mine</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Look up a word offline, then save the best sense.
          </p>
        </div>
        <Button
          type="button"
          disabled={!expression.trim() || analysing}
          onClick={() => void analyse()}
        >
          {analysing ? 'Analysing' : 'Analyse'}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Lookup</CardTitle>
          <CardDescription>
            Sentence context is optional and only used to rank or enrich
            candidates.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="mine-expression">Word</Label>
            <Input
              id="mine-expression"
              value={expression}
              onChange={(event) => setExpression(event.target.value)}
              placeholder="稼ぐ"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mine-sentence">Sentence</Label>
            <Textarea
              id="mine-sentence"
              value={sentence}
              onChange={(event) => setSentence(event.target.value)}
              placeholder="Context sentence, optional"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3">
        {result?.candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            saving={savingId === candidate.id}
            saved={savedIds.has(candidate.id)}
            onSave={(nextCandidate) => void save(nextCandidate)}
          />
        ))}
      </div>
    </section>
  );
}
