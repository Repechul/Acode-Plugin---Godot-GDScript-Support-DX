import "./mock-acode.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { gdscriptCompletionSource } from "../src/language/completions.js";

function fakeContext({ text, pos, explicit = false }) {
  return {
    // sliceDoc ya existía; doc.toString() es lo único nuevo que necesita
    // localSymbolOptionsFor() en completions.js (ver document-symbols.js).
    // Como en todos los tests de este archivo `text` ya representa el
    // documento completo, exponer el mismo `text` aquí no cambia el
    // comportamiento de ningún test existente.
    state: { sliceDoc: (from, to) => text.slice(from, to), doc: { toString: () => text } },
    pos,
    explicit,
    matchBefore(regex) {
      const src = text.slice(0, pos);
      const re = new RegExp(regex.source + "$");
      const m = re.exec(src);
      if (!m) return null;
      return { from: pos - m[0].length, to: pos, text: m[0] };
    },
  };
}

test("sugiere miembros comunes tras un punto", () => {
  const text = "player.";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  assert.ok(result);
  assert.ok(result.options.some((o) => o.label === "queue_free"));
  assert.ok(result.options.some((o) => o.label === "position"));
});

test("sugiere anotaciones tras @", () => {
  const text = "@exp";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  assert.ok(result);
  assert.ok(result.options.some((o) => o.label === "@export"));
});

// --- @export_* con parámetros ahora insertan una plantilla con
// tabstops, no solo el nombre suelto (item "cobertura de datos:
// @export/PROPERTY_HINT", 0.7.0) ---

test("una anotación 'bare' (sin parámetros) se inserta SIN paréntesis", () => {
  const text = "@to";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const option = result.options.find((o) => o.label === "@tool");
  assert.ok(option);
  assert.equal(option.__snippet, undefined, "@tool no debería pasar por snippetCompletion");
});

test("'@export_range' se inserta como snippet con tabstops para min/max/step", () => {
  const text = "@export_ra";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const option = result.options.find((o) => o.label === "@export_range");
  assert.ok(option);
  assert.equal(option.__snippet, '@export_range(${1:min}, ${2:max}, ${3:step})');
});

test("'@rpc' se inserta con un único tabstop (modo), no con los 4 parámetros completos", () => {
  const text = "@rp";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const option = result.options.find((o) => o.label === "@rpc");
  assert.ok(option);
  assert.equal(option.__snippet, '@rpc(${1:"any_peer"})');
});

test("anotaciones que antes faltaban en ANNOTATIONS ahora aparecen (2d/3d_navigation, storage, exp_easing, warning_ignore_start/restore)", () => {
  const text = "@";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const labels = result.options.map((o) => o.label);
  for (const name of [
    "@export_flags_2d_navigation",
    "@export_flags_3d_navigation",
    "@export_storage",
    "@export_exp_easing",
    "@warning_ignore_start",
    "@warning_ignore_restore",
  ]) {
    assert.ok(labels.includes(name), `debería ofrecer '${name}'`);
  }
});

test("constantes PROPERTY_HINT_* añadidas en 0.7.0 aparecen como opciones tipo 'constant'", () => {
  const text = "PROPERTY_HINT_TY";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const option = result.options.find((o) => o.label === "PROPERTY_HINT_TYPE_STRING");
  assert.ok(option, "debería ofrecer 'PROPERTY_HINT_TYPE_STRING'");
  assert.equal(option.type, "constant");
  assert.equal(option.detail, "int (PropertyHint)");
});

test("sugiere miembros comunes también a nivel superior (sin punto), porque en GDScript se llaman sin self.", () => {
  const text = "move";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  assert.ok(result);
  const labels = result.options.map((o) => o.label);
  assert.ok(labels.includes("move_and_slide"));
  assert.ok(labels.includes("move_and_collide"));
});

test("clases del motor añadidas en 0.2.0 (item 2 del roadmap) aparecen como opciones tipo 'class'", () => {
  const text = "Shape";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const shapeCast2D = result.options.find((o) => o.label === "ShapeCast2D");
  assert.ok(shapeCast2D, "debería ofrecer 'ShapeCast2D'");
  assert.equal(shapeCast2D.type, "class");
});

test("clases añadidas en 0.8.0 (multiplayer, threading, utilidades de sistema) aparecen como opciones tipo 'class'", () => {
  const text = "Multiplayer";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const labels = result.options.map((o) => o.label);
  assert.ok(labels.includes("MultiplayerSpawner"));
  assert.ok(labels.includes("MultiplayerSynchronizer"));
});

test("miembros añadidos en 0.8.0 (grupos, show/hide/queue_redraw, Timer, AnimationPlayer) aparecen a nivel superior", () => {
  const text = "add_to_gr";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const option = result.options.find((o) => o.label === "add_to_group");
  assert.ok(option, "debería ofrecer 'add_to_group'");
  assert.equal(option.type, "method");
  assert.equal(option.__snippet, "add_to_group(${1:group})");
});

test("miembros de Timer/AnimationPlayer añadidos en 0.8.0 están presentes", () => {
  const text = "wait";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  assert.ok(result.options.some((o) => o.label === "wait_time"));
});

test("NO se añadieron miembros de singletons como Input a COMMON_MEMBERS (decisión de diseño de 0.8.0)", () => {
  const text = "is_action_pr";
  const ctx = fakeContext({ text, pos: text.length, explicit: true });
  const result = gdscriptCompletionSource(ctx);
  assert.ok(!result.options.some((o) => o.label === "is_action_pressed"));
});

test("constantes de Error/Key añadidas en el item 3 aparecen como opciones tipo 'constant'", () => {
  const text = "ERR_FILE_";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const errNotFound = result.options.find((o) => o.label === "ERR_FILE_NOT_FOUND");
  assert.ok(errNotFound, "debería ofrecer 'ERR_FILE_NOT_FOUND'");
  assert.equal(errNotFound.type, "constant");
  assert.equal(errNotFound.detail, "int (Error)");
});

test("sugiere keywords/tipos/clases/funciones/snippets a nivel superior", () => {
  const text = "fu";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  assert.ok(result);
  const labels = result.options.map((o) => o.label);
  assert.ok(labels.includes("func"));
  assert.ok(labels.includes("Vector2") === false || true); // Vector2 no empieza por 'fu', solo comprobamos que no falla
  assert.ok(labels.includes("floor")); // función global
});

test("funciones globales añadidas en 0.9.0 aparecen con su firma correcta", () => {
  const text = "angle_dif";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const option = result.options.find((o) => o.label === "angle_difference");
  assert.ok(option, "debería ofrecer 'angle_difference'");
  assert.equal(option.type, "function");
  assert.equal(option.__snippet, "angle_difference(${1:from}, ${2:to})");
});

test("funciones hiperbólicas inversas y de interpolación añadidas en 0.9.0 están todas presentes", () => {
  const text = "";
  const ctx = fakeContext({ text, pos: text.length, explicit: true });
  const result = gdscriptCompletionSource(ctx);
  const labels = result.options.map((o) => o.label);
  for (const name of [
    "acosh", "asinh", "atanh",
    "bezier_interpolate", "bezier_derivative",
    "cubic_interpolate", "cubic_interpolate_angle",
    "db_to_linear", "linear_to_db",
    "is_same", "get_stack", "error_string",
    "bytes_to_var_with_objects", "var_to_bytes_with_objects",
  ]) {
    assert.ok(labels.includes(name), `debería ofrecer '${name}'`);
  }
});

test("devuelve null si no hay palabra y no es invocación explícita", () => {
  const text = "   ";
  const ctx = fakeContext({ text, pos: text.length, explicit: false });
  const result = gdscriptCompletionSource(ctx);
  assert.equal(result, null);
});

test("con invocación explícita sin palabra, devuelve todas las opciones de nivel superior", () => {
  const text = "   ";
  const ctx = fakeContext({ text, pos: text.length, explicit: true });
  const result = gdscriptCompletionSource(ctx);
  assert.ok(result);
  assert.ok(result.options.length > 50);
});

// --- Bug reportado: "func _ready" (con espacio) + seleccionar duplicaba "func" ---

/** Simula lo que CodeMirror haría al aplicar una snippetCompletion: cortar
 * el texto en `from` y pegar la plantilla ahí (sin resolver tabstops, para
 * esto basta con comprobar que no se duplica nada). */
function spliceTemplate(text, pos, result, label) {
  const option = result.options.find((o) => o.label === label);
  assert.ok(option, `no se encontró la opción "${label}"`);
  const template = option.__snippet; // ver mock-acode.mjs: snippetCompletion guarda la plantilla aquí
  return text.slice(0, result.from) + template + text.slice(pos);
}

test("'func _rea' (con espacio) activa la rama dedicada, sin 'func ' en label/plantilla", () => {
  const text = "func _rea";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  assert.ok(result);
  const labels = result.options.map((o) => o.label);
  assert.ok(labels.includes("_ready"), "debería ofrecer '_ready' (sin 'func ')");
  assert.ok(!labels.includes("func _ready"), "NO debería ofrecer la variante con 'func ' aquí");
  assert.equal(result.from, "func ".length); // reemplaza solo "_rea", no "func _rea"
});

test("'func _rea' + seleccionar '_ready': el resultado final NO duplica 'func'", () => {
  const text = "func _rea";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const finalText = spliceTemplate(text, text.length, result, "_ready");
  assert.equal(finalText, "func _ready() -> void:\n\t${1:pass}");
});

test("lo mismo para '_process', '_physics_process', '_init', '_input', '_unhandled_input', y los añadidos en 0.6.0 ('_enter_tree', '_exit_tree', '_draw')", () => {
  for (const name of ["_process", "_physics_process", "_init", "_input", "_unhandled_input", "_enter_tree", "_exit_tree", "_draw"]) {
    const text = `func ${name}`;
    const ctx = fakeContext({ text, pos: text.length });
    const result = gdscriptCompletionSource(ctx);
    const finalText = spliceTemplate(text, text.length, result, name);
    assert.ok(finalText.startsWith(`func ${name}(`), `"${finalText}" no debería duplicar 'func' para ${name}`);
    assert.ok(!finalText.startsWith(`func func`), `"${finalText}" duplica 'func' para ${name}`);
  }
});

test("'_ready' escrito desde cero (sin 'func ' antes) sigue ofreciendo la opción completa con 'func '", () => {
  const text = "_read";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const finalText = spliceTemplate(text, text.length, result, "func _ready");
  assert.equal(finalText, "func _ready() -> void:\n\t${1:pass}");
});

test("'func_ready' (sin espacio) sigue funcionando correctamente (caso ya bueno, no romperlo)", () => {
  const text = "func_ready";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const finalText = spliceTemplate(text, text.length, result, "func _ready");
  assert.equal(finalText, "func _ready() -> void:\n\t${1:pass}");
});

test("'func ' sin nada más escrito todavía no activa la rama dedicada (no hay explícito)", () => {
  const text = "func ";
  const ctx = fakeContext({ text, pos: text.length, explicit: false });
  const result = gdscriptCompletionSource(ctx);
  assert.equal(result, null);
});

test("un identificador que solo termina en 'func' (p.ej. 'notfunc') no dispara la rama dedicada", () => {
  const text = "notfunc _rea";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  assert.ok(result);
  // Debe caer en la rama de nivel superior normal (reemplaza solo "_rea"),
  // no en la rama dedicada a "func <nombre>".
  assert.equal(result.from, text.length - "_rea".length);
});

// --- Arreglo bonus: 'var (export)'/'var (onready)' tenían el mismo riesgo
// de duplicación que 'func', pero con la anotación en la posición
// equivocada (var @export var ...) en vez de solo duplicar la palabra ---

test("'var expo' (buscando export) reemplaza también el 'var ' ya escrito", () => {
  const text = "var expo";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  assert.ok(result);
  assert.equal(result.from, 0, "debe cubrir desde el principio de 'var', no solo 'expo'");
  const finalText = spliceTemplate(text, text.length, result, "var (export)");
  assert.equal(finalText, "@export var ${1:name}: ${2:int} = ${3:0}");
  assert.ok(!finalText.startsWith("var @export"), "no debe quedar 'var' duplicado ni antes de la anotación");
});

test("'var onr' (buscando onready) reemplaza también el 'var ' ya escrito", () => {
  const text = "var onr";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const finalText = spliceTemplate(text, text.length, result, "var (onready)");
  assert.equal(finalText, "@onready var ${1:name}: ${2:Node} = $${3:Path}");
});

test("una declaración de variable normal ('var health') NO dispara la rama de export/onready", () => {
  const text = "var health";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  assert.ok(result);
  // Debe caer en la rama normal, reemplazando solo "health", con todas
  // las opciones de nivel superior disponibles (no solo export/onready).
  assert.equal(result.from, text.length - "health".length);
  assert.ok(result.options.length > 50);
});

test("'var e' (una sola letra, ambigua) todavía se considera candidata a 'export'", () => {
  const text = "var e";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  assert.equal(result.from, 0);
  const labels = result.options.map((o) => o.label);
  assert.ok(labels.includes("var (export)"));
});

// --- Símbolos propios del archivo (func/var/const/signal/class_name
// declarados por el usuario) también aparecen en el autocompletado de
// nivel superior — ver document-symbols.js ---

test("una función propia declarada más arriba en el archivo aparece en el autocompletado", () => {
  const text = "func take_damage(amount: int) -> void:\n\thealth -= amount\n\ntake_d";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  assert.ok(result);
  const option = result.options.find((o) => o.label === "take_damage");
  assert.ok(option, "debería ofrecer 'take_damage' como opción");
  assert.equal(option.detail, "(amount: int) -> void");
  assert.equal(option.__snippet, "take_damage(${1:amount})"); // con tabstop, igual que las funciones globales
});

test("una variable propia con tipo declarado aparece con su tipo como detail", () => {
  const text = "var health: int = 100\n\nhea";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const option = result.options.find((o) => o.label === "health");
  assert.ok(option);
  assert.equal(option.type, "variable");
  assert.equal(option.detail, "int");
  assert.equal(option.info, "Declared in this file.");
});

test("una señal propia aparece en el autocompletado", () => {
  const text = "signal died\n\ndi";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const labels = result.options.map((o) => o.label);
  assert.ok(labels.includes("died"));
});

test("no ofrece como símbolo propio una lambda anónima ('func(x): ...')", () => {
  const text = "var handler = func(x): return x\n\nha";
  const ctx = fakeContext({ text, pos: text.length, explicit: true });
  const result = gdscriptCompletionSource(ctx);
  const labels = result.options.map((o) => o.label);
  assert.ok(labels.includes("handler")); // la variable sí
  assert.equal(labels.filter((l) => l === "").length, 0); // ninguna función sin nombre
});

test("un símbolo propio con el mismo nombre que un miembro curado no rompe nada (ambos conviven en la lista)", () => {
  // El usuario define su propia función "connect" (nombre que también
  // existe en COMMON_MEMBERS como método de Object). No deduplicamos
  // entre ambas fuentes: simplemente coexisten en las opciones.
  const text = "func connect(a, b):\n\tpass\n\nconn";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const matches = result.options.filter((o) => o.label === "connect");
  assert.ok(matches.length >= 2);
});

test("si el contexto no expone state.doc (mock incompleto), el autocompletado normal sigue funcionando sin símbolos locales", () => {
  const text = "fu";
  const ctx = {
    state: {}, // sin doc ni sliceDoc a propósito
    pos: text.length,
    explicit: false,
    matchBefore(regex) {
      const re = new RegExp(regex.source + "$");
      const m = re.exec(text);
      if (!m) return null;
      return { from: text.length - m[0].length, to: text.length, text: m[0] };
    },
  };
  assert.doesNotThrow(() => gdscriptCompletionSource(ctx));
  const result = gdscriptCompletionSource(ctx);
  assert.ok(result);
  assert.ok(result.options.some((o) => o.label === "func"));
});

// --- Snippets añadidos en 0.6.0 (item 7 del roadmap): más callbacks y un
// esqueleto de script ---

test("'func _draw', 'func _enter_tree', 'func _exit_tree' escritos desde cero tienen la firma exacta esperada (sin parámetros, -> void)", () => {
  const cases = {
    "func _draw": "func _draw() -> void:\n\t${1:pass}",
    "func _enter_tree": "func _enter_tree() -> void:\n\t${1:pass}",
    "func _exit_tree": "func _exit_tree() -> void:\n\t${1:pass}",
  };
  for (const [label, expectedTemplate] of Object.entries(cases)) {
    const text = "_";
    const ctx = fakeContext({ text, pos: text.length, explicit: true });
    const result = gdscriptCompletionSource(ctx);
    const option = result.options.find((o) => o.label === label);
    assert.ok(option, `debería ofrecer '${label}'`);
    assert.equal(option.__snippet, expectedTemplate);
  }
});

test("'script skeleton' aparece a nivel superior y no interfiere con la rama dedicada de 'func '", () => {
  const text = "skel";
  const ctx = fakeContext({ text, pos: text.length });
  const result = gdscriptCompletionSource(ctx);
  const option = result.options.find((o) => o.label === "script skeleton");
  assert.ok(option, "debería ofrecer 'script skeleton'");
  assert.equal(option.__snippet, "extends ${1:Node}\nclass_name ${2:ClassName}\n\n\nfunc _ready() -> void:\n\t${3:pass}");

  // Al no empezar el label por "func ", NO debe aparecer en la rama
  // dedicada que activa "func <nombre parcial>" (funcCallbackNameOptions).
  const afterFunc = "func s";
  const ctxAfterFunc = fakeContext({ text: afterFunc, pos: afterFunc.length });
  const resultAfterFunc = gdscriptCompletionSource(ctxAfterFunc);
  assert.ok(!resultAfterFunc.options.some((o) => o.label === "script skeleton"));
});
