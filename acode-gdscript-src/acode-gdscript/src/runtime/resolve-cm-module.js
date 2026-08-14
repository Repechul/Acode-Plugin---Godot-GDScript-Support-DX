/**
 * resolve-cm-module.js
 * ---------------------------------------------------------------------
 * Intenta obtener, desde el propio runtime de Acode, la MISMA instancia
 * de un módulo de CodeMirror/Lezer que Acode ya tiene cargada — en vez
 * de que este plugin traiga su propia copia (lo cual rompe las
 * comprobaciones de identidad de Facets/StateFields de CM6).
 *
 * Acode expone `acode.require(moduleName)` como registro general de
 * módulos (nombre insensible a mayúsculas): "commands", "editorLanguages",
 * "editorThemes", "terminal", etc. Es razonable (y es lo que hace el
 * plugin oficial acode-additional-langmodes) que también registre ahí
 * sus propias copias de los paquetes @codemirror/* y @lezer/*.
 *
 * Esto es un "mejor esfuerzo": si tu versión de Acode usa otra
 * convención, verás un error claro en consola con la lista de nombres
 * probados. Añade el nombre correcto a CANDIDATE_ALIASES y reconstruye.
 * Consulta las instrucciones de depuración en README_EXT.md.
 */

const CANDIDATE_ALIASES = {
  "@codemirror/state": ["@codemirror/state", "codemirror/state", "cmState"],
  "@codemirror/view": ["@codemirror/view", "codemirror/view", "cmView"],
  "@codemirror/language": ["@codemirror/language", "codemirror/language", "cmLanguage", "editorLanguage"],
  "@codemirror/autocomplete": ["@codemirror/autocomplete", "codemirror/autocomplete", "cmAutocomplete"],
  "@lezer/common": ["@lezer/common", "lezer/common", "lezerCommon"],
  "@lezer/highlight": ["@lezer/highlight", "lezer/highlight", "lezerHighlight"],
};

/** @type {Map<string, any>} */
const cache = new Map();

function getAcode() {
  // eslint-disable-next-line no-undef
  if (typeof acode !== "undefined" && acode && typeof acode.require === "function") {
    // eslint-disable-next-line no-undef
    return acode;
  }
  if (typeof globalThis !== "undefined" && globalThis.acode && typeof globalThis.acode.require === "function") {
    return globalThis.acode;
  }
  return null;
}

/**
 * @param {string} canonicalName p.ej. "@codemirror/language"
 * @param {{ silent?: boolean }} [options] silent=true: no imprime en
 *   consola si falla (para usarlo como sonda de "¿está listo?" — ver
 *   waitForCmRuntime() en main.js — sin llenar la consola de errores
 *   durante una espera corta y esperable).
 * @returns {any} el módulo resuelto
 */
export function resolveCmModule(canonicalName, options) {
  const silent = !!(options && options.silent);
  if (cache.has(canonicalName)) return cache.get(canonicalName);

  const acodeGlobal = getAcode();
  const tried = [];

  if (acodeGlobal) {
    const aliases = CANDIDATE_ALIASES[canonicalName] || [canonicalName];
    for (const alias of aliases) {
      tried.push(`acode.require("${alias}")`);
      try {
        const mod = acodeGlobal.require(alias);
        if (mod) {
          cache.set(canonicalName, mod);
          return mod;
        }
      } catch (_err) {
        // probar el siguiente alias
      }
    }
  } else {
    tried.push("acode global not available");
  }

  // Último recurso: buscar un espacio de nombres global tipo window.CodeMirror
  const g = typeof globalThis !== "undefined" ? globalThis : {};
  const guesses = [g.CodeMirror, g.cm6, g.__codemirror__];
  for (const guess of guesses) {
    if (guess && guess[canonicalName]) {
      cache.set(canonicalName, guess[canonicalName]);
      return guess[canonicalName];
    }
  }

  const message =
    `[gdscript] Could not resolve module "${canonicalName}" from the Acode runtime.\n` +
    `Tried: ${tried.join(", ")}.\n` +
    `Open chrome://inspect on your PC with the device/emulator connected, inspect ` +
    `Acode's WebView, and run something like Object.keys(acode._modules || acode.modules || {}) ` +
    `to find the real module name. Then add it to CANDIDATE_ALIASES in ` +
    `src/runtime/resolve-cm-module.js and rebuild.`;
  if (!silent) console.error(message);
  throw new Error(message);
}
