import { resolveCmModule } from "./resolve-cm-module.js";

const mod = resolveCmModule("@codemirror/state");

export const {
  EditorState,
  StateField,
  StateEffect,
  Facet,
  Compartment,
  RangeSet,
  RangeSetBuilder,
  RangeValue,
  Prec,
  Transaction,
  EditorSelection,
  SelectionRange,
  Annotation,
  AnnotationType,
  ChangeSet,
  ChangeDesc,
  Text,
  combineConfig,
} = mod;

export default mod;
