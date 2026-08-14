import { resolveCmModule } from "./resolve-cm-module.js";

const mod = resolveCmModule("@codemirror/autocomplete");

export const {
  autocompletion,
  completeFromList,
  ifNotIn,
  CompletionContext,
  insertCompletionText,
  snippet,
  snippetCompletion,
  startCompletion,
  closeCompletion,
  acceptCompletion,
  moveCompletionSelection,
  completionKeymap,
  completionStatus,
  currentCompletions,
  pickedCompletion,
  closeBrackets,
  closeBracketsKeymap,
} = mod;

export default mod;
