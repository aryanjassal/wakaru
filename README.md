# Wakaru

Wakaru is a Rezi-based TUI for Japanese sentence and word mining. Paste a
sentence, paragraph, or short list of words, ask a local Ollama model to explain
useful candidates in context, then choose which cards to add to an Anki import
file.

## Workflow

1. Paste Japanese text into the Mine screen.
2. Run analysis with `ctrl+a` or the command palette.
3. Review the model's candidates and context-specific meanings.
4. Press `enter` to add the selected candidate or `x` to skip it.
5. Import `anki-import.tsv` from the configured words directory into Anki.

Saved words are stored as JSON and the Anki TSV is regenerated whenever a word
is added.

## Requirements

- Node.js 18 or newer.
- Ollama running locally.
- A local model available through Ollama, such as `qwen3.5:9b`.

## Quickstart

```bash
npm install
npm run start
```

By default, Wakaru calls Ollama at `http://localhost:11434` and writes files to
`~/.config/wakaru/words`.

## Config

Copy `assets/config.json.example` to `~/.config/wakaru/config.json` and adjust
the model, storage directory, or theme.

```json
{
  "llm": {
    "provider": "ollama",
    "model": "qwen3.5:9b",
    "apiBase": "http://localhost:11434"
  },
  "storage": {
    "wordsDir": "~/.config/wakaru/words"
  },
  "theme": {
    "name": "night",
    "customPath": "~/.config/wakaru/theme.json"
  }
}
```

Wakaru validates user-authored JSON with Zod and reports field-level errors.

## Custom Themes

Set `theme.name` to `custom` and point `theme.customPath` at a JSON file. You can
copy `assets/theme.json.example` as a starting point. Theme files are loaded at
startup, so changing colors does not require recompiling.

Color values must be 6-digit hex strings:

```json
{
  "label": "Matcha",
  "colors": {
    "base": "#101510",
    "panel": "#1c281d",
    "text": "#eef5ea",
    "accent": "#8bcf8b"
  }
}
```

## Keybindings

| Key           | Command             |
| ------------- | ------------------- |
| `q`, `ctrl+c` | Quit                |
| `1`           | Mine screen         |
| `2`           | Library screen      |
| `3`           | Settings screen     |
| `tab`         | Next screen         |
| `shift+tab`   | Previous screen     |
| `ctrl+p`      | Command palette     |
| `ctrl+a`      | Analyze pasted text |
| `enter`       | Add selected word   |
| `x`           | Skip selected word  |
| `ctrl+e`      | Rewrite Anki TSV    |
| `t`           | Cycle theme         |

## Development

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
```

Use `npm run format` to apply Prettier formatting. Markdown is wrapped at 80
columns through `prettier.config.js`.
