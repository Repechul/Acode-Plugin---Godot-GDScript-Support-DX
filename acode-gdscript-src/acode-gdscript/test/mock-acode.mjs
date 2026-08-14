// Simula lo mínimo necesario de acode.require(...) para poder importar
// src/runtime/*.js y por tanto el resto del plugin desde Node, sin un
// dispositivo/WebView real. Esto NO reemplaza probar en Acode de verdad;
// solo verifica que la lógica propia (tokenizador, folding, datos de
// autocompletado) es correcta y no lanza excepciones.

function makeTag(name) {
  return { __tag: name };
}

const TAG_NAMES = [
  "lineComment", "docComment", "string", "number", "controlKeyword", "definitionKeyword",
  "operatorKeyword", "keyword", "self", "bool", "null", "meta", "typeName", "attributeName",
  "className", "variableName", "propertyName", "operator", "punctuation", "url",
  "paren", "squareBracket", "brace", "invalid",
];

const tags = {};
for (const name of TAG_NAMES) tags[name] = makeTag(name);
tags.special = (t) => ({ __tag: "special", of: t });
tags.definition = (t) => ({ __tag: "definition", of: t });
tags.function = (t) => ({ __tag: "function", of: t });
tags.constant = (t) => ({ __tag: "constant", of: t });
tags.standard = (t) => ({ __tag: "standard", of: t });

const lezerHighlightMock = {
  tags,
  Tag: { define: () => makeTag("custom") },
  styleTags: () => ({}),
  tagHighlighter: () => ({}),
  highlightTree: () => {},
  classHighlighter: {},
};

const lezerCommonMock = {
  NodeProp: { add: () => ({}) },
  NodeType: {},
  NodeSet: function () {},
  Tree: {},
  TreeFragment: {},
  TreeCursor: {},
};

class FakeStreamLanguage {
  constructor(parser) {
    this.parser = parser;
    this.data = { of: (cfg) => ({ __ext: "languageData", cfg }) };
  }
  static define(parser) {
    return new FakeStreamLanguage(parser);
  }
}

class FakeLanguageSupport {
  constructor(language, extensions) {
    this.language = language;
    this.extensions = extensions;
  }
}

const codemirrorLanguageMock = {
  Language: class {},
  LRLanguage: class {},
  LanguageSupport: FakeLanguageSupport,
  LanguageDescription: class {},
  StreamLanguage: FakeStreamLanguage,
  defineLanguageFacet: () => ({}),
  languageDataProp: {},
  syntaxTree: () => ({}),
  ensureSyntaxTree: () => ({}),
  indentNodeProp: { add: () => ({}) },
  foldNodeProp: { add: () => ({}) },
  foldInside: () => null,
  foldService: { of: (fn) => ({ __ext: "foldService", fn }) },
  codeFolding: () => ({}),
  foldGutter: () => ({}),
  indentUnit: { of: (v) => ({ __ext: "indentUnit", value: v }) },
  indentOnInput: () => ({}),
  indentService: { of: () => ({}) },
  HighlightStyle: { define: () => ({}) },
  syntaxHighlighting: () => ({}),
  bracketMatching: () => ({}),
};

const codemirrorStateMock = {
  EditorState: class {},
  StateField: { define: (spec) => ({ __ext: "stateField", spec }) },
  StateEffect: { define: () => ({}) },
  Facet: { define: () => ({}) },
  Compartment: class {},
};

const codemirrorViewMock = {
  EditorView: class {},
  keymap: { of: () => ({}) },
  Decoration: {},
  ViewPlugin: { define: () => ({}) },
  hoverTooltip: (source, options) => ({ __ext: "hoverTooltip", source, options }),
  showTooltip: { of: () => ({}), computeN: (deps, get) => ({ __ext: "showTooltip.computeN", deps, get }) },
  tooltips: () => ({}),
};

const codemirrorAutocompleteMock = {
  autocompletion: () => ({}),
  completeFromList: (list) => () => ({ options: list }),
  CompletionContext: class {},
  snippet: (tpl) => () => tpl,
  snippetCompletion: (template, extra) => ({ ...extra, __snippet: template }),
  completionKeymap: [],
};

const modules = {
  "@lezer/highlight": lezerHighlightMock,
  "@lezer/common": lezerCommonMock,
  "@codemirror/language": codemirrorLanguageMock,
  "@codemirror/state": codemirrorStateMock,
  "@codemirror/view": codemirrorViewMock,
  "@codemirror/autocomplete": codemirrorAutocompleteMock,
};

globalThis.acode = {
  require(name) {
    if (!(name in modules)) throw new Error(`mock acode.require: módulo desconocido "${name}"`);
    return modules[name];
  },
};

export { modules, tags };
