import "./mock-acode.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLine, trackLine, computeIndentFromState, gdscriptIndent } from "../src/language/indent.js";
import { gdscriptStreamParser } from "../src/language/tokenizer.js";
import { tokenizeLine } from "./fake-stream.mjs";

/** Simula "escribir" un documento línea a línea (como haría tokenizer.js
 * al llegar al eol de cada línea real) y devuelve las COLUMNAS que
 * tocaría a la siguiente línea, dado lo que ya se ha escrito en ella
 * (textAfter) y el ancho de un nivel de indentación (tabSize). */
function indentAfter(linesBeforeCursor, textAfter = "", tabSize = 4) {
  const state = { blockStack: [], prevLineIndentText: "", prevLineOpensBlock: false, prevLineIsDedentStatement: false };
  for (const line of linesBeforeCursor) {
    if (line.trim().length === 0) continue; // las líneas en blanco no llaman a trackLine
    trackLine(state, line);
  }
  return computeIndentFromState(state, textAfter, tabSize);
}

test("archivo vacío: columna 0", () => {
  assert.equal(indentAfter([]), 0);
});

test("línea anterior simple: misma columna", () => {
  assert.equal(indentAfter(["func foo():", "\tvar x = 1"]), 4);
});

test("línea anterior abre bloque (termina en ':'): sube un nivel (tabSize columnas)", () => {
  assert.equal(indentAfter(["func foo():"], "", 4), 4);
  assert.equal(indentAfter(["func foo():"], "", 2), 2); // otro tabSize -> otro incremento
});

test("caso reportado originalmente: 'func _mi_funcion():' sola en el archivo sube un nivel", () => {
  assert.equal(indentAfter(["func _mi_funcion():"]), 4);
});

test("':' con código después en la misma línea (if x: return) no abre bloque", () => {
  assert.equal(indentAfter(["if x: return"]), 0);
});

test("comentario tras el ':' no impide detectar apertura de bloque", () => {
  assert.equal(indentAfter(["if x: # comentario"]), 4);
});

for (const stmt of ["pass", "break", "continue", "return", "return 5", "return foo()"]) {
  test(`tras '${stmt}': baja un nivel`, () => {
    assert.equal(indentAfter(["func foo():", `\t${stmt}`]), 0);
  });
}

test("no baja por debajo de 0", () => {
  assert.equal(indentAfter(["pass"]), 0);
});

test("'return_value = 5' no se confunde con la sentencia 'return'", () => {
  assert.equal(indentAfter(["func foo():", "\treturn_value = 5"]), 4);
});

test("'else:' realinea con el 'if' correspondiente", () => {
  assert.equal(indentAfter(["if x:", "\tdo_thing()"], "else:"), 0);
});

test("'elif ...:' realinea igual que 'else:'", () => {
  assert.equal(indentAfter(["if x:", "\tdo_thing()"], "elif y:"), 0);
});

test("'else:' anidado se alinea con el 'if' interno, no con el externo", () => {
  assert.equal(indentAfter(["if outer:", "\tif inner:", "\t\tdo_thing()"], "else:"), 4);
});

test("'else:' tras bloque vacío se alinea con la propia línea que lo abre", () => {
  assert.equal(indentAfter(["if outer:", "\tif inner:"], "else:"), 4);
});

test("'pass' + 'else:' con dos niveles de anidamiento no hace doble-dedent", () => {
  assert.equal(indentAfter(["if outer:", "\tif inner:", "\t\tpass"], "else:"), 4);
});

test("un type hint 'var x: int' no se confunde con apertura de bloque", () => {
  assert.equal(indentAfter(["var x: int"]), 0);
});

test("una entrada de diccionario '\"key\": 1' no se confunde con apertura de bloque", () => {
  assert.equal(indentAfter(['\t"key": 1']), 4);
});

test("analyzeLine: detecta indentText, apertura de bloque y sentencia de dedent por separado", () => {
  assert.deepEqual(analyzeLine("\t\tfunc foo():"), { indentText: "\t\t", opensBlock: true, isDedentStatement: false });
  assert.deepEqual(analyzeLine("\tpass"), { indentText: "\t", opensBlock: false, isDedentStatement: true });
});

// --- El bug reportado: la indentación no escalaba más allá del primer
// nivel cuando el nivel anterior está representado con ESPACIOS en vez de
// un tab literal (que es justo lo que hace Acode/Godot por convención) ---

test("BUG REPORTADO: anidamiento de dos niveles usando ESPACIOS (no tabs) para indentar", () => {
  // Como lo vería trackLine en la vida real: la línea 2 ya viene indentada
  // con 4 espacios (lo que Acode insertó al aplicar el primer nivel),
  // no con un tab.
  const lines = ["func foo():", "    if x:"]; // 4 espacios, sin tabs
  assert.equal(indentAfter(lines, "", 4), 8, "debería subir a 2 niveles (8 columnas), no quedarse en 4");
});

test("BUG REPORTADO: tres niveles con espacios siguen escalando", () => {
  const lines = ["func foo():", "    if x:", "        for i in range(3):"];
  assert.equal(indentAfter(lines, "", 4), 12);
});

test("anidamiento con TABS (por si Acode sí usa tabs en otro dispositivo/config) sigue funcionando", () => {
  const lines = ["func foo():", "\tif x:"];
  assert.equal(indentAfter(lines, "", 4), 8);
});

test("mezcla de tabs y espacios entre líneas no rompe (cada línea se mide con la misma vara)", () => {
  // No es una convención recomendada, pero no debe devolver null ni tirar:
  // sigue dando una columna coherente con lo que hay escrito de verdad.
  const lines = ["func foo():", "    if x:"]; // línea 1 sin indentar, línea 2 con 4 espacios
  const result = indentAfter(lines, "", 4);
  assert.equal(typeof result, "number");
  assert.ok(result > 4);
});

test("'else:' tras anidamiento con espacios se alinea correctamente (no solo con tabs)", () => {
  const lines = ["if outer:", "    if inner:", "        pass"]; // todo con espacios
  assert.equal(indentAfter(lines, "else:", 4), 4, "debería alinear con 'if inner:' (columna 4)");
});

// --- gdscriptIndent(): el punto de contacto real con CodeMirror ---

test("gdscriptIndent: usa context.unit como tabSize", () => {
  const state = { blockStack: [], prevLineIndentText: "", prevLineOpensBlock: false, prevLineIsDedentStatement: false };
  trackLine(state, "func foo():");
  assert.equal(gdscriptIndent(state, "", { unit: 4 }), 4);
  assert.equal(gdscriptIndent(state, "", { unit: 2 }), 2);
});

test("gdscriptIndent: dentro de una cadena multilínea (state.tokenize) no opina", () => {
  const state = { tokenize: () => {}, blockStack: [], prevLineIndentText: "\t\t", prevLineOpensBlock: true };
  assert.equal(gdscriptIndent(state, "", { unit: 4 }), null);
});

test("gdscriptIndent: sin context.unit no opina, sin lanzar", () => {
  const state = { blockStack: [], prevLineIndentText: "" };
  assert.doesNotThrow(() => gdscriptIndent(state, "", null));
  assert.equal(gdscriptIndent(state, "", null), null);
  assert.equal(gdscriptIndent(state, "", {}), null);
});

test("gdscriptIndent: nunca lanza aunque el state esté vacío/roto", () => {
  assert.doesNotThrow(() => gdscriptIndent(undefined, "", { unit: 4 }));
  assert.equal(gdscriptIndent(undefined, "", { unit: 4 }), null);
});

// --- Integración real con gdscriptStreamParser (no solo trackLine a mano) ---

test("integración real: gdscriptStreamParser completo, caso reportado 'func _mi_funcion():'", () => {
  let state = gdscriptStreamParser.startState();
  tokenizeLine(gdscriptStreamParser, state, "func _mi_funcion():");
  state = gdscriptStreamParser.copyState(state);

  const result = gdscriptStreamParser.indent(state, "", { unit: 4 });
  assert.equal(result, 4, "una sola línea que abre bloque debe subir un nivel (4 columnas)");
});

test("integración real: BUG REPORTADO, dos niveles anidados con ESPACIOS de verdad, usando token()/copyState()", () => {
  let state = gdscriptStreamParser.startState();

  // Línea 1: "func foo():" (sin indentar)
  tokenizeLine(gdscriptStreamParser, state, "func foo():");
  state = gdscriptStreamParser.copyState(state);
  assert.equal(gdscriptStreamParser.indent(state, "", { unit: 4 }), 4);

  // Línea 2: EXACTAMENTE lo que Acode habría insertado para el primer
  // nivel (4 espacios), no un tab -- así se reproduce el bug de verdad.
  tokenizeLine(gdscriptStreamParser, state, "    if x:");
  state = gdscriptStreamParser.copyState(state);
  assert.equal(gdscriptStreamParser.indent(state, "", { unit: 4 }), 8, "debía subir a 8, antes se quedaba en 4");

  // Línea 3: tercer nivel, para confirmar que sigue escalando
  tokenizeLine(gdscriptStreamParser, state, "        pass");
  state = gdscriptStreamParser.copyState(state);
  assert.equal(gdscriptStreamParser.indent(state, "", { unit: 4 }), 4, "tras 'pass' (nivel 2) baja a nivel 1 -> 4 columnas");
});

test("integración real: varias líneas con copyState entre cada una, como haría CodeMirror", () => {
  let state = gdscriptStreamParser.startState();

  for (const line of ["func foo():", "\tif x > 0:", "\t\tpass"]) {
    tokenizeLine(gdscriptStreamParser, state, line);
    state = gdscriptStreamParser.copyState(state);
  }

  assert.equal(gdscriptStreamParser.indent(state, "", { unit: 4 }), 4, "tras 'pass' (nivel 2) baja a nivel 1 -> 4 columnas");
  assert.equal(gdscriptStreamParser.indent(state, "else:", { unit: 4 }), 4, "'else:' se alinea con 'if x > 0:' (nivel 1) -> 4 columnas");
});

test("integración real: dentro de una cadena multilínea, indent() no opina", () => {
  let state = gdscriptStreamParser.startState();
  tokenizeLine(gdscriptStreamParser, state, 'var s = """');
  state = gdscriptStreamParser.copyState(state);

  assert.ok(state.tokenize, "debería seguir dentro de la cadena multilínea");
  assert.equal(gdscriptStreamParser.indent(state, "", { unit: 4 }), null);
});
