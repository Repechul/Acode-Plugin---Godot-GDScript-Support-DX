import test from "node:test";
import assert from "node:assert/strict";
import { scanDocumentSymbols, maskStringsAndComments } from "../src/language/document-symbols.js";

// --- maskStringsAndComments() ---

test("maskStringsAndComments: enmascara un comentario de línea", () => {
  const out = maskStringsAndComments("var x = 1 # comentario");
  assert.equal(out.includes("comentario"), false);
  assert.equal(out.startsWith("var x = 1 "), true);
});

test("maskStringsAndComments: enmascara una string simple sin tragarse el resto de la línea", () => {
  const out = maskStringsAndComments('var s = "func fake():" + other');
  assert.equal(out.includes("fake"), false);
  assert.equal(out.includes("other"), true);
});

test("maskStringsAndComments: preserva los saltos de línea dentro de una string triple", () => {
  const text = 'var s = """\nlinea 2\nlinea 3\n"""\nvar y = 1';
  const out = maskStringsAndComments(text);
  assert.equal(out.split("\n").length, text.split("\n").length);
  assert.equal(out.includes("linea 2"), false);
  assert.equal(out.includes("var y = 1"), true);
});

test("maskStringsAndComments: string simple sin cerrar no se come el resto del documento", () => {
  const text = 'var s = "sin cerrar\nvar y = 1';
  const out = maskStringsAndComments(text);
  // Tras la línea con la comilla sin cerrar, el resto del documento sigue intacto.
  assert.equal(out.split("\n")[1], "var y = 1");
});

// --- scanDocumentSymbols(): funciones ---

test("detecta una función con parámetros tipados y retorno", () => {
  const text = "func take_damage(amount: int) -> void:\n\thealth -= amount";
  const [sym] = scanDocumentSymbols(text);
  assert.equal(sym.name, "take_damage");
  assert.equal(sym.kind, "function");
  assert.equal(sym.detail, "(amount: int) -> void");
  assert.deepEqual(sym.paramNames, ["amount"]);
});

test("detecta 'static func'", () => {
  const text = "static func from_dict(data: Dictionary) -> Player:\n\tpass";
  const [sym] = scanDocumentSymbols(text);
  assert.equal(sym.name, "from_dict");
  assert.equal(sym.kind, "function");
});

test("función sin parámetros ni tipo de retorno explícito", () => {
  const text = "func _ready():\n\tpass";
  const [sym] = scanDocumentSymbols(text);
  assert.equal(sym.name, "_ready");
  assert.equal(sym.detail, "()");
  assert.deepEqual(sym.paramNames, []);
});

test("NO detecta una lambda anónima ('func(x): ...') como función con nombre", () => {
  const text = "var handler = func(x): return x * 2";
  const symbols = scanDocumentSymbols(text);
  assert.equal(symbols.some((s) => s.kind === "function"), false);
  // Pero sí detecta la variable "handler".
  assert.ok(symbols.some((s) => s.name === "handler" && s.kind === "variable"));
});

test("función con paréntesis anidados en el valor por defecto: se queda con el nombre aunque no con el detalle exacto", () => {
  const text = "func spawn(pos = get_default_position()) -> void:\n\tpass";
  const [sym] = scanDocumentSymbols(text);
  assert.equal(sym.name, "spawn");
  assert.equal(sym.kind, "function");
});

// --- scanDocumentSymbols(): variables y constantes ---

test("variable con tipo explícito", () => {
  const text = "var health: int = 100";
  const [sym] = scanDocumentSymbols(text);
  assert.equal(sym.name, "health");
  assert.equal(sym.kind, "variable");
  assert.equal(sym.detail, "int");
});

test("variable con tipo inferido (:=) no reporta un 'detail' inventado", () => {
  const text = "var speed := 200.0";
  const [sym] = scanDocumentSymbols(text);
  assert.equal(sym.name, "speed");
  assert.equal(sym.detail, null);
});

test("variable sin tipo ni inicializador", () => {
  const text = "var target";
  const [sym] = scanDocumentSymbols(text);
  assert.equal(sym.name, "target");
  assert.equal(sym.detail, null);
});

test("@export/@onready en la misma línea que 'var' no rompe la detección del nombre", () => {
  const text1 = "@export var max_speed: float = 300.0";
  const [sym1] = scanDocumentSymbols(text1);
  assert.equal(sym1.name, "max_speed");
  assert.equal(sym1.detail, "float");

  const text2 = '@onready var sprite := $Sprite2D';
  const [sym2] = scanDocumentSymbols(text2);
  assert.equal(sym2.name, "sprite");
});

test("@export_range con argumentos entre paréntesis no confunde el escaneo", () => {
  const text = "@export_range(0, 100) var volume: int = 50";
  const [sym] = scanDocumentSymbols(text);
  assert.equal(sym.name, "volume");
  assert.equal(sym.detail, "int");
});

test("detecta 'const'", () => {
  const text = "const MAX_HEALTH: int = 100";
  const [sym] = scanDocumentSymbols(text);
  assert.equal(sym.name, "MAX_HEALTH");
  assert.equal(sym.kind, "constant");
  assert.equal(sym.detail, "int");
});

// --- scanDocumentSymbols(): señales y class_name ---

test("detecta 'signal' con parámetros", () => {
  const text = "signal health_changed(new_health: int, old_health: int)";
  const [sym] = scanDocumentSymbols(text);
  assert.equal(sym.name, "health_changed");
  assert.equal(sym.kind, "signal");
  assert.equal(sym.detail, "(new_health: int, old_health: int)");
});

test("detecta 'signal' sin parámetros", () => {
  const text = "signal died";
  const [sym] = scanDocumentSymbols(text);
  assert.equal(sym.name, "died");
  assert.equal(sym.detail, "()");
});

test("detecta 'class_name'", () => {
  const text = "class_name Player\nextends CharacterBody2D";
  const [sym] = scanDocumentSymbols(text);
  assert.equal(sym.name, "Player");
  assert.equal(sym.kind, "class");
});

// --- Falsos positivos que NO deben aparecer ---

test("no confunde un comentario con una declaración real", () => {
  const text = "# var x_de_mentira = 1\nprint(1)";
  const symbols = scanDocumentSymbols(text);
  assert.equal(symbols.length, 0);
});

test("no confunde el contenido de un string triple multilínea con código real", () => {
  const text = [
    'var dialogue = """',
    "func fake_thing():",
    "\tvar not_real = 1",
    '"""',
    "var real_var = 2",
  ].join("\n");
  const symbols = scanDocumentSymbols(text);
  const names = symbols.map((s) => s.name);
  assert.ok(names.includes("dialogue"));
  assert.ok(names.includes("real_var"));
  assert.equal(names.includes("fake_thing"), false);
  assert.equal(names.includes("not_real"), false);
});

// --- Deduplicación y robustez de entrada ---

test("deduplica declaraciones repetidas del mismo nombre, se queda con la primera", () => {
  const text = "var x = 1\nvar x = 2";
  const symbols = scanDocumentSymbols(text);
  assert.equal(symbols.filter((s) => s.name === "x").length, 1);
});

test("un nombre puede repetirse entre categorías distintas sin perderse (func y signal con el mismo nombre)", () => {
  const text = "signal died\nfunc died():\n\tpass";
  const symbols = scanDocumentSymbols(text);
  assert.equal(symbols.filter((s) => s.name === "died").length, 2);
});

test("entradas no válidas no lanzan: devuelve lista vacía", () => {
  assert.deepEqual(scanDocumentSymbols(""), []);
  assert.deepEqual(scanDocumentSymbols(null), []);
  assert.deepEqual(scanDocumentSymbols(undefined), []);
  assert.deepEqual(scanDocumentSymbols(12345), []);
});

test("documento sin ninguna declaración devuelve lista vacía", () => {
  const text = "print('hola')\nif true:\n\tpass";
  assert.deepEqual(scanDocumentSymbols(text), []);
});

test("todos los símbolos locales llevan el mismo texto de info estándar", () => {
  const text = "var a = 1\nfunc b():\n\tpass\nconst C = 1\nsignal d\nclass_name E";
  const symbols = scanDocumentSymbols(text);
  assert.equal(symbols.length, 5);
  assert.ok(symbols.every((s) => s.info === "Declared in this file."));
});
