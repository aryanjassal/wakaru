import type { AppContext } from '../app/context.js';

import { useOutletContext } from 'react-router';
import { Button } from '../components/ui/button.js';
import { Badge } from '../components/ui/badge.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table.js';
import { candidateMeaningText, wordCreatedDate } from '../lib/format.js';

export function LibraryScreen() {
  const {
    sortedWords: words,
    exporting,
    exportTsv,
  } = useOutletContext<AppContext>();
  return (
    <section className="grid gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Library</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {words.length} mined words
          </p>
        </div>
        <Button
          type="button"
          disabled={!words.length || exporting}
          onClick={() => void exportTsv()}
        >
          {exporting ? 'Exporting' : 'Export TSV'}
        </Button>
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Word</TableHead>
            <TableHead>Meaning</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead className="text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {words.map((word) => (
            <TableRow key={word.id}>
              <TableCell>
                <div className="font-medium">{word.candidate.expression}</div>
                {word.candidate.reading ? (
                  <div className="text-sm text-muted-foreground">
                    {word.candidate.reading}
                  </div>
                ) : null}
              </TableCell>
              <TableCell>{candidateMeaningText(word.candidate)}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(word.candidate.extension?.tags ?? []).map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {wordCreatedDate(word)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
