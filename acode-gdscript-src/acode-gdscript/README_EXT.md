# Godot - GDScript Support DX — Extended Documentation

GDScript 4.x support for Acode 1.12.x+ (CodeMirror 6 engine): syntax
highlighting, autocomplete (keywords, annotations — with parameter
tabstops for the ones that need them, since 0.7.0 — types, common Godot
classes/nodes, global functions and constants, common members after `.`,
and — since 0.2.0 — your own functions/variables/constants/signals/
class_name declared in the current file), snippets, code folding by
indentation/`#region`, automatic indentation on Enter, hover tooltips,
and — since 0.5.0 — signature help while typing a function call.

> This is the extended/developer documentation: architecture, runtime
> internals, how to extend the curated data, and known limitations. For
> a short overview, see [README.md](https://github.com/Repechul/Acode-Plugin---Godot-GDScript-Support-DX/blob/main/acode-gdscript-src/acode-gdscript/README.md).
> Also available in Spanish: [README_EXT_ES.md](https://github.com/Repechul/Acode-Plugin---Godot-GDScript-Support-DX/blob/main/acode-gdscript-src/acode-gdscript/README_EXT_ES.md).

## Project status

Version 0.9.2. The tokenizer, folding, autocomplete data, document
symbol scanning, and signature-help call/argument detection have
automated tests (`npm test`) and they pass. Every release through 0.5.0
has also been confirmed working on a real device, including the
hand-wired `StateField`/`showTooltip` piece behind signature help (all 8
scenarios in the manual test script) that the automated tests alone
couldn't fully guarantee. The 0.9.2 tokenizer/highlighting-tag changes
(see `CHANGELOG.md`) are covered by new regression tests but, unlike
earlier releases, haven't yet been confirmed against a real esbuild
build or on a real device. Automated tests only prove the logic in
isolation — see "The delicate part: the runtime shims" section below
before installing a build this README hasn't specifically called out as
device-tested, and "Known limitations" below for what's a deliberate
scope limit rather than an open risk.

## Installation (to use the plugin)

1. `npm install`
2. `npm run build` → generates `dist/main.js`
3. `npm run zip` → generates an installable `.zip`
4. In Acode: Settings → Plugins → "+" → Local → select the `.zip`

You can also use `npm run dev` (local server with reload) and add the
plugin as "Remote" in Acode pointing to `http://<your-ip>:3000`, useful
while debugging on your own device/emulator.

## Before anything else: customize `plugin.json`

Change `id` (use your own reverse-domain name, e.g.
`com.yourusername.gdscript`), `author.name`, `author.email`, and, if you
want, `author.github`. The `id` must be unique and matches the one used
by `src/main.js` (the `PLUGIN_ID` constant) — if you change it in one
place, change it in the other too.

## The delicate part: the runtime shims

Acode already loads its own copy of `@codemirror/*` and `@lezer/*`. If
this plugin bundled **its own** copy of those packages (the normal
outcome of `npm install @codemirror/language` and bundling), CodeMirror
6's internal identity checks (Facets, StateFields) would silently fail:
highlighting, folding, or autocomplete simply wouldn't apply, with no
obvious visible error.

That's why this plugin does **not** install those packages as real
dependencies. Instead:

- Each file in `src/runtime/` tries to obtain, via
  `acode.require("@codemirror/language")` (and variants), the **same
  instance** that Acode already uses. This is exactly the pattern used by
  the official `Acode-Foundation/acode-additional-langmodes` plugin.
- **That resolution is deliberately lazy.** `main.js` no longer statically
  imports `src/language/index.js`: it does so with a dynamic `import()`,
  inside the `loader` passed to `editorLanguages.register(...)`. Thanks to
  that, `register()` (which is what makes Acode recognize the `.gd`
  extension) runs **without touching any CodeMirror/Lezer module**, and
  those modules are only resolved when Acode actually invokes that
  loader — i.e., when the "gdscript" mode is genuinely needed for a file.
  This eliminates the startup race condition that could previously abort
  the whole plugin load if `acode.require(...)` wasn't ready at the exact
  instant Acode evaluated the plugin's script (typically when reopening
  the app with a `.gd` file already open from before).
- **Before firing that `import()`, the plugin actively waits (with
  retries) for `@codemirror/language`/`@lezer/highlight` to be ready**
  (`waitForCmRuntime` in `main.js`, up to 4s, polling every 60ms). This was
  needed because, when verifying the previous point at runtime (not just
  by reading the code), it turned out that dynamic `import()`, as compiled
  by esbuild, can only be "genuinely attempted" **once** per app session —
  if that single attempt happens to land at the exact instant Acode hasn't
  published those modules yet, it doesn't recover on its own even if Acode
  publishes them an instant later. Probing first with `resolveCmModule`
  (which is retryable, since it only caches successes) avoids wasting that
  single attempt on a transient startup failure.
- As an extra safety net for tabs that Acode restores from a previous
  session, `main.js` also listens for
  `editorManager.on("init-open-file-list", ...)` and forces
  `file.setMode("gdscript")` on any already-open `.gd`/`.gdscript` file
  that doesn't have it — in case Acode's tab restoration happens before
  this plugin gets to register itself.

This remains a **best effort, not a guarantee**, regarding the exact name
`acode.require(...)` uses to expose the CodeMirror/Lezer packages on your
specific Acode version — that hasn't changed. If, after installing the
plugin, highlighting or autocomplete don't show up:

1. Connect your device/emulator and open `chrome://inspect` in desktop
   Chrome → inspect Acode's WebView.
2. In the console, look for the error printed by
   `src/runtime/resolve-cm-module.js` (starts with `[gdscript] Could not
   resolve module...`) — it lists the names it tried.
3. Explore what Acode exposes, for example:
   ```js
   Object.keys(acode._modules || acode.modules || {})
   ```
   or check Acode's own source code (`Acode-Foundation/Acode` on GitHub)
   to see where it registers `"editorLanguages"`, to check whether it also
   registers the CodeMirror packages under some name.
4. Add the correct name to the front of the corresponding array in
   `CANDIDATE_ALIASES` inside `src/runtime/resolve-cm-module.js` and
   rebuild.

If you'd rather not depend on this, the alternative is to contribute
GDScript support directly as a module inside
`Acode-Foundation/acode-additional-langmodes` (they already have these
shims solved); it was left out of this plugin because a standalone,
independently branded plugin was requested.

## Optional: `minVersionCode`

`plugin.json` doesn't include `minVersionCode` (Acode's minimum version
code) because it wasn't possible to verify exactly which value
corresponds to 1.12.x. If you want to enforce a minimum version, check
`docs.acode.app/docs/plugin-essentials/manifest` for the correct value
and add it yourself.

## Architecture

```
src/
  main.js                 Entry point: acode.setPluginInit/setPluginUnmount,
                           registers "gdscript" via acode.require("editorLanguages")
  language/
    tokenizer.js            StreamParser (highlighting) + custom tag table
    keywords.js              Keywords, annotations, basic types
    globals.js                 @GDScript / @GlobalScope functions/constants
    classes.js                   Common engine classes/nodes ("broad" scope)
    members.js                     Common Node/Object members for autocomplete after "."
    document-symbols.js              Scans the current file for func/var/const/
                                      signal/class_name the user declares (0.2.0)
    snippets.js                        Snippets with tabstops (func, _ready, if, for, match...)
    completions.js                       Autocomplete source that combines all of the above
    folding.js                             Folding by indentation and by #region/#endregion (foldService)
    indent.js                                Automatic indentation on Enter (StreamParser's indent())
    hover.js                                   Hover tooltip on known symbols (curated data +
                                                document-symbols.js; local symbols take priority)
    signature-help.js                            Signature help while typing a call: which
                                                  function, which argument (StateField + showTooltip)
    index.js                                       Assembles StreamLanguage + LanguageSupport
  runtime/
    resolve-cm-module.js    Best-effort resolver (see section above)
    codemirror-*.js          Shims that re-export from Acode's runtime
    lezer-*.js
test/
  mock-acode.mjs           Mock of `acode` + of the CM/Lezer modules for testing with Node
  fake-stream.mjs           Minimal StringStream mock
  *.test.mjs                 Tests (tokenizer, folding, completions, document symbols,
                            signature help, integration)
```

## How to extend the data

All the GDScript knowledge lives in plain data arrays/objects, designed
to be edited without touching logic:

- **More keywords/annotations/types** → `src/language/keywords.js`
- **More global functions or constants** → `src/language/globals.js`
  (add `{ name, params, detail, info }`)
- **More engine classes/nodes** → `src/language/classes.js`
  (add `{ name, info }`) — the current scope is "broad" (core + common
  2D/3D/UI nodes), not the full Godot API (that would be several hundred
  classes). If you want to expand it, the most reliable source is the XML
  dump in `doc/classes/*.xml` from Godot's own repository.
- **More members after "."** → `src/language/members.js`. Keep in mind
  the plugin doesn't do real type inference: it always offers the same
  curated set, regardless of the expression's actual type.
- **More snippets** → `src/language/snippets.js` (`${n:placeholder}`
  format used by `@codemirror/autocomplete`)

Hover tooltips (`hover.js`) are built automatically from the `info`/
`detail` fields in `classes.js`/`globals.js`/`members.js`/`keywords.js` —
extending any of those also extends what hover covers, no separate step
needed.

Your own `func`/`var`/`const`/`signal`/`class_name` declarations don't
need any curated data at all: `document-symbols.js` scans the current
file's text directly and feeds both autocomplete and hover automatically
(see "Known limitations" below for what this scan does and doesn't do).

## Running the tests

```
npm test
```

Runs `node --test test/*.test.mjs`. The tests use a mock of `acode` and
of the CodeMirror/Lezer packages, so they verify the plugin's own logic
(tokenizer, folding, autocomplete data) but **do not** replace testing
the actual plugin inside Acode.

## Known limitations

- Autocomplete after "." doesn't infer the expression's real type; it
  offers a curated set of common Node/Object members.
- Automatic indentation on Enter (`indent.js`) raises/lowers the level
  using text heuristics (`:` at the end of a line,
  `pass`/`break`/`continue`/`return`, realigning `else`/`elif`), just
  like Python modes in other editors do — it's not a real parser, so
  there are rare cases it gets wrong (e.g. a `pass` that isn't actually
  the last statement of the block). **Design note (v3, 0.1.5):** it
  doesn't assume any specific character represents "one level" — it
  stores each line's raw indentation text and only converts it to
  columns using `context.unit` (the real configured level width) at the
  point that value is available inside `indent()`, not while tokenizing.
  This avoids depending on `context.state.doc`/`context.pos` (see the
  0.1.3 changelog entry for why the very first version of this broke on a
  real device) and works whether a level is represented with tabs,
  spaces, or (within a single line) a mix.
- The set of engine classes is "broad" but not exhaustive (see above for
  how to extend it).
- Hover tooltips (`hover.js`) cover curated data (classes/globals/
  members/types) **and**, since 0.2.0, your own declarations in the
  current file (`document-symbols.js`) — but still no real type
  inference: hovering `enemy` in `enemy.queue_free()` won't tell you it's
  an `Enemy`, it only recognizes the identifier `enemy` itself if it was
  declared somewhere in the file. Also depends on CodeMirror's
  `hoverTooltip`, which listens for mouse hover; on a touchscreen with no
  mouse/stylus connected it may not trigger at all, depending on whether
  Acode's WebView synthesizes hover events for a long-press. Most
  reliable with an external mouse connected to the device.
- **Document symbol scanning (`document-symbols.js`, 0.2.0)** — powers
  both autocomplete and hover for your own `func`/`var`/`const`/`signal`/
  `class_name`. It's a line-oriented regex scan, not a parser, so:
  - Multi-line function signatures aren't recognized (the whole
    `func name(...) -> Type:` must fit on one line); if the closing `)`
    isn't found on the same line, the function still shows up in
    autocomplete (name only, no parameter/return detail) but not in
    every case — see the tests in `test/document-symbols.test.mjs` for
    the exact fallback behavior.
  - No scope resolution: a local variable declared inside one function
    is offered everywhere in the file, the same as a class-level member.
    It's a flat list of "things declared in this file", not a real
    symbol table.
  - Comments and single/triple-quoted strings are masked out before
    scanning (so a stray `func` inside a multi-line string doesn't get
    picked up as a real declaration) — best-effort, not a full copy of
    `tokenizer.js`'s own string/comment handling.
- **Signature help (`signature-help.js`, 0.5.0)** — shows the parameters
  of the function/method call the cursor is currently inside, using the
  same curated `params` data as autocomplete (plus your own functions
  from `document-symbols.js`). Same "no real type inference" limits
  apply, plus its own:
  - **Confirmed working on a real device** (all 8 scenarios in the
    manual test script — nested calls, multi-line calls, own functions
    taking priority over curated ones, the tooltip appearing/updating
    live while typing, and correctly *not* appearing for the cases
    below). Unlike every other feature, this one is wired by hand with a
    raw `StateField` + the `showTooltip` facet's `.computeN()` — every
    other feature goes through a higher-level CodeMirror helper
    (`StreamLanguage`, `foldService`, `hoverTooltip`) — following
    CodeMirror's own documented pattern for "tooltips that follow the
    cursor". The automated tests could only prove the call/argument
    detection logic and that the wiring calls the right functions, not
    that `showTooltip.computeN()` behaves inside Acode's real CodeMirror
    exactly like the docs describe — that part is now backed by the
    device test above, not just the mocks.
  - Constructors (`Vector2(...)`, `Color(...)`, etc.) don't show
    anything — only `BUILTIN_TYPES` names exist for those, with no
    curated parameter data.
  - If the cursor is inside an array/dictionary literal that is itself
    one of the call's arguments (e.g. `foo([1, 2, |])`), no signature is
    shown for the outer call — deliberately not implemented, to keep the
    detection logic (`findActiveCall()` in `signature-help.js`) simple
    and easy to get right, rather than trying to "see through" nested
    literals.
  - Calls with zero parameters don't show a tooltip at all (nothing
    useful to highlight).
- **Annotations (`ANNOTATIONS` in `keywords.js`, 0.7.0)** — parameterized
  `@export_*` annotations now insert a snippet with tabstops
  (`@export_range(min, max, step)`) instead of just the bare name, and
  hovering over an annotation now shows what it does (both were missing
  before 0.7.0 — annotations were plain name-only completions with zero
  hover support). Variable-arity ones (`@export_enum`, `@export_flags`,
  `@export_node_path`, `@warning_ignore*`) get a *single* tabstop
  pre-filled with example text (e.g. `"A", "B", "C"`) rather than a
  fixed number of fields, since the real argument count varies. Curated,
  not exhaustive — the full annotation set is small enough that this
  covers the vast majority of it, but if a newer Godot 4.x minor version
  adds one this doesn't know about yet, it just won't autocomplete.
  `PROPERTY_HINT_*` constants (`GLOBAL_CONSTANTS` in `globals.js`) are a
  curated subset of the ~40-entry `PropertyHint` enum, prioritizing the
  ones with no friendlier `@export_*` shorthand (`PROPERTY_HINT_TYPE_STRING`,
  `PROPERTY_HINT_EXPRESSION`, `PROPERTY_HINT_LINK`, etc.) plus the most
  common ones useful for a manual `_get_property_list()` override.
- **`COMMON_MEMBERS` (0.8.0)** deliberately does NOT include members of
  singletons like `Input`, `Engine`, `OS`, `ProjectSettings` — even
  though something like `Input.is_action_pressed()` is used constantly.
  Reason: `memberOptions` is also mixed into `topLevelOptions` (methods
  are called without `self.` in GDScript), so anything added here shows
  up both after a dot AND bare, anywhere in the code. That's correct for
  `queue_free()` (valid on its own, as an implicit-self method) but
  would be misleading for `is_action_pressed()` (only ever valid as
  `Input.is_action_pressed()`, never bare) — offering it bare would
  suggest an invalid call as if it were the script's own method.
- **`GLOBAL_FUNCTIONS` (0.9.0)** received its first gap-check since the
  project's original baseline (107 → 118): inverse hyperbolic functions
  (`acosh`/`asinh`/`atanh`), `angle_difference`, Bézier/cubic
  interpolation, decibel conversion (`db_to_linear`/`linear_to_db`),
  `is_same`, `get_stack`, `error_string`, and the `_with_objects`
  variants of `bytes_to_var`/`var_to_bytes`. Deliberately **not**
  added: `cubic_interpolate_in_time`/`cubic_interpolate_angle_in_time`
  — real @GlobalScope functions, but with 8 parameters each (custom
  timing per control point), too specialized and heavy for a snippet to
  carry any real value; the plain `cubic_interpolate`/
  `cubic_interpolate_angle` cover the common case.
- The runtime shims are still best-effort regarding the exact name
  `acode.require(...)` exposes — see the dedicated section above — though
  since 0.1.3 a failure there can no longer take down the whole plugin
  load or the recognition of the `.gd` extension.

## Credits

Build architecture (redirecting `@codemirror/*`/`@lezer/*` to local
shims) inspired by Acode-Foundation's official `acode-additional-langmodes`
plugin, adapted here for a standalone plugin.
