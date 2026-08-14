import "./mock-acode.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { tokenizeLine } from "./fake-stream.mjs";
import { gdscriptStreamParser, gdscriptTokenTable } from "../src/language/tokenizer.js";
import { tags } from "./mock-acode.mjs";

function tokens(line, state = gdscriptStreamParser.startState()) {
  return tokenizeLine(gdscriptStreamParser, state, line).filter(([tok]) => tok !== null);
}

test("reconoce palabras clave de control y declarativas", () => {
  const t = tokens("if x and not y: pass");
  const kinds = t.map(([k]) => k);
  assert.ok(kinds.includes("controlKeyword"));
  assert.ok(kinds.includes("operatorKeyword"));
});

test("func + nombre se tagean como definitionKeyword / functionName", () => {
  const t = tokens("func _ready():");
  const map = t.map(([k, text]) => [k, text]);
  assert.deepEqual(map[0], ["definitionKeyword", "func"]);
  assert.deepEqual(map[1], ["functionName", "_ready"]);
  assert.deepEqual(map[2], ["paren", "("]);
  assert.deepEqual(map[3], ["paren", ")"]);
  assert.deepEqual(map[4], ["punctuation", ":"]);
});

test("var declara variableDefinition, tipo conocido se tagea typeName", () => {
  const t = tokens("var health: int = 10");
  const map = t.map(([k, text]) => [k, text]);
  assert.deepEqual(map[0], ["definitionKeyword", "var"]);
  assert.deepEqual(map[1], ["variableDefinition", "health"]);
  assert.deepEqual(map[2], ["punctuation", ":"]);
  assert.deepEqual(map[3], ["typeName", "int"]);
});

test("class_name y extends con tipo conocido", () => {
  const t = tokens("class_name Player extends CharacterBody2D");
  const map = t.map(([k, text]) => [k, text]);
  assert.deepEqual(map[0], ["definitionKeyword", "class_name"]);
  assert.deepEqual(map[1], ["className", "Player"]);
  assert.deepEqual(map[2], ["definitionKeyword", "extends"]);
  assert.deepEqual(map[3], ["engineType", "CharacterBody2D"]);
});

test("comentarios de línea completa", () => {
  const t = tokens("# esto es un comentario");
  assert.deepEqual(t, [["lineComment", "# esto es un comentario"]]);
});

test("números: enteros, float, hex, bin, con guiones bajos", () => {
  assert.equal(tokens("42")[0][0], "number");
  assert.equal(tokens("3.14")[0][0], "number");
  assert.equal(tokens("0x1F")[0][0], "number");
  assert.equal(tokens("0b1010")[0][0], "number");
  assert.equal(tokens("1_000_000")[0][0], "number");
  assert.equal(tokens("1.5e10")[0][0], "number");
});

test("strings simples y con escapes", () => {
  const t = tokens('"hola \\"mundo\\""');
  assert.equal(t.length, 1);
  assert.equal(t[0][0], "string");
});

test("strings triples multilínea mantienen el estado entre llamadas", () => {
  const state = gdscriptStreamParser.startState();
  const l1 = tokens('var s = """primera linea', state);
  assert.equal(l1[l1.length - 1][0], "string");
  assert.ok(state.tokenize, "el estado debe seguir dentro de la cadena");
  const l2 = tokens("segunda linea todavia dentro", state);
  assert.equal(l2[0][0], "string");
  assert.ok(state.tokenize, "sigue sin cerrar");
  const l3 = tokens('tercera y cierre"""', state);
  assert.equal(l3[l3.length - 1][0], "string");
  assert.equal(state.tokenize, null, "debe cerrarse tras las comillas triples");
});

test("literales especiales: StringName, NodePath, referencias de nodo", () => {
  assert.equal(tokens('&"nombre"')[0][0], "specialString");
  assert.equal(tokens('^"Ruta/Al/Nodo"')[0][0], "specialString");
  assert.equal(tokens("$Sprite2D")[0][0], "nodePath");
  assert.equal(tokens("%UniqueLabel")[0][0], "nodePath");
});

test("anotaciones @export / @onready", () => {
  assert.equal(tokens("@export")[0][0], "annotation");
  assert.equal(tokens("@onready")[0][0], "annotation");
});

test("self y super", () => {
  assert.equal(tokens("self")[0][0], "selfKeyword");
  assert.equal(tokens("super")[0][0], "selfKeyword");
});

test("literales true/false/null", () => {
  assert.equal(tokens("true")[0][0], "bool");
  assert.equal(tokens("false")[0][0], "bool");
  assert.equal(tokens("null")[0][0], "null");
});

test("acceso a propiedad tras un punto", () => {
  const t = tokens("player.position");
  const map = t.map(([k, text]) => [k, text]);
  assert.deepEqual(map[0], ["variableName", "player"]);
  assert.deepEqual(map[1], ["punctuation", "."]);
  assert.deepEqual(map[2], ["propertyName", "position"]);
});

test("no se cuelga con una línea vacía ni con espacios", () => {
  assert.deepEqual(tokens(""), []);
  assert.deepEqual(tokens("    "), []);
});

test("flecha de tipo de retorno ->", () => {
  const t = tokens("func foo() -> int:");
  const map = t.map(([k, text]) => [k, text]);
  assert.deepEqual(map[4], ["operator", "->"]);
  assert.deepEqual(map[5], ["typeName", "int"]);
});

test("operadores compuestos comunes", () => {
  assert.equal(tokens("a == b")[1][0], "operator");
  assert.equal(tokens("a := b")[1][0], "operator");
  assert.equal(tokens("a **= b")[1][0], "operator");
  assert.equal(tokens("a // b")[1][0], "operator");
});

test("no lanza excepciones en un script GDScript realista completo", () => {
  const source = [
    "@tool",
    "class_name Player extends CharacterBody2D",
    "",
    "## Documentación de la clase",
    "@export var speed: float = 200.0",
    "@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D",
    "",
    "signal died(position: Vector2)",
    "",
    "func _physics_process(delta: float) -> void:",
    "\tvar input := Input.get_vector(\"left\", \"right\", \"up\", \"down\")",
    "\tvelocity = input * speed",
    "\tmove_and_slide()",
    "\tif is_on_floor() and Input.is_action_just_pressed(\"jump\"):",
    "\t\tvelocity.y = -400.0",
    "\tmatch state:",
    "\t\tState.IDLE:",
    "\t\t\tpass",
    "\t\t_:",
    "\t\t\tpass",
    "\tvar msg := \"\"\"",
    "\tmultilinea",
    "\t\"\"\"",
  ];
  const state = gdscriptStreamParser.startState();
  for (const line of source) {
    assert.doesNotThrow(() => tokens(line, state), `falló en la línea: ${line}`);
  }
});

// --- Bug encontrado en auditoría: afterDeclKeyword no se limpiaba si la
// palabra clave de declaración no iba seguida de un nombre (lambdas,
// enums anónimos) — el próximo identificador que apareciera se etiquetaba
// por error como "functionName". ---

test("BUG: el parámetro de una lambda ('func(x): ...') no se etiqueta como functionName", () => {
  const t = tokens("var f = func(x): return x * 2");
  const xToken = t.find(([, text]) => text === "x");
  assert.ok(xToken, "debería tokenizar 'x'");
  assert.notEqual(xToken[0], "functionName", `'x' se etiquetó como ${xToken[0]}, debería ser un nombre normal`);
});

test("una función CON nombre sigue etiquetando correctamente su nombre (no romper el caso normal)", () => {
  const t = tokens("func _ready():");
  const nameToken = t.find(([, text]) => text === "_ready");
  assert.equal(nameToken[0], "functionName");
});

test("BUG: una lambda sin parámetros ('func(): ...') no deja la marca pegada para la siguiente línea", () => {
  const state = gdscriptStreamParser.startState();
  tokens("var f = func(): return 1", state);
  // Tras la lambda, un identificador cualquiera en una línea NUEVA no
  // debe arrastrar la marca y etiquetarse como functionName.
  const t2 = tokens("var other_thing = 2", state);
  const otherToken = t2.find(([, text]) => text === "other_thing");
  assert.notEqual(otherToken[0], "functionName");
});

test("BUG: un enum anónimo ('enum { A, B }') no deja la marca pegada", () => {
  const state = gdscriptStreamParser.startState();
  tokens("enum { RED, GREEN }", state);
  const t2 = tokens("var color = RED", state);
  const colorToken = t2.find(([, text]) => text === "color");
  assert.notEqual(colorToken[0], "functionName");
});

test("una lambda con varios parámetros solo dispara la etiqueta en el primero, y limpia la marca", () => {
  const t = tokens("var f = func(a, b): return a + b");
  const aToken = t.find(([, text]) => text === "a");
  const bToken = t.find(([, text]) => text === "b");
  assert.notEqual(aToken[0], "functionName");
  assert.notEqual(bToken[0], "functionName");
});

// --- Cross-check de auditoría contra el tema Spectrum (plugin externo,
// main.js): varios tags que el tokenizer emitía no eran los que el tema
// esperaba (según sus propios comentarios de paleta), o dos conceptos
// distintos terminaban compartiendo el mismo tag. ---

test("BUG: 'void' se tagea como typeName (Base Type Color), no como keyword genérico", () => {
  const t = tokens("func foo() -> void:");
  const map = t.map(([k, text]) => [k, text]);
  assert.deepEqual(map[4], ["operator", "->"]);
  assert.deepEqual(map[5], ["typeName", "void"]);
});

test("BUG: 'extends' con una clase propia (no del motor) se tagea className, no cae a variableName", () => {
  const t = tokens("extends PlayerBase");
  const map = t.map(([k, text]) => [k, text]);
  assert.deepEqual(map[0], ["definitionKeyword", "extends"]);
  assert.deepEqual(map[1], ["className", "PlayerBase"]);
});

test("BUG: '##' es docComment; '#' simple (incluido #region/#endregion) sigue siendo lineComment", () => {
  assert.deepEqual(tokens("## Comentario de documentación"), [["docComment", "## Comentario de documentación"]]);
  assert.deepEqual(tokens("# Comentario normal"), [["lineComment", "# Comentario normal"]]);
  // #region/#endregion son folding puro (ver folding.js, que los detecta
  // aparte por texto crudo); en el editor de Godot tampoco cambian de
  // color, así que se mantienen a propósito como lineComment normal.
  assert.deepEqual(tokens("#region Terreno"), [["lineComment", "#region Terreno"]]);
  assert.deepEqual(tokens("#endregion"), [["lineComment", "#endregion"]]);
});

test("BUG: 'const' se distingue de 'var' (constantDefinition vs variableDefinition)", () => {
  const constTokens = tokens("const MAX_HEALTH := 100");
  assert.deepEqual(constTokens[1], ["constantDefinition", "MAX_HEALTH"]);

  const varTokens = tokens("var health := 100");
  assert.deepEqual(varTokens[1], ["variableDefinition", "health"]);
});

test("BUG: llamada a método tras un punto ('.metodo()') se distingue de acceso a propiedad ('.prop')", () => {
  const call = tokens("sprite.play()");
  assert.deepEqual(call[2], ["methodName", "play"]);

  const access = tokens("sprite.position");
  assert.deepEqual(access[2], ["propertyName", "position"]);

  // Espacio entre el nombre y el paréntesis también cuenta como llamada.
  const spaced = tokens("sprite.play ()");
  assert.deepEqual(spaced[2], ["methodName", "play"]);
});

test("mapeo de tags del tema: annotation usa attributeName (Annotation Color), no meta", () => {
  assert.strictEqual(gdscriptTokenTable.annotation, tags.attributeName);
});

test("mapeo de tags del tema: nodePath usa url (separado de StringName/specialString)", () => {
  assert.strictEqual(gdscriptTokenTable.nodePath, tags.url);
});

test("mapeo de tags del tema: functionName es function(variableName), sin el definition() extra", () => {
  assert.deepEqual(gdscriptTokenTable.functionName, { __tag: "function", of: tags.variableName });
});

// --- Segunda vuelta de cross-check contra el tema Spectrum: el usuario
// reorganizó main.js con comentarios que referencian el panel de ajustes
// real de Godot (Text Editor > Theme > Highlighting), lo que dejó ver 3
// casos más donde Godot usa colores independientes que acá compartían tag. ---

test("BUG: tipos del motor (Node2D, Control...) se distinguen de tipos base (Vector2, float...)", () => {
  assert.deepEqual(tokens("var x: Node2D")[3], ["engineType", "Node2D"]);
  assert.deepEqual(tokens("var y: Vector2")[3], ["typeName", "Vector2"]);
});

test("'Object' está en BUILTIN_TYPES y ENGINE_CLASSES a la vez; gana BUILTIN_TYPES (se chequea primero)", () => {
  assert.deepEqual(tokens("var o: Object")[3], ["typeName", "Object"]);
});

test("BUG: llamada a función global conocida (print, randi...) se distingue de una llamada sin punto genérica", () => {
  assert.deepEqual(tokens("print(x)")[0], ["globalFunctionCall", "print"]);
  assert.deepEqual(tokens("_refresh_inspector()")[0], ["methodName", "_refresh_inspector"]);
});

test("una referencia sin punto y sin paréntesis sigue siendo variableName (no se confunde con una llamada)", () => {
  assert.deepEqual(tokens("var health = max_health")[3], ["variableName", "max_health"]);
});

test("BUG: 'extends Node2D' es consistente con Node2D usado como tipo en cualquier otro lado (engineType, no typeName)", () => {
  const t = tokens("extends Node2D");
  assert.deepEqual(t[0], ["definitionKeyword", "extends"]);
  assert.deepEqual(t[1], ["engineType", "Node2D"]);
});

test("mapeo de tags del tema: engineType usa standard(typeName); globalFunctionCall usa standard(variableName)", () => {
  assert.deepEqual(gdscriptTokenTable.engineType, { __tag: "standard", of: tags.typeName });
  assert.deepEqual(gdscriptTokenTable.globalFunctionCall, { __tag: "standard", of: tags.variableName });
});
