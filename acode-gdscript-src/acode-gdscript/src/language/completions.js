import { snippetCompletion } from "../runtime/codemirror-autocomplete.js";
import { ALL_KEYWORDS, LITERAL_KEYWORDS, ANNOTATIONS, BUILTIN_TYPES } from "./keywords.js";
import { GLOBAL_FUNCTIONS, GLOBAL_CONSTANTS } from "./globals.js";
import { ENGINE_CLASSES } from "./classes.js";
import { COMMON_MEMBERS } from "./members.js";
import { SNIPPETS } from "./snippets.js";
import { scanDocumentSymbols } from "./document-symbols.js";

function callTemplate(name, params) {
  if (!params || params.length === 0) return `${name}()`;
  const inner = params.map((p, i) => `\${${i + 1}:${p}}`).join(", ");
  return `${name}(${inner})`;
}

const keywordOptions = ALL_KEYWORDS.map((k) => ({ label: k, type: "keyword", boost: -2 }));

const literalOptions = LITERAL_KEYWORDS.map((k) => ({ label: k, type: "constant", boost: -1 }));

// A diferencia del resto de listas curadas (siempre snippet o siempre
// objeto plano), las anotaciones se dividen según si REALMENTE llevan
// paréntesis en GDScript: una bare annotation como "@tool" es un error
// de sintaxis si se le añade "()", así que solo se envuelve en
// snippetCompletion (con callTemplate) cuando `params` existe — mismo
// patrón condicional que ya usa memberOptions más abajo para
// method/property.
const annotationOptions = ANNOTATIONS.map((a) =>
  a.params && a.params.length > 0
    ? snippetCompletion(callTemplate(a.name, a.params), {
        label: a.name,
        type: "keyword",
        detail: "annotation",
        info: a.info,
      })
    : { label: a.name, type: "keyword", detail: "annotation", info: a.info }
);

const typeOptions = BUILTIN_TYPES.map((t) => ({ label: t, type: "type" }));

const classOptions = ENGINE_CLASSES.map((c) => ({
  label: c.name,
  type: "class",
  info: c.info,
}));

const globalFunctionOptions = GLOBAL_FUNCTIONS.map((f) =>
  snippetCompletion(callTemplate(f.name, f.params), {
    label: f.name,
    type: "function",
    detail: f.detail,
    info: f.info,
  })
);

const constantOptions = GLOBAL_CONSTANTS.map((c) => ({
  label: c.name,
  type: "constant",
  detail: c.detail,
  info: c.info,
}));

const snippetOptions = SNIPPETS.map((s) =>
  snippetCompletion(s.template, {
    label: s.label,
    detail: s.detail,
    type: "text",
    boost: 1,
  })
);

// Snippets como "func _ready" tienen plantilla "func _ready() -> void:\n\t...".
// Si el usuario ya escribió "func " (con espacio) y sigue tecleando el
// nombre, el rango a reemplazar que calcula gdscriptCompletionSource solo
// cubre la palabra tras el espacio (p. ej. "_rea"); al insertar ahí la
// plantilla completa se duplicaba el "func " ya escrito (ver changelog
// 0.1.4). Para ese caso concreto se ofrecen estas variantes derivadas,
// sin el "func " inicial en label ni plantilla — la lista de nivel
// superior (con "func " incluido) se sigue usando para "_ready" o
// "func_ready" (sin espacio) escritos desde cero.
const FUNC_LABEL_PREFIX = "func ";
const funcCallbackNameOptions = SNIPPETS.filter((s) => s.label.startsWith(FUNC_LABEL_PREFIX)).map((s) => {
  if (!s.template.startsWith(FUNC_LABEL_PREFIX)) {
    // Snippet mal formado (label empieza por "func " pero la plantilla no):
    // se deja tal cual en vez de arriesgarse a recortar mal el texto.
    console.error(`[gdscript] snippet "${s.label}": template does not start with "${FUNC_LABEL_PREFIX}", check snippets.js`);
    return snippetCompletion(s.template, { label: s.label, detail: s.detail, type: "text", boost: 1 });
  }
  return snippetCompletion(s.template.slice(FUNC_LABEL_PREFIX.length), {
    label: s.label.slice(FUNC_LABEL_PREFIX.length),
    detail: s.detail,
    type: "text",
    boost: 1,
  });
});

// "var (export)"/"var (onready)" tienen plantilla que empieza por
// "@export"/"@onready", NO por "var " — a diferencia del caso de "func"
// de arriba, aquí no hay un prefijo compartido que recortar: la solución
// es que el rango a reemplazar cubra también el "var " ya escrito (no
// solo la palabra parcial), para sustituirlo entero por la plantilla
// correcta. Solo se activa si lo escrito tras "var " podría ser el
// principio de "export"/"onready" (si no, es una declaración de variable
// normal y no debe interferir).
const varAnnotationOptions = snippetOptions.filter((o) => o.label === "var (export)" || o.label === "var (onready)");

const memberOptions = COMMON_MEMBERS.map((m) =>
  m.kind === "method"
    ? snippetCompletion(callTemplate(m.name, m.params), {
        label: m.name,
        type: "method",
        info: m.info,
      })
    : { label: m.name, type: "property", info: m.info }
);

/** type de Completion (icono) por cada kind que puede devolver scanDocumentSymbols(). */
const LOCAL_KIND_TO_TYPE = {
  function: "function",
  variable: "variable",
  constant: "constant",
  signal: "variable", // no hay un icono dedicado para "signal" en el set por defecto de CM6
  class: "class",
};

/**
 * Opciones de autocompletado para los símbolos que el propio usuario
 * declara en el archivo actual (func/var/const/signal/class_name) — ver
 * document-symbols.js. A diferencia del resto de topLevelOptions (todo
 * estático, calculado una sola vez al cargar el módulo), esto depende del
 * contenido del documento y se recalcula en cada invocación.
 *
 * boost: 1 (igual que los snippets) para que aparezcan cerca de arriba:
 * es justo lo que el usuario ya escribió en su script, más relevante que
 * lo curado a mano del motor.
 *
 * Punto de contacto real con CM6 (context.state.doc): envuelto en
 * try/catch a propósito — un mock/entorno de test que no exponga
 * state.doc, o cualquier fallo al escanear, no debe romper el resto del
 * autocompletado (ver el mismo patrón defensivo en indent.js/hover.js).
 */
function localSymbolOptionsFor(context) {
  try {
    const text = context.state.doc.toString();
    const symbols = scanDocumentSymbols(text);
    return symbols.map((s) => {
      const type = LOCAL_KIND_TO_TYPE[s.kind] || "variable";
      if (s.kind === "function") {
        return snippetCompletion(callTemplate(s.name, s.paramNames), {
          label: s.name,
          type,
          detail: s.detail,
          info: s.info,
          boost: 1,
        });
      }
      return { label: s.name, type, detail: s.detail, info: s.info, boost: 1 };
    });
  } catch (_err) {
    return []; // best-effort: sin símbolos locales en vez de romper el autocompletado
  }
}

/** Todas las opciones "de nivel superior" (no precedidas de un punto).
 *  Incluye memberOptions porque en GDScript los métodos/propiedades del
 *  propio nodo se usan sin "self." delante (p. ej. move_and_slide()). */
const topLevelOptions = [
  ...keywordOptions,
  ...literalOptions,
  ...typeOptions,
  ...classOptions,
  ...globalFunctionOptions,
  ...constantOptions,
  ...snippetOptions,
  ...memberOptions,
];

/**
 * Fuente de autocompletado de GDScript.
 * - Tras "." → miembros comunes de Node/Object (sin inferencia de tipos real).
 * - Escribiendo "@algo" → anotaciones.
 * - Tras "func " + nombre parcial → callbacks del motor SIN "func " en la
 *   plantilla (para no duplicarlo; ver funcCallbackNameOptions arriba).
 * - Tras "var " + algo que podría ser "export"/"onready" → esas dos
 *   plantillas, sustituyendo también el "var " ya escrito (ver
 *   varAnnotationOptions arriba).
 * - En cualquier otro punto → palabras clave, tipos, clases, funciones/constantes
 *   globales, snippets, y los símbolos (func/var/const/signal/class_name)
 *   que el usuario ya declaró en este mismo archivo (ver document-symbols.js).
 */
export function gdscriptCompletionSource(context) {
  const afterDot = context.matchBefore(/\.\w*$/);
  if (afterDot) {
    return {
      from: afterDot.from + 1,
      options: memberOptions,
      validFor: /^\w*$/,
    };
  }

  const annotationWord = context.matchBefore(/@\w*/);
  if (annotationWord) {
    return {
      from: annotationWord.from,
      options: annotationOptions,
      validFor: /^@\w*$/,
    };
  }

  const afterFuncKeyword = context.matchBefore(/(?<![\w])func[ \t]+[A-Za-z_]\w*$/);
  if (afterFuncKeyword) {
    const nameMatch = afterFuncKeyword.text.match(/[A-Za-z_]\w*$/);
    return {
      from: context.pos - nameMatch[0].length,
      options: funcCallbackNameOptions,
      validFor: /^[A-Za-z_]\w*$/,
    };
  }

  const afterVarKeyword = context.matchBefore(/(?<![\w])var[ \t]+[A-Za-z_]\w*$/);
  if (afterVarKeyword) {
    const typedName = afterVarKeyword.text.match(/[A-Za-z_]\w*$/)[0];
    const looksLikeAnnotation = "export".startsWith(typedName) || "onready".startsWith(typedName);
    if (looksLikeAnnotation) {
      return {
        // A diferencia de las demás ramas, aquí "from" cubre también el
        // "var " ya escrito (no solo la palabra parcial): la plantilla
        // pone la anotación ANTES de "var", así que hay que sustituir el
        // "var " existente entero, no insertar después de él.
        from: afterVarKeyword.from,
        options: varAnnotationOptions,
        validFor: /^var[ \t]+[A-Za-z_]*$/,
      };
    }
  }

  const word = context.matchBefore(/[A-Za-z_]\w*/);
  if (!word && !context.explicit) return null;

  return {
    from: word ? word.from : context.pos,
    options: [...topLevelOptions, ...localSymbolOptionsFor(context)],
    validFor: /^\w*$/,
  };
}
