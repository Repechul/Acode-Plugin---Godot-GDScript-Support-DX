import "./mock-acode.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  findActiveCall,
  resolveSignature,
  computeSignatureTooltips,
  gdscriptSignatureHelp,
} from "../src/language/signature-help.js";

// --- findActiveCall() ---

test("detecta una llamada simple justo tras el paréntesis abierto", () => {
  const text = "take_damage(";
  const call = findActiveCall(text, text.length);
  assert.ok(call);
  assert.equal(call.name, "take_damage");
  assert.equal(call.argIndex, 0);
  assert.equal(call.openParenPos, text.indexOf("("));
});

test("cuenta el argIndex correctamente tras una coma", () => {
  const text = "foo(a, ";
  const call = findActiveCall(text, text.length);
  assert.ok(call);
  assert.equal(call.name, "foo");
  assert.equal(call.argIndex, 1);
});

test("un argumento que es a su vez una llamada ya cerrada no rompe el conteo del nivel superior", () => {
  const text = "foo(bar(1, 2), ";
  const call = findActiveCall(text, text.length);
  assert.ok(call);
  assert.equal(call.name, "foo");
  assert.equal(call.argIndex, 1);
});

test("cursor dentro de una llamada anidada todavía abierta reporta la llamada MÁS interna", () => {
  const text = "foo(bar(1, ";
  const call = findActiveCall(text, text.length);
  assert.ok(call);
  assert.equal(call.name, "bar");
  assert.equal(call.argIndex, 1);
});

test("una llamada multilínea cuenta comas a través de los saltos de línea", () => {
  const text = "foo(\n  a,\n  ";
  const call = findActiveCall(text, text.length);
  assert.ok(call);
  assert.equal(call.name, "foo");
  assert.equal(call.argIndex, 1);
});

test("no confunde 'if (...)' con una llamada (if es palabra clave)", () => {
  const text = "if (x > 0";
  const call = findActiveCall(text, text.length);
  assert.equal(call, null);
});

test("sin ninguna llamada envolvente, devuelve null", () => {
  const text = "var x = 5";
  const call = findActiveCall(text, text.length);
  assert.equal(call, null);
});

test("cursor dentro de un array/dict literal como argumento: alcance limitado, devuelve null", () => {
  const text = "foo([1, 2, ";
  const call = findActiveCall(text, text.length);
  assert.equal(call, null);
});

test("un paréntesis dentro de una string no se confunde con el de una llamada real", () => {
  const text = 'var s = "foo(1, 2"';
  // Posición dentro de la string (tras "foo(1, 2"), no debería encontrar
  // ninguna llamada real ya que el contenido de la string se enmascara.
  const call = findActiveCall(text, text.length - 1);
  assert.equal(call, null);
});

test("posiciones fuera de rango no lanzan, devuelven null", () => {
  assert.equal(findActiveCall("foo(", -1), null);
  assert.equal(findActiveCall("foo(", 999), null);
  assert.equal(findActiveCall(null, 0), null);
  assert.equal(findActiveCall("foo(", "x"), null);
});

// --- resolveSignature() ---

test("resuelve la firma de una función propia del archivo (sin tipo de retorno)", () => {
  const text = "func take_damage(amount):\n\thealth -= amount";
  const sig = resolveSignature("take_damage", text);
  assert.ok(sig);
  assert.deepEqual(sig.params, ["amount"]);
  assert.equal(sig.returnType, null);
});

test("resuelve la firma de una función propia con tipo de retorno explícito", () => {
  const text = "func heal(amount: int) -> void:\n\thealth += amount";
  const sig = resolveSignature("heal", text);
  assert.ok(sig);
  assert.deepEqual(sig.params, ["amount"]);
  assert.equal(sig.returnType, "void");
});

test("resuelve la firma de un miembro común curado (get_node)", () => {
  const sig = resolveSignature("get_node", "");
  assert.ok(sig);
  assert.deepEqual(sig.params, ["path"]);
});

test("resuelve la firma de una función global curada (clamp)", () => {
  const sig = resolveSignature("clamp", "");
  assert.ok(sig);
  assert.deepEqual(sig.params, ["value", "min", "max"]);
  assert.equal(sig.returnType, "Variant");
});

test("una función propia con el mismo nombre que un miembro curado tiene prioridad", () => {
  const text = "func get_node(a, b, c):\n\tpass";
  const sig = resolveSignature("get_node", text);
  assert.deepEqual(sig.params, ["a", "b", "c"]);
});

test("nombre desconocido en ninguna fuente devuelve null", () => {
  assert.equal(resolveSignature("esto_no_existe", ""), null);
  assert.equal(resolveSignature("", ""), null);
  assert.equal(resolveSignature(null, ""), null);
});

// --- computeSignatureTooltips() ---

function fakeState(text, headPositions) {
  return {
    selection: { ranges: headPositions.map((head) => ({ head, empty: true })) },
    doc: { toString: () => text },
  };
}

test("computeSignatureTooltips: llamada activa con parámetros produce un tooltip", () => {
  const text = "clamp(5, ";
  const state = fakeState(text, [text.length]);
  const tooltips = computeSignatureTooltips(state);
  assert.equal(tooltips.length, 1);
  assert.equal(tooltips[0].pos, text.indexOf("(") + 1);
  assert.equal(typeof tooltips[0].create, "function");
});

test("computeSignatureTooltips: sin llamada activa, no produce tooltips", () => {
  const text = "var x = 5";
  const state = fakeState(text, [text.length]);
  assert.deepEqual(computeSignatureTooltips(state), []);
});

test("computeSignatureTooltips: función sin parámetros no produce tooltip (no aporta nada)", () => {
  const text = "queue_free(";
  const state = fakeState(text, [text.length]);
  assert.deepEqual(computeSignatureTooltips(state), []);
});

test("computeSignatureTooltips: rangos con selección activa (no solo cursor) se ignoran", () => {
  const text = "clamp(5, ";
  const state = {
    selection: { ranges: [{ head: text.length, empty: false }] },
    doc: { toString: () => text },
  };
  assert.deepEqual(computeSignatureTooltips(state), []);
});

test("computeSignatureTooltips: con varios cursores, puede producir varios tooltips", () => {
  const text = "clamp(1, 2, 3)  clamp(4, ";
  const state = fakeState(text, [7, text.length]);
  const tooltips = computeSignatureTooltips(state);
  assert.equal(tooltips.length, 2);
});

test("computeSignatureTooltips: un 'state' con forma inesperada no lanza, devuelve []", () => {
  assert.deepEqual(computeSignatureTooltips(null), []);
  assert.deepEqual(computeSignatureTooltips({}), []);
  assert.deepEqual(computeSignatureTooltips({ selection: {} }), []);
});

// --- wiring con CodeMirror (a través del mock) ---

test("gdscriptSignatureHelp: create/update están conectados a computeSignatureTooltips", () => {
  const text = "clamp(5, ";
  const state = fakeState(text, [text.length]);
  const created = gdscriptSignatureHelp.spec.create(state);
  assert.equal(created.length, 1);

  // update(): sin cambios de doc/selección, reutiliza el valor anterior
  const sameTr = { docChanged: false, selection: false, state };
  assert.equal(gdscriptSignatureHelp.spec.update(created, sameTr), created);

  // update(): con cambio de documento, recalcula
  const newText = "var x = 5";
  const newState = fakeState(newText, [newText.length]);
  const changedTr = { docChanged: true, selection: false, state: newState };
  const updated = gdscriptSignatureHelp.spec.update(created, changedTr);
  assert.deepEqual(updated, []);
});

test("gdscriptSignatureHelp: provide() conecta con showTooltip.computeN() sin lanzar", () => {
  const fakeField = { __fake: "field" };
  assert.doesNotThrow(() => gdscriptSignatureHelp.spec.provide(fakeField));
});
