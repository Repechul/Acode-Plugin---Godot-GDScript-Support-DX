import { resolveCmModule } from "./resolve-cm-module.js";

const mod = resolveCmModule("@lezer/common");

export const { NodeProp, NodeType, NodeSet, Tree, TreeFragment, TreeCursor } = mod;

export default mod;
