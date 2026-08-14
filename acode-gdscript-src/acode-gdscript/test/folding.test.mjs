import "./mock-acode.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { computeFoldEndIndex, computeRegionFoldEndIndex, indentOf } from "../src/language/folding.js";

test("indentOf cuenta espacios y aproxima tabs a múltiplos de 8", () => {
  assert.equal(indentOf(""), 0);
  assert.equal(indentOf("    x"), 4);
  assert.equal(indentOf("\tx"), 8);
  assert.equal(indentOf("\t\tx"), 16);
});

test("no pliega una línea que no termina en ':'", () => {
  const lines = ["var x = 1", "var y = 2"];
  assert.equal(computeFoldEndIndex(lines, 0), null);
});

test("pliega un bloque simple de func", () => {
  const lines = [
    "func _ready():",
    "\tvar x = 1",
    "\tprint(x)",
    "print(\"fuera\")",
  ];
  assert.equal(computeFoldEndIndex(lines, 0), 2);
});

test("no pliega si el bloque está vacío (nada indentado debajo)", () => {
  const lines = ["func _ready():", "pass_afuera_sin_indentar"];
  assert.equal(computeFoldEndIndex(lines, 0), null);
});

test("las líneas en blanco dentro del bloque no lo cortan", () => {
  const lines = [
    "func _ready():",
    "\tvar x = 1",
    "",
    "\tprint(x)",
    "print(\"fuera\")",
  ];
  assert.equal(computeFoldEndIndex(lines, 0), 3);
});

test("bloques anidados: el fold del bloque exterior llega hasta el final del interior", () => {
  const lines = [
    "func _ready():",
    "\tif true:",
    "\t\tpass",
    "\tprint(1)",
    "print(2)",
  ];
  assert.equal(computeFoldEndIndex(lines, 0), 3);
  assert.equal(computeFoldEndIndex(lines, 1), 2);
});

// ---- #region / #endregion ----------------------------------------------

test("no pliega una línea que no es '#region'", () => {
  const lines = ["var x = 1", "#endregion"];
  assert.equal(computeRegionFoldEndIndex(lines, 0), null);
});

test("pliega una #region simple hasta su #endregion", () => {
  const lines = [
    "#region Movimiento",
    "func move():",
    "\tpass",
    "#endregion",
    "func other():",
  ];
  assert.equal(computeRegionFoldEndIndex(lines, 0), 3);
});

test("#region sin nombre también funciona", () => {
  const lines = ["#region", "var x = 1", "#endregion"];
  assert.equal(computeRegionFoldEndIndex(lines, 0), 2);
});

test("regiones anidadas: el fold externo llega hasta SU #endregion, no el interno", () => {
  const lines = [
    "#region Externa",
    "\t#region Interna",
    "\tvar x = 1",
    "\t#endregion",
    "\tvar y = 2",
    "#endregion",
    "var z = 3",
  ];
  assert.equal(computeRegionFoldEndIndex(lines, 0), 5);
  assert.equal(computeRegionFoldEndIndex(lines, 1), 3);
});

test("#region sin #endregion correspondiente no pliega", () => {
  const lines = ["#region Sin cerrar", "var x = 1"];
  assert.equal(computeRegionFoldEndIndex(lines, 0), null);
});

test("no confunde '#regionX' (sin separador) con una región real", () => {
  const lines = ["#regionX no es una region", "#endregion"];
  assert.equal(computeRegionFoldEndIndex(lines, 0), null);
});

test("no confunde '# region' (con espacio tras '#') con una región real, tal como en Godot", () => {
  const lines = ["# region con espacio no cuenta", "codigo", "#endregion"];
  assert.equal(computeRegionFoldEndIndex(lines, 0), null);
});

test("respeta indentación/espacios alrededor de las etiquetas de región", () => {
  const lines = ["\t  #region Indentada  ", "\tvar x = 1", "\t#endregion"];
  assert.equal(computeRegionFoldEndIndex(lines, 0), 2);
});
