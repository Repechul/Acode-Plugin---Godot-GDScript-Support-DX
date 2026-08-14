import "./mock-acode.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { gdscript, gdscriptLanguage } from "../src/language/index.js";
import { gdscriptTokenTable } from "../src/language/tokenizer.js";

test("gdscript() construye un LanguageSupport sin lanzar excepciones", () => {
  const support = gdscript();
  assert.ok(support);
  assert.ok(Array.isArray(support.extensions));
  assert.equal(support.language, gdscriptLanguage);
});

test("el StreamParser expone languageData con comentarios de línea '#'", () => {
  assert.equal(gdscriptLanguage.parser.languageData.commentTokens.line, "#");
});

test("el tokenTable cubre todos los nombres de token que devuelve token()", () => {
  // Nombres usados en tokenizer.js (mantener en sync manualmente si se añaden más)
  const usedNames = [
    "lineComment", "string", "specialString", "number", "controlKeyword",
    "definitionKeyword", "operatorKeyword", "keyword", "selfKeyword", "bool",
    "null", "annotation", "typeName", "className", "functionName",
    "variableDefinition", "propertyName", "variableName", "operator",
    "punctuation", "paren", "squareBracket", "brace", "nodePath", "invalid",
  ];
  for (const name of usedNames) {
    assert.ok(name in gdscriptTokenTable, `falta "${name}" en gdscriptTokenTable`);
  }
});
