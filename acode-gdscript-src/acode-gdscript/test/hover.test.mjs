import test from "node:test";
import assert from "node:assert/strict";
import { wordAt, hoverInfoFor, gdscriptHoverTooltip } from "../src/language/hover.js";

// --- wordAt() ---

test("wordAt: cursor en medio de una palabra", () => {
  assert.deepEqual(wordAt("var health = 10", 5), { start: 4, end: 10, text: "health" });
});

test("wordAt: cursor al principio de una palabra", () => {
  const w = wordAt("Node2D.new()", 0);
  assert.equal(w.text, "Node2D");
});

test("wordAt: cursor justo tras el final de una palabra (fin de línea)", () => {
  const w = wordAt("randf", 5);
  assert.equal(w.text, "randf");
});

test("wordAt: cursor sobre un espacio, no dentro de ninguna palabra vecina", () => {
  assert.equal(wordAt("var  health", 4), null);
});

test("wordAt: cursor claramente aislado entre palabras (varios espacios) -> null", () => {
  assert.equal(wordAt("a   b", 2), null); // el espacio del medio, sin palabra pegada a ningún lado
});

test("wordAt: cursor justo tras una palabra, antes de puntuación, sigue devolviendo esa palabra", () => {
  // Comportamiento a propósito (igual que 'cursor justo tras el final de
  // una palabra' arriba): más tolerante que exigir precisión de píxel,
  // razonable sobre todo para hover con el dedo.
  assert.equal(wordAt("foo.bar()", 3).text, "foo");
  assert.equal(wordAt("foo.bar()", 7).text, "bar");
});

test("wordAt: línea vacía", () => {
  assert.equal(wordAt("", 0), null);
});

test("wordAt: posición fuera de rango no lanza, devuelve null", () => {
  assert.equal(wordAt("abc", -1), null);
  assert.equal(wordAt("abc", 99), null);
});

test("wordAt: entradas no válidas no lanzan", () => {
  assert.equal(wordAt(null, 0), null);
  assert.equal(wordAt("abc", null), null);
});

test("wordAt: identificador con guion bajo", () => {
  const w = wordAt("_ready()", 2);
  assert.equal(w.text, "_ready");
});

// --- hoverInfoFor() ---

test("hoverInfoFor: clase del motor conocida", () => {
  const entry = hoverInfoFor("Node2D");
  assert.ok(entry);
  assert.equal(entry.title, "Node2D");
  assert.equal(entry.detail, "class");
  assert.ok(entry.info.length > 0);
});

test("hoverInfoFor: clase añadida en 0.2.0 (item 2 del roadmap) también está indexada", () => {
  const entry = hoverInfoFor("WorldEnvironment");
  assert.ok(entry);
  assert.equal(entry.detail, "class");
  assert.ok(entry.info.length > 0);
});

test("hoverInfoFor: clase añadida en 0.8.0 (multiplayer) está indexada", () => {
  const entry = hoverInfoFor("MultiplayerSynchronizer");
  assert.ok(entry);
  assert.equal(entry.detail, "class");
});

test("hoverInfoFor: miembro añadido en 0.8.0 (Timer/grupos) está indexado", () => {
  assert.ok(hoverInfoFor("add_to_group"));
  assert.ok(hoverInfoFor("wait_time"));
  assert.ok(hoverInfoFor("queue_redraw"));
});

test("hoverInfoFor: función global conocida", () => {
  const entry = hoverInfoFor("randf");
  assert.ok(entry);
  assert.equal(entry.detail, "float"); // el detail de una función es su tipo de retorno
});

test("hoverInfoFor: funciones globales añadidas en 0.9.0 están indexadas", () => {
  assert.ok(hoverInfoFor("angle_difference"));
  assert.ok(hoverInfoFor("is_same"));
  assert.ok(hoverInfoFor("error_string"));
  const bezier = hoverInfoFor("bezier_interpolate");
  assert.ok(bezier);
  assert.equal(bezier.detail, "float");
});

test("hoverInfoFor: constante global conocida", () => {
  const entry = hoverInfoFor("PI");
  assert.ok(entry);
  assert.equal(entry.detail, "float");
});

test("hoverInfoFor: constantes añadidas en el item 3 (Error/Key/MouseButton/JoyButton) están indexadas", () => {
  assert.ok(hoverInfoFor("OK"));
  assert.ok(hoverInfoFor("ERR_FILE_NOT_FOUND"));
  assert.ok(hoverInfoFor("KEY_SPACE"));
  assert.ok(hoverInfoFor("MOUSE_BUTTON_LEFT"));
  assert.ok(hoverInfoFor("JOY_BUTTON_A"));
});

test("hoverInfoFor: constantes PROPERTY_HINT_* añadidas en 0.7.0 están indexadas", () => {
  const entry = hoverInfoFor("PROPERTY_HINT_TYPE_STRING");
  assert.ok(entry);
  assert.equal(entry.detail, "int (PropertyHint)");
});

// --- Anotaciones (0.7.0): antes NO estaban indexadas en absoluto para
// hover — hoverInfoFor("export_range") devolvía null siempre. La clave
// del índice va SIN el "@" (ver hover.js: wordAt() no trata "@" como
// carácter de palabra), pero el título mostrado sí lo conserva. ---

test("hoverInfoFor: una anotación se busca SIN el '@' pero el título mostrado SÍ lo incluye", () => {
  const entry = hoverInfoFor("export_range");
  assert.ok(entry, "debería encontrar la entrada para 'export_range' (sin @)");
  assert.equal(entry.title, "@export_range");
  assert.equal(entry.detail, "annotation");
  assert.ok(entry.info.length > 0);
});

test("hoverInfoFor: buscar CON el '@' incluido no encuentra nada (coherente con cómo wordAt() extrae la palabra)", () => {
  assert.equal(hoverInfoFor("@export_range"), null);
});

test("hoverInfoFor: una anotación bare (sin parámetros) también está indexada para hover", () => {
  const entry = hoverInfoFor("tool");
  assert.ok(entry);
  assert.equal(entry.title, "@tool");
});

test("gdscriptHoverTooltip: pasar el cursor sobre el nombre de una anotación real en código muestra su info", () => {
  const line = '@export_range(0, 100) var health: int = 100';
  const view = fakeView(line, 0, line);
  // "export_range" empieza en la columna 1 (justo tras "@"); apuntamos
  // al medio de la palabra.
  const tooltip = gdscriptHoverTooltip(view, 5);
  assert.ok(tooltip);
  assert.equal(tooltip.pos, 1);
  assert.equal(tooltip.end, 1 + "export_range".length);
});

test("hoverInfoFor: miembro común conocido (método)", () => {
  const entry = hoverInfoFor("move_and_slide");
  assert.ok(entry);
  assert.equal(entry.detail, "method");
});

test("hoverInfoFor: miembro común conocido (propiedad)", () => {
  const entry = hoverInfoFor("velocity");
  assert.ok(entry);
  assert.equal(entry.detail, "property");
});

test("hoverInfoFor: tipo básico conocido, sin info (solo detail)", () => {
  const entry = hoverInfoFor("int");
  assert.ok(entry);
  assert.equal(entry.detail, "type");
  assert.equal(entry.info, null);
});

test("hoverInfoFor: identificador propio del usuario (desconocido) -> null", () => {
  assert.equal(hoverInfoFor("player_health"), null);
});

test("hoverInfoFor: entradas vacías no lanzan", () => {
  assert.equal(hoverInfoFor(""), null);
  assert.equal(hoverInfoFor(null), null);
  assert.equal(hoverInfoFor(undefined), null);
});

// --- gdscriptHoverTooltip(): el punto de contacto real con CodeMirror ---
// (No se invoca tooltip.create() aquí: usa document.createElement, que
// solo existe en un navegador real, no en este entorno de test con Node.
// Se comprueban los metadatos -pos/end/que create sea una función-, que
// es la parte con lógica real.)

function fakeView(lineText, lineFrom = 0, fullText = lineText) {
  return {
    state: {
      doc: {
        lineAt(_pos) {
          return { text: lineText, from: lineFrom };
        },
        // Necesario para buildLocalHoverIndex() (ver document-symbols.js).
        // Por defecto es la misma lineText de siempre, así que los tests
        // ya existentes que no pasan fullText no cambian de comportamiento.
        toString() {
          return fullText;
        },
      },
    },
  };
}

test("gdscriptHoverTooltip: símbolo conocido devuelve tooltip con el rango correcto", () => {
  const view = fakeView("var x: Node2D = Node2D.new()");
  const tooltip = gdscriptHoverTooltip(view, 7); // sobre "Node2D" (primera aparición)
  assert.ok(tooltip);
  assert.equal(tooltip.pos, 7);
  assert.equal(tooltip.end, 13);
  assert.equal(typeof tooltip.create, "function");
});

test("gdscriptHoverTooltip: respeta line.from para documentos multilínea", () => {
  const view = fakeView("\tvar x = randf()", 100); // línea que empieza en la posición 100 del documento
  const tooltip = gdscriptHoverTooltip(view, 100 + 9); // sobre "randf" (empieza en la columna 9 de la línea)
  assert.ok(tooltip);
  assert.equal(tooltip.pos, 100 + 9);
  assert.equal(tooltip.end, 100 + 14);
});

test("gdscriptHoverTooltip: identificador que no está declarado en ningún sitio del documento -> null (no inventa info)", () => {
  // Importante: aquí fullText (3er argumento) es el documento COMPLETO
  // que ve buildLocalHoverIndex(), no solo la línea bajo el cursor — así
  // que "player_health" no aparece declarado en ninguna parte.
  const view = fakeView("print(player_health)", 0, "print(player_health)");
  assert.equal(gdscriptHoverTooltip(view, 8), null); // sobre "player_health", usado pero nunca declarado
});

test("gdscriptHoverTooltip: identificador declarado en el archivo (var) -> sí muestra tooltip, con prioridad sobre lo curado", () => {
  const fullText = "var player_health: int = 100\n\nfunc take_damage(amount):\n\tplayer_health -= amount";
  const line = "\tplayer_health -= amount";
  const view = fakeView(line, 200, fullText); // esta línea "vive" en la posición 200 del documento
  const tooltip = gdscriptHoverTooltip(view, 200 + 1); // sobre "player_health" (tras el tab)
  assert.ok(tooltip);
  assert.equal(tooltip.pos, 200 + 1);
  assert.equal(tooltip.end, 200 + 1 + "player_health".length);
});

test("gdscriptHoverTooltip: una función propia declarada en el archivo muestra su firma", () => {
  const fullText = "func take_damage(amount: int) -> void:\n\thealth -= amount";
  const view = fakeView(fullText, 0, fullText);
  const tooltip = gdscriptHoverTooltip(view, 5); // sobre "take_damage"
  assert.ok(tooltip);
  // No se invoca tooltip.create() (usa document.createElement, ver nota
  // arriba); comprobamos que el rango cubre el nombre completo.
  assert.equal(tooltip.end - tooltip.pos, "take_damage".length);
});

test("gdscriptHoverTooltip: si state.doc no tiene toString() utilizable, sigue mostrando lo curado sin lanzar", () => {
  const view = {
    state: {
      doc: {
        lineAt: () => ({ text: "var x: Node2D = Node2D.new()", from: 0 }),
        toString: () => {
          throw new Error("boom");
        },
      },
    },
  };
  assert.doesNotThrow(() => gdscriptHoverTooltip(view, 7));
  const tooltip = gdscriptHoverTooltip(view, 7); // "Node2D" sigue viniendo del índice curado
  assert.ok(tooltip);
});

test("gdscriptHoverTooltip: posición sobre espacio/puntuación -> null", () => {
  const view = fakeView("var x = 1");
  assert.equal(gdscriptHoverTooltip(view, 3), null);
});

test("gdscriptHoverTooltip: view roto o incompleto no lanza, devuelve null", () => {
  assert.doesNotThrow(() => gdscriptHoverTooltip(null, 0));
  assert.equal(gdscriptHoverTooltip(null, 0), null);
  assert.equal(gdscriptHoverTooltip({}, 0), null);
  assert.equal(gdscriptHoverTooltip({ state: {} }, 0), null);
});

test("gdscriptHoverTooltip: nunca lanza aunque doc.lineAt() falle", () => {
  const view = { state: { doc: { lineAt: () => { throw new Error("boom"); } } } };
  assert.doesNotThrow(() => gdscriptHoverTooltip(view, 0));
  assert.equal(gdscriptHoverTooltip(view, 0), null);
});
