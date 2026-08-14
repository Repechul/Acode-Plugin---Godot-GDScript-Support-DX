# Changelog

> This changelog is also available in Spanish: [CHANGELOG_ES.md](CHANGELOG_ES.md).

## 0.9.2

- **Fix: highlighting mismatches found by cross-checking `tokenizer.js`/
  `keywords.js` against the separately-maintained Spectrum Theme plugin**
  (an editor theme, not part of this package, that maps our tags to
  colors). Comparing what the tokenizer emits against the theme's rules
  and palette comments surfaced several cases where the wrong tag was
  chosen, or where two distinct concepts shared one tag:
  - `@export`/`@onready`/etc. annotations now use `tags.attributeName`
    instead of `tags.meta`, matching the theme's dedicated "Annotation
    Color" slot.
  - `void` now resolves to `typeName` like `int`/`float`/`bool`, instead
    of being caught earlier as a generic keyword — it was listed in both
    `BUILTIN_TYPES` and `OTHER_KEYWORDS`; removed from the latter.
  - `extends SomeClass` now tags the base class name as `engineType` if
    it's a built-in engine class, or `className` otherwise (assumed to be
    a `class_name`-declared class in another file — see `engineType`
    below). Previously this only worked for engine classes, by
    coincidence (caught later by the known-types check); anything else
    fell through to a plain variable color.
  - `##` doc-comments (real GDScript 4 syntax, distinct from a plain `#`)
    now tag as `docComment` instead of `lineComment`. `#region`/
    `#endregion` deliberately keep the plain `lineComment` tag: in
    Godot's own editor they're a folding convention only, with no
    special text color, and `folding.js` already detects them
    independently by raw line text.
  - `const` now tags its name with a new `constantDefinition` token
    (`tags.constant(tags.variableName)`), distinct from `var`'s
    `variableDefinition` — previously both were identical.
  - A method call right after a dot (`sprite.play()`) now tags with a
    new `methodName` token (`tags.function(tags.propertyName)`),
    distinct from plain property access (`sprite.position`) — previously
    both were always `propertyName`.
  - `functionName` simplified from a doubly-modified tag
    (`function(definition(variableName))` — no exact rule in the theme,
    relying on undocumented tie-breaking between two equally-specific
    partial rules) to plain `function(variableName)`, matching the
    theme's existing "Function Definition Color" rule exactly.
  - `nodePath` (`$Path`, `%Unique`, `^"..."`) now uses `tags.url` instead
    of sharing `tags.special(tags.string)` with StringName literals
    (`&"..."`), so the two can be colored differently.

  8 new regression tests (`test/tokenizer.test.mjs`), including direct
  checks against `gdscriptTokenTable` for the three fixes that only
  change which `Tag` a token maps to, not the token string itself (those
  are invisible to string-based assertions). Extended the test mock
  (`test/mock-acode.mjs`) with the `docComment`/`attributeName`/`url`
  tags and the `constant()` modifier, none of which were previously
  exercised by any code path.

- **Fix: three more highlighting mismatches, found on a second pass after
  the Spectrum Theme's palette was reorganized with comments naming
  Godot's own Text Editor > Theme > Highlighting settings.** Matching the
  tokenizer against those labels surfaced more cases where Godot uses
  independent colors this package's tags didn't distinguish:
  - Engine classes (`Node2D`, `Control`...) now tag as a new `engineType`
    token (`tags.standard(tags.typeName)`), separate from `typeName`
    (`BUILTIN_TYPES`: `Vector2`, `float`, `bool`...). Previously both
    lists fed one combined set and always returned `typeName`. (`Object`
    appears in both lists; `BUILTIN_TYPES` wins, checked first.)
  - A bare call with no dot (`_refresh_inspector()`, implicit `self`) is
    now detected at all — previously only a call right after a dot
    (`sprite.play()`) was recognized as a call; anything else fell to
    plain `variableName`. A bare call now tags as `methodName` (same
    token as a dotted call), or as a new `globalFunctionCall` token
    (`tags.standard(tags.variableName)`) when the name matches
    `GLOBAL_FUNCTIONS` — Godot's real `@GlobalScope`: `print`, `randi`,
    `lerp`, etc.
  - `extends` reuses the same `engineType`/`className` split (see above),
    instead of always tagging `typeName` regardless of which kind of
    class it is.

  6 new regression tests. Extended the test mock with the `standard()`
  modifier. `npm test`: 212/212 passing.

  Both rounds only change which tag `tokenizer.js` emits. Making the new
  tags actually render with distinct colors — plus separating method/
  function calls (`function(propertyName)`) from function definitions,
  which still shared one color even with a distinct tag — needed matching
  additions on the Spectrum Theme side, applied directly to that plugin's
  `main.js` (outside this package, not covered by `npm test` here). Not
  yet validated against a real esbuild build or on a real device.

- **Rebrand for the public release: plugin renamed to "Godot - GDScript
  Support DX"** — `plugin.json`'s `name` and `id` (now
  `acode.plugin.repechul.godot.gdscript.support.dx`) were updated,
  mirrored in `src/main.js`'s `PLUGIN_ID` constant (the two must stay in
  sync — see the comment next to it). New plugin icon (`icon.png`), also
  Godot-themed.
- **Docs restructured ahead of the public release.** The previous
  `README.md`/`README_ES.md` — full technical documentation covering the
  runtime shims, architecture, how to extend the curated data, and known
  limitations — are now `README_EXT.md`/`README_EXT_ES.md`. `README.md`
  is new: a short, English-only overview of what the plugin does and
  which GDScript features it covers, linking out to the GitHub
  repository and its issue tracker. It's still the file `plugin.json`'s
  `readme` field points to, so it's what Acode shows for the plugin.
  `pack-zip.js`'s `filesToInclude` list, and the source comments that
  pointed to `README.md` for troubleshooting/limitation details
  (`resolve-cm-module.js`, `signature-help.js`, `esbuild.config.mjs`),
  were updated to point to `README_EXT.md`, where that content now
  lives.

## 0.9.0

- **New: `GLOBAL_FUNCTIONS`'s first gap-check since the project's
  original baseline** (107 → 118) — closes out the roadmap-update
  suggestion to review the one data file that had never been
  revisited. Added: inverse hyperbolic functions (`acosh`, `asinh`,
  `atanh`), `angle_difference` (normalized angle difference in
  [-PI, +PI]), Bézier curve functions (`bezier_interpolate`,
  `bezier_derivative`), cubic interpolation (`cubic_interpolate`,
  `cubic_interpolate_angle`), audio decibel conversion (`db_to_linear`,
  `linear_to_db`), `is_same` (reference-identity comparison, distinct
  from `==`), `get_stack` (call stack as data, complementing
  `print_stack`), `error_string` (human-readable text for an `Error`
  code — pairs naturally with `push_error()`), and the
  `_with_objects` variants of `bytes_to_var`/`var_to_bytes` (allow
  encoding/decoding Objects, not just plain Variants). Every signature
  cross-checked against official Godot sources before adding — several
  (the inverse hyperbolic trio, `angle_difference`, the Bézier/cubic
  functions) were confirmed via the exact parameter lists in Godot's
  own `@GlobalScope` RST reference. Deliberately excluded:
  `cubic_interpolate_in_time`/`cubic_interpolate_angle_in_time` (real,
  but 8 parameters each and too specialized to be worth a snippet) and
  a generic `wrap()` (only the typed `wrapf`/`wrapi` appear to exist;
  no evidence of a `Variant`-typed sibling, unlike `abs`/`ceil`/`floor`
  and friends). 5 new spot-check tests (`completions.test.mjs`,
  `hover.test.mjs`). `npm test`: 198/198 passing.
  **Update: confirmed working on a real device.**

## 0.8.0

- **New: more classes and members, closing out the "@export/PROPERTY_HINT
  + classes/members" data-coverage pass from 0.7.0.** `ENGINE_CLASSES`
  151 → 164: `VisibleOnScreenNotifier2D/3D`, `ResourcePreloader`,
  `AnimationNodeStateMachine`, `MultiplayerSpawner`/
  `MultiplayerSynchronizer` (Godot 4's high-level multiplayer nodes),
  `HTTPClient`, `Thread`, `Mutex`, `WeakRef`, `ResourceSaver`,
  `DisplayServer`, `ClassDB`. Checked first that math types (`Rect2`,
  `Transform2D/3D`, `Basis`, `Quaternion`, `Plane`, `AABB`) and
  `Callable`/`Signal` were already correctly in `BUILTIN_TYPES`
  (`keywords.js`), not missing — no duplicate/misplaced additions.
  `COMMON_MEMBERS` 68 → 91 (untouched since the project's original
  baseline, before this conversation ever expanded any other data
  file): node groups (`add_to_group`/`remove_from_group`/`is_in_group`),
  `show`/`hide`/`queue_redraw` (Godot 4 name, replaces the old
  `update()`), `rotation_degrees`/`global_rotation`/`look_at`,
  `is_queued_for_deletion`/`get_instance_id`/`set_process`/
  `set_physics_process`, plus two new member groups for classes that
  already existed in `ENGINE_CLASSES` but had zero member coverage:
  Timer (`start`/`stop`/`wait_time`/`one_shot`/`autostart`/`timeout`)
  and AnimationPlayer (`play`/`is_playing`/`current_animation`/
  `animation_finished`). **Deliberately excluded: singleton members**
  (`Input.is_action_pressed()` and similar) — `memberOptions` is mixed
  into `topLevelOptions`, so anything added there would incorrectly
  offer itself as a bare, self-implicit call; see the README for the
  full reasoning. Every name/signature checked against official Godot 4
  sources before adding (`queue_redraw` in particular has a real
  Godot-3-vs-4 naming history that's easy to get wrong). 7 new
  spot-check tests. `npm test`: 195/195 passing.
  **Update: confirmed working on a real device.**

## 0.7.0

- **New: full @export/PROPERTY_HINT coverage, with real functionality
  behind it, not just names.** `ANNOTATIONS` (`keywords.js`) was
  refactored from a flat string array into rich objects (`{name, params?,
  info}`), and 6 previously-missing annotations were added
  (`@export_flags_2d_navigation`, `@export_flags_3d_navigation`,
  `@export_storage`, `@export_exp_easing`, `@warning_ignore_start`,
  `@warning_ignore_restore`), for 28 → 34 total. The real upgrade is
  behavioral: `completions.js` now inserts a snippet with parameter
  tabstops for every annotation that takes them
  (`@export_range(${1:min}, ${2:max}, ${3:step})`, `@export_custom`,
  `@icon`, `@rpc`, `@export_tool_button`, etc.) instead of just the bare
  name — bare annotations (`@tool`, `@onready`, `@abstract`...) stay
  parenthesis-free, since adding `()` to those would be a syntax error.
  Variable-arity ones (`@export_enum`, `@export_flags`,
  `@export_node_path`, `@warning_ignore*`) get one tabstop pre-filled
  with example text rather than a fake fixed argument count. `hover.js`
  now also indexes `ANNOTATIONS` for the first time — hovering over
  `export_range` in `@export_range(...)` shows what it does; before
  0.7.0 annotations had zero hover support at all. Also added a curated
  19-entry subset of `PROPERTY_HINT_*` constants to `GLOBAL_CONSTANTS`
  (45 → 64), prioritizing hints with no friendlier `@export_*`
  shorthand. Every parameterized signature (`@export_range`, `@rpc`,
  `@export_tool_button`, `@export_group`, `@export_custom`...)
  cross-checked against the official Godot 4 docs before writing it, same
  discipline as classes.js/globals.js in earlier releases. 10 new tests
  (`completions.test.mjs`, `hover.test.mjs`). `npm test`: 189/189
  passing.
  **Update: confirmed working on a real device.**

## 0.6.0

- **New: 4 more snippets** (`SNIPPETS`, 20 → 24) — roadmap item 7, the
  data-only, low-risk kind, same spirit as 0.3.0/0.4.0. Three more
  engine callbacks: `_draw()` (CanvasItem — Node2D/Control, no
  parameters, for custom drawing), `_enter_tree()` and `_exit_tree()`
  (no parameters, run when a node enters/leaves the scene tree —
  `_enter_tree` in particular runs *before* `_ready`, useful for setup
  that must happen earlier). Signatures cross-checked against the
  official Godot 4 docs and real-world GDScript examples before adding,
  same practice as 0.3.0/0.4.0. These three automatically work with the
  existing "type `func ` + partial name" completion branch
  (`funcCallbackNameOptions` in `completions.js`, unchanged) since that
  logic already derives its list from any `SNIPPETS` entry whose label
  starts with `"func "` — no completions.js changes needed. Also added
  **"script skeleton"**: `extends`/`class_name`/`_ready` in one shot, to
  start a new script fast. Added to the existing parametrized test that
  covers the "func " + partial-name branch (now covering 8 callback
  names instead of 5), plus 2 new dedicated tests. `npm test`: 179/179
  passing.
  **Update: confirmed working on a real device.**

## 0.5.0

- **New: signature help.** While the cursor is inside a function/method
  call's parentheses, a tooltip now shows that call's parameters, with
  the current one highlighted — reuses the exact same curated `params`
  data that already powers autocomplete (`GLOBAL_FUNCTIONS`,
  `COMMON_MEMBERS`) plus your own functions from `document-symbols.js`
  (0.2.0), in the same priority order autocomplete already uses. No new
  data to maintain. New module `signature-help.js`:
  `findActiveCall(text, pos)` walks backward from the cursor over the
  same string/comment-masked text `document-symbols.js` already uses, to
  find the enclosing call and which comma-separated argument the cursor
  is in — correctly handling nested calls, multi-line calls, and
  ignoring parens that live inside strings; `resolveSignature(name, text)`
  looks up that call's parameter list.
  **Unlike every other feature added so far, this one is wired directly
  through CodeMirror's `StateField` + the `showTooltip` facet's
  `.computeN()`**, following CodeMirror's own documented pattern for
  cursor-following tooltips — `hover.js`, by contrast, uses the
  higher-level `hoverTooltip()` helper, which this project had already
  exercised successfully on a real device. This lower-level wiring is
  new territory: the mocked tests prove the call/argument detection
  logic is correct and prove `create`/`update`/`provide` are wired to
  the right functions, but they can't prove `showTooltip.computeN()`
  behaves inside Acode's real CodeMirror exactly like the docs describe.
  Deliberate scope limits, see the README: no signature for calls
  nested inside an array/dict literal argument, no data for built-in
  type constructors (`Vector2(...)` etc.), no tooltip for zero-parameter
  calls. 24 new tests in `test/signature-help.test.mjs`; also improved
  `test/mock-acode.mjs` (`StateField.define` now preserves its spec
  instead of discarding it, `showTooltip` mock now has `.computeN()`) so
  the wiring itself could be exercised, not just the pure logic behind
  it. `npm test`: 177/177 passing.
  **Update (same day): confirmed working on a real device**, all 8
  scenarios in a dedicated manual test script (nested calls, multi-line
  calls, own functions over curated ones, live updates while typing,
  and correctly absent for constructors/zero-param calls/nested
  literals) — including the hand-wired `StateField`/`showTooltip` piece
  that the mocked tests alone couldn't fully guarantee.

## 0.4.0

- **New: ~40 more global constants recognized in autocomplete and hover**
  (`GLOBAL_CONSTANTS`, 4 → 45). Data-only change, same as 0.3.0 (roadmap
  item 3). Until now this only covered the math constants (`PI`, `TAU`,
  `INF`, `NAN`). Added a curated subset of the engine enums that
  GDScript exposes as bare global constants (unlike a user-defined
  named enum, these don't need an `EnumName.` prefix): common `Error`
  codes (`OK`, `FAILED`, `ERR_FILE_NOT_FOUND`, `ERR_CANT_CONNECT`,
  `ERR_INVALID_PARAMETER`...) for the very common
  `if err != OK: ...` pattern, common `Key` codes (`KEY_SPACE`,
  `KEY_ESCAPE`, `KEY_ENTER`, arrow keys...), `MouseButton` constants
  (`MOUSE_BUTTON_LEFT/RIGHT/MIDDLE`, wheel up/down), and a small
  `JoyButton` subset (`JOY_BUTTON_A/B/X/Y`, `JOY_BUTTON_START`). Names
  cross-checked against the official Godot 4 class reference. Still a
  curated subset, not the full ~49-entry `Error` enum or the full `Key`
  enum (hundreds of entries) — see `globals.js`'s own comment for why.
  Two spot-check tests added (`completions.test.mjs`,
  `hover.test.mjs`), same reasoning as 0.3.0: the code that turns
  `GLOBAL_CONSTANTS` into completions/hover entries wasn't touched.
  `npm test`: 153/153 passing.
  **Update: confirmed working on a real device.**

## 0.3.0

- **New: ~50 more engine classes/nodes recognized in autocomplete and
  hover** (`ENGINE_CLASSES`, 102 → 151). Data-only change, no logic
  touched (roadmap item 2). Notable additions: `ShapeCast2D`/
  `ShapeCast3D`, `NavigationRegion2D`/`NavigationRegion3D`,
  `CollisionPolygon3D`, `CanvasLayer`, `CanvasModulate`, `Marker2D`/
  `Marker3D`, `PointLight2D`/`DirectionalLight2D`, `GPUParticles2D`/
  `GPUParticles3D`, `CPUParticles2D`/`CPUParticles3D`, `SubViewport`/
  `SubViewportContainer`, `Sprite3D`/`AnimatedSprite3D`/`Label3D`,
  `Path3D`/`PathFollow3D`, `WorldEnvironment`/`Environment`, a batch of
  UI controls that were common gaps (`SpinBox`, `MenuButton`,
  `HSeparator`/`VSeparator`, `HSplitContainer`/`VSplitContainer`,
  `HFlowContainer`/`VFlowContainer`, `AspectRatioContainer`,
  `NinePatchRect`, `TextureButton`, `TextureProgressBar`,
  `ColorPickerButton`, `ConfirmationDialog`, `TabBar`), and some
  commonly-needed utility/resource classes (`RandomNumberGenerator`,
  `JSON`, `ConfigFile`, `ProjectSettings`, `TileSet`, `AtlasTexture`,
  `Curve2D`/`Curve3D`, `StyleBoxFlat`, `ParticleProcessMaterial`). Names
  cross-checked against the official Godot 4 class reference before
  adding. Still "broad, not exhaustive" — see the README for how to keep
  extending it. Two spot-check tests added (`completions.test.mjs`,
  `hover.test.mjs`); the rest of the coverage relies on the existing
  generic tests for `classOptions`/`HOVER_INDEX`, since this didn't touch
  the code that turns `ENGINE_CLASSES` into completions/hover entries.
  `npm test`: 151/151 passing.
  **Update: confirmed working on a real device.**

## 0.2.0

- **New: autocomplete and hover now include your own `func`/`var`/
  `const`/`signal`/`class_name` declarations in the current file.**
  Until now the plugin only knew about curated built-in data
  (`classes.js`/`globals.js`/`members.js`) — writing
  `func take_damage(amount): ...` in your own script and later typing
  `take_d` anywhere else offered nothing, and hovering over
  `take_damage` showed nothing either. New module `document-symbols.js`
  scans the current document's text (line-oriented regex, not a parser)
  and extracts these five declaration kinds; `completions.js` and
  `hover.js` both consume it, with local symbols taking priority over
  curated ones on name collisions. Local symbols get `boost: 1` in the
  completion list (same as snippets), so they surface near the top
  instead of mixed in with keywords. Comments and single/triple-quoted
  strings are masked out before scanning, so a stray `func`/`var` inside
  a multi-line string (e.g. embedded dialogue text) isn't picked up as a
  real declaration. See "Known limitations" in the README for what the
  scan doesn't handle (multi-line function signatures, scope
  resolution). 25 new tests in `test/document-symbols.test.mjs`, plus
  new/updated tests in `completions.test.mjs` and `hover.test.mjs`
  (`npm test`: 149/149 passing). **Update: confirmed working on a real
  device.**
- **Test behavior change (intentional):** the hover test that used to
  assert a user's own identifier always returns `null` was rewritten —
  that was only ever true because the plugin had no way to recognize
  local declarations. It now correctly returns info for a
  locally-declared identifier, and still returns `null` for one that
  isn't declared anywhere in the document.

## 0.1.5

- **Fix: nested indentation didn't scale past the first level.** Reported
  after using the 0.1.3 indent fix on a real device: `func x():` + Enter
  indented correctly, but a second level of nesting (e.g. an `if` inside
  that function) stayed at the same depth as the line before it instead
  of going one level deeper. Cause: `indent.js` assumed a literal tab
  character (`"\t"`) represented "one level", and counted repeats of it —
  but the first level never needs to read anything back (it just returns
  `context.unit` in columns), while the second level does need to read
  the previous line's indentation, and if Acode represents one level with
  spaces instead of a literal tab (Godot's own convention: 4 spaces as an
  alternative to a tab), that counting found no tabs, returned null, and
  CodeMirror fell back to its default (copy the previous line as-is,
  without going deeper) — indentation got "stuck" at the first level.
  Redesigned (v3): no longer assumes any specific character represents
  one level. `trackLine()` now stores each line's raw indentation text;
  `gdscriptIndent()` converts it to columns using `context.unit` (the
  real configured level width) at the exact point that value is
  available, instead of guessing during tokenization. Validated with new
  tests reproducing the exact reported scenario (nesting with spaces, not
  tabs) and, against the real esbuild build, running
  `parser.token()`/`copyState()`/`indent()` exactly as CodeMirror invokes
  them across multiple nesting levels.
- **Fix: a lambda's parameter (or the next unrelated identifier) could be
  mistagged as a function definition.** Found during a tokenizer code
  audit, not reported by the user. `afterDeclKeyword` (used to tag the
  name right after `func`/`class`/`var`/`const`) never got cleared when
  the declaration keyword *wasn't* followed by a name — which only
  happens for `func` used as an anonymous lambda (`var f = func(x): ...`)
  or an anonymous `enum { A, B }`. The flag stayed "stuck" until the next
  identifier appeared anywhere — the lambda's own first parameter in the
  common case — and got tagged as `functionName` instead of a normal
  name. Fixed by mirroring the existing `afterDot` pattern: clear the
  flag as soon as what follows (after skipping any whitespace) isn't the
  start of an identifier. Named functions are unaffected (regression
  tests included).
- **Fix (bonus, same bug family as the "func" duplication fixed in
  0.1.4): `var (export)`/`var (onready)` no longer produce
  `var @export var ...`.** Their templates start with
  `@export`/`@onready`, not `"var "`, so the previous "strip the shared
  prefix" technique didn't apply here — instead, when what's typed after
  `var ` looks like it could be heading toward "export" or "onready", the
  replacement range is extended backward to also cover the `var ` already
  typed, so the correct template replaces it entirely instead of being
  inserted after it. A plain variable declaration (`var health`) is
  unaffected — the new branch only activates when the typed text is a
  plausible prefix of "export" or "onready".
- **New: hover tooltip on known symbols** (`src/language/hover.js`).
  Hovering over an engine class, global function/constant, common member,
  or built-in type now shows a small tooltip reusing the same `info`/
  `detail` text already used for autocomplete — no new content, just a
  new place to surface it. Scoped on purpose: only symbols we actually
  have curated data for (no real type inference, so a random user
  variable name won't show anything). **Important caveat:** CodeMirror's
  `hoverTooltip` listens for mouse hover events; on a touchscreen with no
  mouse/stylus connected, it may simply never trigger, depending on
  whether Acode's WebView synthesizes hover-like events for long-press.
  This will most reliably work with an external mouse connected to the
  device. Please confirm on your actual setup.

## 0.1.4

- **New project standard, no functional changes:** all source text in
  `src/` (labels, `detail`/`info` fields, error messages, log messages)
  is now in English; comments remain in Spanish. `README.md`/`CHANGELOG.md`
  are now the English versions; `README_ES.md`/`CHANGELOG_ES.md` hold the
  Spanish versions going forward. `plugin.json` and `pack-zip.js` were
  updated to point to the new filenames (they referenced the old
  `readme.md`/`changelogs.md`, which no longer exist). No version bump,
  since no source behavior changed — see the 0.1.4 entries below for the
  actual fix in this version.
- **Fix: engine callback autocomplete duplicated "func"**
  (`func _ready` with a space + select → `func func _ready() -> void:`).
  Cause: the template for those snippets (`func _ready() -> void:\n\tpass`)
  starts with `"func "`, but the range the autocomplete source computed
  for replacement only covered the last word (`matchBefore` stops at the
  space) — inserting the full template there left both the `"func "`
  already typed and the one from the template. This only happened when
  typing with the space ("func_ready" with no space already worked fine,
  because there the whole word got replaced).
  Fix: new branch in `gdscriptCompletionSource` that detects
  `func <partial name>` and in that case offers variants derived from the
  same snippets but WITHOUT the initial `"func "` (neither in the label
  nor the template) — still generated automatically from `SNIPPETS`, no
  hand-duplicated data. Typing the callback name from scratch (with or
  without `func` glued on) still offers the full template, unchanged.
  Validated with 8 new tests (including a simulation of "cut at `from`
  and paste the template", the same mechanism CodeMirror uses) and,
  against the real esbuild build, reproducing your exact case (`func
  _ready` with a space) and the case that already worked (`func_ready`
  with no space, to avoid introducing a regression).

## 0.1.3

- **Fixed a startup race condition** (which caused a reopened `.gd` file
  to sometimes stay in "text" mode): `main.js` no longer statically
  imports `language/index.js`. Now `editorLanguages.register(...)` runs
  without depending on `@codemirror/*`/`@lezer/*` at all, and only when
  Acode actually invokes the loader (i.e., once it truly needs the
  "gdscript" mode) does a dynamic `import()` of `language/index.js`
  happen, which is where those modules get resolved. Validated with a
  real esbuild build and a harness that runs the compiled bundle
  simulating Acode's runtime: CM6/Lezer resolution is demonstrably
  deferred until that point.
- **Short, retryable wait before that `import()`** (`waitForCmRuntime` in
  `main.js`): when verifying the previous point at runtime (not just by
  reading the code), it turned out that the dynamic `import()`, as
  compiled by esbuild, can only be "genuinely attempted" once per app
  session — if that single attempt happens to land at the exact instant
  Acode doesn't yet expose `@codemirror/*`/`@lezer/*`, it no longer
  recovers on its own, even if Acode publishes them an instant later.
  `waitForCmRuntime` probes `resolveCmModule(...)` (which is retryable)
  every 60ms for up to 4s BEFORE firing that single attempt, so as not to
  waste it on a transient startup failure. `resolveCmModule` now accepts
  `{ silent: true }` so that this wait doesn't flood the console with
  errors while it's normal for things not to be ready yet.
- **Reconciliation of restored tabs**: on startup, and on the
  `editorManager.on("init-open-file-list", ...)` event, already-open
  files are scanned and `file.setMode("gdscript")` is forced on any
  `.gd`/`.gdscript` file that doesn't have it — repairing tabs that Acode
  may have restored before the plugin got to register itself.
- (Confirmed, no code changes) The `#region` / `#endregion` folding you
  asked about was already implemented and covered by tests since v0.1.0
  (`computeRegionFoldEndIndex` / `tryRegionFold` in `folding.js`), with
  support for nested regions and an optional region name, just like in
  Godot.
- **Automatic indentation on Enter** (`src/language/indent.js`): raises a
  level after a line that opens a block (ends in `:`, ignoring a comment
  and a possible single-line `if x: return`); lowers a level after
  `pass`/`break`/`continue`/`return` (a heuristic, like Python modes in
  other editors); realigns `else`/`elif` with the line that opens the
  block they close, even across several nesting levels. If a line's
  indentation doesn't follow the project's tab convention (e.g. a file
  pasted with spaces), it doesn't opine and leaves the editor's default
  behavior in place, rather than risking breaking it. Along the way,
  `indentOnInput` was fixed (it had `except`, which is from Python —
  GDScript has no exceptions).
  - **First attempt (broken):** computed indentation by querying
    `context.state.doc`/`context.pos` (the position of the new line).
    Tested on a real Acode, the simplest case — `func x():` + Enter — did
    not indent at all. Diagnosis: `context.pos`, at the exact moment
    CodeMirror computes indentation for a line that Enter hasn't inserted
    yet, almost certainly doesn't point where assumed (CodeMirror
    simulates that line break in a way that couldn't be verified without
    a real Acode at hand — see "The delicate part" below).
  - **Redesign (v2):** `context.pos`/`context.state.doc` are no longer
    touched at all. The indentation level is kept incrementally in the
    `StreamParser`'s own `state` (`trackLine()`, called from `token()` in
    `tokenizer.js` at the end of every real code line), including a stack
    (`blockStack`) of still-open `:` blocks for realigning `else`/`elif`.
    `indent()` only reads that `state` — which CodeMirror guarantees
    reflects everything tokenized up to the end of the previous line —
    and uses `context.unit` only to convert the level into columns. An
    explicit `copyState()` was added (it didn't exist before) to clone
    `blockStack` correctly between lines.
  - Validated with 33 tests (including several real integration tests
    using `gdscriptStreamParser.token()`/`copyState()`/`indent()` exactly
    as CodeMirror invokes them, not just hand-simulated) and, against the
    real esbuild build, reproducing the exact reported case
    (`func _mi_funcion():` + Enter). Even so, `context.unit` remains an
    assumption about the `IndentContext` API that couldn't be verified
    without access to a real Acode — confirm it with the same file that
    failed before.

## 0.1.0

- First version: syntax highlighting, autocomplete (keywords, types,
  annotations, common classes/nodes, global functions/constants, common
  members after "."), snippets, and indentation-based folding for
  GDScript 4.x.
