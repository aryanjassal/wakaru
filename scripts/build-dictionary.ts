import { execFileSync } from 'node:child_process';
import {
  closeSync,
  createReadStream,
  openSync,
  readSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { placeholder } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { SaxesParser, type SaxesTagPlain } from 'saxes';
import {
  entries,
  forms,
  glosses,
  metadata,
  senses,
  type DictionarySource,
} from '../src/client/dictionary/schema.js';

type Form = {
  text: string;
  kind: 'written' | 'reading';
  priorities: string[];
  restrictions: string[];
};
type Sense = {
  partOfSpeech: string[];
  information: string[];
  restrictions: string[];
  glosses: string[];
};
type Entry = { sequence: number; forms: Form[]; senses: Sense[] };

const args = process.argv.slice(2);
function option(name: string, fallback: string): string {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1]! : fallback;
}

const jmdictPath = resolve(option('--jmdict', 'assets/source/JMdict.xml'));
const jmnedictPath = resolve(
  option('--jmnedict', 'assets/source/JMnedict.xml')
);
const outputPath = resolve(
  option('--output', 'assets/runtime/dictionary.sqlite')
);
const buildPath = `${outputPath}.building`;

rmSync(buildPath, { force: true });
rmSync(`${buildPath}-shm`, { force: true });
rmSync(`${buildPath}-wal`, { force: true });
execFileSync(
  resolve('node_modules/.bin/drizzle-kit'),
  ['push', '--force', '--config', 'drizzle.config.ts'],
  {
    env: { ...process.env, WAKARU_DICTIONARY_PATH: buildPath },
    stdio: 'inherit',
  }
);

const sqlite = new Database(buildPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('foreign_keys = ON');
const database = drizzle(sqlite);

const insertEntry = database
  .insert(entries)
  .values({
    source: placeholder('source'),
    sequence: placeholder('sequence'),
  })
  .returning({ id: entries.id })
  .prepare();
const insertForm = database
  .insert(forms)
  .values({
    entryId: placeholder('entryId'),
    text: placeholder('text'),
    kind: placeholder('kind'),
    priority: placeholder('priority'),
    restrictions: placeholder('restrictions'),
  })
  .prepare();
const insertSense = database
  .insert(senses)
  .values({
    entryId: placeholder('entryId'),
    position: placeholder('position'),
    partOfSpeech: placeholder('partOfSpeech'),
    information: placeholder('information'),
    restrictions: placeholder('restrictions'),
  })
  .returning({ id: senses.id })
  .prepare();
const insertGloss = database
  .insert(glosses)
  .values({
    senseId: placeholder('senseId'),
    position: placeholder('position'),
    text: placeholder('text'),
  })
  .prepare();

function priorityScore(priorities: readonly string[]): number {
  let score = 0;
  for (const priority of priorities) {
    if (/^(ichi|news|spec|gai)1$/.test(priority)) score = Math.max(score, 3);
    else if (/^(ichi|news|spec|gai)2$/.test(priority))
      score = Math.max(score, 2);
    else if (/^nf\d+$/.test(priority)) score = Math.max(score, 1);
  }
  return score;
}

function insertDictionaryEntry(source: DictionarySource, entry: Entry): void {
  if (!entry.sequence || !entry.forms.length || !entry.senses.length) return;
  const insertedEntry = insertEntry.get({ source, sequence: entry.sequence });
  if (!insertedEntry) throw new Error('Failed to insert dictionary entry.');
  const entryId = insertedEntry.id;
  for (const form of entry.forms) {
    insertForm.run({
      entryId,
      text: form.text,
      kind: form.kind,
      priority: priorityScore(form.priorities),
      restrictions: form.restrictions,
    });
  }
  entry.senses.forEach((sense, senseIndex) => {
    if (!sense.glosses.length) return;
    const insertedSense = insertSense.get({
      entryId,
      position: senseIndex,
      partOfSpeech: sense.partOfSpeech,
      information: sense.information,
      restrictions: sense.restrictions,
    });
    if (!insertedSense) throw new Error('Failed to insert dictionary sense.');
    sense.glosses.forEach((gloss, glossIndex) => {
      insertGloss.run({
        senseId: insertedSense.id,
        position: glossIndex,
        text: gloss,
      });
    });
  });
}

function readEntities(path: string): Record<string, string> {
  const descriptor = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(2 * 1024 * 1024);
    const length = readSync(descriptor, buffer, 0, buffer.length, 0);
    const header = buffer.toString('utf8', 0, length);
    const entities: Record<string, string> = {};
    for (const match of header.matchAll(
      /<!ENTITY\s+([\w.-]+)\s+(["'])(.*?)\2\s*>/g
    )) {
      entities[match[1]!] = match[3]!;
    }
    return entities;
  } finally {
    closeSync(descriptor);
  }
}

async function importXml(
  path: string,
  source: DictionarySource
): Promise<number> {
  const parser = new SaxesParser({ xmlns: false });
  Object.assign(parser.ENTITIES, readEntities(path));
  let entry: Entry | null = null;
  let form: Form | null = null;
  let sense: Sense | null = null;
  let activeLanguage = 'eng';
  let text = '';
  let count = 0;

  parser.on('opentag', (tag: SaxesTagPlain) => {
    activeLanguage = String(tag.attributes['xml:lang'] ?? 'eng');
    text = '';
    if (tag.name === 'entry') {
      entry = { sequence: 0, forms: [], senses: [] };
    } else if (tag.name === 'k_ele') {
      form = { text: '', kind: 'written', priorities: [], restrictions: [] };
    } else if (tag.name === 'r_ele') {
      form = { text: '', kind: 'reading', priorities: [], restrictions: [] };
    } else if (tag.name === 'sense' || tag.name === 'trans') {
      sense = {
        partOfSpeech: [],
        information: [],
        restrictions: [],
        glosses: [],
      };
    }
  });
  parser.on('text', (value: string) => {
    text += value;
  });
  parser.on('closetag', (tag) => {
    const value = text.trim();
    const tagName = tag.name;
    if (entry && tagName === 'ent_seq') entry.sequence = Number(value);
    else if (form && (tagName === 'keb' || tagName === 'reb'))
      form.text = value;
    else if (form && (tagName === 'ke_pri' || tagName === 're_pri')) {
      if (value) form.priorities.push(value);
    } else if (form && tagName === 're_restr') {
      if (value) form.restrictions.push(value);
    } else if (sense && (tagName === 'pos' || tagName === 'name_type')) {
      if (value) sense.partOfSpeech.push(value);
    } else if (sense && tagName === 's_inf') {
      if (value) sense.information.push(value);
    } else if (sense && tagName === 'trans_det' && activeLanguage === 'eng') {
      if (value) sense.glosses.push(value);
    } else if (sense && (tagName === 'stagk' || tagName === 'stagr')) {
      if (value) sense.restrictions.push(value);
    } else if (sense && tagName === 'gloss' && activeLanguage === 'eng') {
      if (value) sense.glosses.push(value);
    } else if (entry && form && (tagName === 'k_ele' || tagName === 'r_ele')) {
      if (form.text) entry.forms.push(form);
      form = null;
    } else if (entry && sense && (tagName === 'sense' || tagName === 'trans')) {
      if (!sense.partOfSpeech.length) {
        sense.partOfSpeech.push(...(entry.senses.at(-1)?.partOfSpeech ?? []));
      }
      if (sense.glosses.length) entry.senses.push(sense);
      sense = null;
    } else if (entry && tagName === 'entry') {
      insertDictionaryEntry(source, entry);
      entry = null;
      count += 1;
      if (count % 10_000 === 0) process.stdout.write(`\r${source}: ${count}`);
    }
    text = '';
  });
  parser.on('error', (error: Error) => {
    throw error;
  });

  sqlite.exec('BEGIN');
  try {
    for await (const chunk of createReadStream(path, { encoding: 'utf8' })) {
      const value: unknown = chunk;
      if (typeof value !== 'string') {
        throw new TypeError('Dictionary stream returned a non-text chunk.');
      }
      parser.write(value);
    }
    parser.close();
    sqlite.exec('COMMIT');
  } catch (error) {
    sqlite.exec('ROLLBACK');
    throw error;
  }
  process.stdout.write(`\r${source}: ${count}\n`);
  return count;
}

try {
  const jmdictCount = await importXml(jmdictPath, 'jmdict');
  const jmnedictCount = await importXml(jmnedictPath, 'jmnedict');
  database
    .insert(metadata)
    .values([
      { key: 'schema_version', value: '2' },
      { key: 'built_at', value: new Date().toISOString() },
      { key: 'language', value: 'eng' },
      { key: 'jmdict_entries', value: String(jmdictCount) },
      { key: 'jmnedict_entries', value: String(jmnedictCount) },
    ])
    .run();
  sqlite.exec(
    'ANALYZE; PRAGMA optimize; PRAGMA journal_mode = DELETE; VACUUM;'
  );
} finally {
  sqlite.close();
}

rmSync(outputPath, { force: true });
renameSync(buildPath, outputPath);
process.stdout.write(`Built ${outputPath}\n`);
