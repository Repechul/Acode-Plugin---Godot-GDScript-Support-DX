import { resolveCmModule } from "./resolve-cm-module.js";

const mod = resolveCmModule("@codemirror/language");

export const {
  Language,
  LRLanguage,
  LanguageSupport,
  LanguageDescription,
  StreamLanguage,
  defineLanguageFacet,
  languageDataProp,
  syntaxTree,
  ensureSyntaxTree,
  TreeIndentContext,
  indentNodeProp,
  foldNodeProp,
  foldInside,
  foldService,
  codeFolding,
  foldGutter,
  foldAll,
  unfoldAll,
  foldEffect,
  unfoldEffect,
  foldedRanges,
  indentUnit,
  indentOnInput,
  indentService,
  getIndentation,
  indentRange,
  delimitedIndent,
  continuedIndent,
  flatIndent,
  HighlightStyle,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  matchBrackets,
  syntaxParserRunning,
} = mod;

export default mod;
