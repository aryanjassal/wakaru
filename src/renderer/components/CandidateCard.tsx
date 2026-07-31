import type { AssistantCandidate } from '@/wakaru/types.js';

import { Badge } from './ui/badge.js';
import { Button } from './ui/button.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card.js';
import { Separator } from './ui/separator.js';

export function CandidateCard({
  candidate,
  saving,
  saved,
  onSave,
}: Readonly<{
  candidate: AssistantCandidate;
  saving: boolean;
  saved: boolean;
  onSave: (candidate: AssistantCandidate) => void;
}>) {
  const source = candidate.details?.provenance?.definition;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-2xl">{candidate.expression}</CardTitle>
            {source?.kind === 'dictionary' ? (
              <Badge variant="outline">{source.dictionary}</Badge>
            ) : null}
          </div>
          {candidate.reading ? (
            <CardDescription className="mt-1">
              {candidate.reading}
            </CardDescription>
          ) : null}
        </div>
        <Button
          type="button"
          disabled={saving || saved}
          onClick={() => onSave(candidate)}
        >
          {saved ? 'Saved' : saving ? 'Saving' : 'Save'}
        </Button>
      </CardHeader>

      <CardContent className="grid gap-4">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {candidate.meanings.map((meaning) => (
            <li key={meaning}>{meaning}</li>
          ))}
        </ul>

        {candidate.details?.contextMeaning ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {candidate.details.contextMeaning}
          </p>
        ) : null}

        {candidate.details?.example?.japanese ? (
          <>
            <Separator />
            <div className="grid gap-1 text-sm">
              <p>{candidate.details.example.japanese}</p>
              {candidate.details.example.english ? (
                <p className="text-muted-foreground">
                  {candidate.details.example.english}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
