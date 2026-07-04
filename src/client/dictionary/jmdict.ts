import type {
  DictionaryRepository,
  DictionarySense,
} from '@/core/services/vocabulary.js';
import type { EntryRow, FormKind, FormRow, SenseRow } from './schema.js';

import Database from 'better-sqlite3';
import { desc, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { entries, forms, glosses, senses } from './schema.js';

const MATCHES_PER_KEY = 100;

type AssembledSense = Readonly<{
  id: number;
  position: number;
  partOfSpeech: readonly string[];
  information: readonly string[];
  restrictions: readonly string[];
  glosses: readonly Readonly<{ position: number; text: string }>[];
}>;

type AssembledEntry = Readonly<{
  entry: EntryRow;
  forms: readonly FormRow[];
  senses: readonly AssembledSense[];
}>;

export class JmdictDictionary implements DictionaryRepository {
  private readonly sqlite: Database.Database;
  private readonly database;

  public constructor(path: string) {
    this.sqlite = new Database(path, { readonly: true });
    this.database = drizzle(this.sqlite);
  }

  public lookup(
    keys: readonly string[],
    limit = 30
  ): readonly DictionarySense[] {
    const uniqueKeys = normaliseKeys(keys);
    if (!uniqueKeys.length) return [];

    const entryIds = this.findMatchingEntryIds(uniqueKeys);
    if (!entryIds.length) return [];

    const entryRows = this.selectEntries(entryIds);
    const formRows = this.selectForms(entryIds);
    const senseRows = this.selectSensesWithGlosses(entryIds);
    const assembled = assembleEntries(entryRows, formRows, senseRows);

    return rankAndExpand(assembled, uniqueKeys, limit);
  }

  public close(): void {
    this.sqlite.close();
  }

  private findMatchingEntryIds(keys: readonly string[]): readonly number[] {
    const entryIds = new Set<number>();
    for (const key of keys) {
      const matches = this.database
        .select({ entryId: forms.entryId })
        .from(forms)
        .where(eq(forms.text, key))
        .orderBy(desc(forms.priority))
        .limit(MATCHES_PER_KEY)
        .all();
      for (const match of matches) entryIds.add(match.entryId);
    }
    return [...entryIds];
  }

  private selectEntries(entryIds: readonly number[]): readonly EntryRow[] {
    return this.database
      .select({
        id: entries.id,
        source: entries.source,
        sequence: entries.sequence,
      })
      .from(entries)
      .where(inArray(entries.id, entryIds))
      .all();
  }

  private selectForms(entryIds: readonly number[]): readonly FormRow[] {
    return this.database
      .select({
        entryId: forms.entryId,
        text: forms.text,
        kind: forms.kind,
        priority: forms.priority,
        restrictions: forms.restrictions,
      })
      .from(forms)
      .where(inArray(forms.entryId, entryIds))
      .all();
  }

  private selectSensesWithGlosses(
    entryIds: readonly number[]
  ): readonly SenseRow[] {
    return this.database
      .select({
        id: senses.id,
        entryId: senses.entryId,
        position: senses.position,
        partOfSpeech: senses.partOfSpeech,
        information: senses.information,
        restrictions: senses.restrictions,
        glossPosition: glosses.position,
        gloss: glosses.text,
      })
      .from(senses)
      .innerJoin(glosses, eq(glosses.senseId, senses.id))
      .where(inArray(senses.entryId, entryIds))
      .all();
  }
}

function normaliseKeys(keys: readonly string[]): readonly string[] {
  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
}

function assembleEntries(
  entryRows: readonly EntryRow[],
  formRows: readonly FormRow[],
  senseRows: readonly SenseRow[]
): readonly AssembledEntry[] {
  const formsByEntry = groupBy(formRows, (form) => form.entryId);
  const senseRowsByEntry = groupBy(senseRows, (sense) => sense.entryId);

  return entryRows.map((entry) => ({
    entry,
    forms: formsByEntry.get(entry.id) ?? [],
    senses: assembleSenses(senseRowsByEntry.get(entry.id) ?? []),
  }));
}

function assembleSenses(rows: readonly SenseRow[]): readonly AssembledSense[] {
  const rowsBySense = groupBy(rows, (row) => row.id);
  return [...rowsBySense.values()]
    .map((senseRows) => {
      const first = senseRows[0]!;
      return {
        id: first.id,
        position: first.position,
        partOfSpeech: first.partOfSpeech,
        information: first.information,
        restrictions: first.restrictions,
        glosses: senseRows
          .map((row) => ({ position: row.glossPosition, text: row.gloss }))
          .sort((left, right) => left.position - right.position),
      };
    })
    .sort((left, right) => left.position - right.position);
}

function rankAndExpand(
  entriesToRank: readonly AssembledEntry[],
  keys: readonly string[],
  limit: number
): readonly DictionarySense[] {
  const keyPositions = new Map(keys.map((key, index) => [key, index]));
  return [...entriesToRank]
    .sort((left, right) => compareEntries(left, right, keyPositions))
    .flatMap((entry) => toDictionarySenses(entry, keyPositions))
    .slice(0, Math.max(limit, 0));
}

function compareEntries(
  left: AssembledEntry,
  right: AssembledEntry,
  keyPositions: ReadonlyMap<string, number>
): number {
  const matchDifference =
    entryMatchRank(left, keyPositions) - entryMatchRank(right, keyPositions);
  if (matchDifference) return matchDifference;
  if (left.entry.source !== right.entry.source) {
    return left.entry.source === 'jmdict' ? -1 : 1;
  }
  return maximumPriority(right.forms) - maximumPriority(left.forms);
}

function entryMatchRank(
  entry: AssembledEntry,
  keyPositions: ReadonlyMap<string, number>
): number {
  return Math.min(
    ...entry.forms.map((form) => {
      const position = keyPositions.get(form.text) ?? Number.MAX_SAFE_INTEGER;
      return form.kind === 'reading' ? position + 100 : position;
    })
  );
}

function maximumPriority(entryForms: readonly FormRow[]): number {
  return Math.max(0, ...entryForms.map((form) => form.priority));
}

function toDictionarySenses(
  entry: AssembledEntry,
  keyPositions: ReadonlyMap<string, number>
): readonly DictionarySense[] {
  const expression =
    preferredForm(entry.forms, 'written', keyPositions) ??
    preferredForm(entry.forms, 'reading', keyPositions);
  const reading = preferredForm(entry.forms, 'reading');
  if (!expression || !reading) return [];

  return entry.senses.map((sense) => ({
    id: `${entry.entry.source}:${entry.entry.sequence}:${sense.position}`,
    source: entry.entry.source,
    entryId: String(entry.entry.sequence),
    senseId: String(sense.position),
    expression,
    reading,
    meanings: sense.glosses.map((gloss) => gloss.text),
    partOfSpeech: sense.partOfSpeech,
    information: [...sense.information, ...sense.restrictions],
    priority: maximumPriority(entry.forms),
  }));
}

function preferredForm(
  entryForms: readonly FormRow[],
  kind: FormKind,
  keyPositions: ReadonlyMap<string, number> = new Map()
): string | undefined {
  return entryForms
    .filter((form) => form.kind === kind)
    .sort((left, right) => {
      const leftPosition =
        keyPositions.get(left.text) ?? Number.MAX_SAFE_INTEGER;
      const rightPosition =
        keyPositions.get(right.text) ?? Number.MAX_SAFE_INTEGER;
      return leftPosition - rightPosition || right.priority - left.priority;
    })[0]?.text;
}

function groupBy<Item, Key>(
  items: readonly Item[],
  keyFor: (item: Item) => Key
): ReadonlyMap<Key, readonly Item[]> {
  const groups = new Map<Key, Item[]>();
  for (const item of items) {
    const key = keyFor(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}
