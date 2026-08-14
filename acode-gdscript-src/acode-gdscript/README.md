# Godot - GDScript Support DX

GDScript 4.x language support for [Acode](https://acode.app), the
Android code editor — built on Acode's CodeMirror 6 engine (1.12.x+).

## What it does

Turns Acode into a capable GDScript editor, entirely on-device:

- **Syntax highlighting** for the full GDScript 4.x language: keywords,
  control flow, annotations (`@export`, `@onready`...), built-in and
  engine types, strings, numbers, operators, and comments (including
  `##` doc comments).
- **Autocomplete** for keywords, annotations, built-in types, common
  engine classes/nodes, global functions/constants, common members
  after `.`, and your own `func`/`var`/`const`/`signal`/`class_name`
  declared in the current file.
- **Snippets** for common patterns and engine callbacks (`_ready`,
  `_process`, `if`, `for`, `match`...).
- **Code folding** by indentation and by `#region`/`#endregion`.
- **Automatic indentation** on Enter.
- **Hover tooltips** on known symbols.
- **Signature help** while typing a function or method call.

## Get it / source code

Source code, build instructions, and releases live in the GitHub
repository:

**[Godot - GDScript Support DX](https://github.com/Repechul/Acode-Plugin---Godot-GDScript-Support-DX)**

## Full documentation

This file is a short overview. For the architecture, the runtime
internals, how to extend the curated data, and the full list of known
limitations:

- [README_EXT.md](https://github.com/Repechul/Acode-Plugin---Godot-GDScript-Support-DX/blob/main/acode-gdscript-src/acode-gdscript/README.md) — English
- [README_EXT_ES.md](https://github.com/Repechul/Acode-Plugin---Godot-GDScript-Support-DX/blob/main/acode-gdscript-src/acode-gdscript/README_EXT_ES.md) — Español

Version history: [CHANGELOG.MD - English](https://github.com/Repechul/Acode-Plugin---Godot-GDScript-Support-DX/blob/main/acode-gdscript-src/acode-gdscript/CHANGELOG.md)
[CHANGELOG_ES.MD - Español](https://github.com/Repechul/Acode-Plugin---Godot-GDScript-Support-DX/blob/main/acode-gdscript-src/acode-gdscript/CHANGELOG_ES.md)).

## Have a bug or issue?

Please report it here:
**[github.com/Repechul/Acode-Plugin---Godot-GDScript-Support-DX/issues](https://github.com/Repechul/Acode-Plugin---Godot-GDScript-Support-DX/issues)**

## License

MIT — see `plugin.json`.
