# Wakaru

Wakaru is an Electron desktop app for Japanese word mining. It performs fast
offline dictionary lookup from a bundled JMdict/JMnedict SQLite database, can
optionally use an OpenAI-compatible model endpoint to rank senses and fill
examples, stores mined words locally, and exports TSV for Anki or other tools.

## Workflow

1. Enter a Japanese word or phrase on the Mine page.
2. Optionally add a context sentence.
3. Review offline dictionary candidates.
4. Save the best candidate to the local library.
5. Export `export.tsv` from the Library page.

Saved words are stored in SQLite. Dictionary senses are deduplicated by their
dictionary, entry and sense identifiers. Generated and manual candidates are not
deduplicated.

## Requirements

- Node.js 24 LTS or newer.
- pnpm 10.
- Offline dictionary assets in `assets/runtime/`.
- Optional: an OpenAI-compatible model endpoint. Ollama is the default.

## Quickstart

```bash
pnpm install
pnpm build:dictionary
pnpm dev:electron
```

By default, Wakaru calls the OpenAI-compatible API exposed by Ollama at
`http://localhost:11434` and writes user data under `~/.config/wakaru`.

## Config

Copy `config.example.json` to `~/.config/wakaru/config.json` and adjust the
model endpoint if required. The Settings page can edit the same config shape.

Wakaru validates user-authored JSON with Zod and reports field-level errors.

## Dictionary

Build the local English dictionary after downloading `JMdict.xml` and
`JMnedict.xml` into `assets/source/`:

```bash
pnpm build:dictionary
```

The app reads `assets/runtime/dictionary.sqlite`; it does not parse XML at
runtime. Custom paths can be supplied when refreshing the data:

```bash
pnpm build:dictionary -- \
  --jmdict path/to/JMdict.xml \
  --jmnedict path/to/JMnedict.xml \
  --output assets/runtime/dictionary.sqlite
```

Set `WAKARU_DICTIONARY` or `WAKARU_TOKENISER_DICTIONARY` to override packaged
assets. TSV exports and the writable `words.sqlite` database default to the
directory containing `config.json`; `WAKARU_WORD_DATABASE` overrides only the
database path.

## Development

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build:electron
```

Use `pnpm format` to apply Prettier formatting. Markdown is wrapped at 80
columns through `prettier.config.js`.
