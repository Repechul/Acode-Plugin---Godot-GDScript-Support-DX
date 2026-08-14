// Snippets en el formato que espera @codemirror/autocomplete: usa ${n:texto}
// para tabstops/placeholders. Se construyen como Completion en completions.js
// usando snippetCompletion(template, { label, detail, type }).
export const SNIPPETS = [
  {
    label: "func",
    detail: "function",
    template: "func ${1:name}(${2:}) -> ${3:void}:\n\t${4:pass}",
  },
  {
    label: "func _ready",
    detail: "callback: on entering the scene tree",
    template: "func _ready() -> void:\n\t${1:pass}",
  },
  {
    label: "func _process",
    detail: "callback: every frame",
    template: "func _process(delta: float) -> void:\n\t${1:pass}",
  },
  {
    label: "func _physics_process",
    detail: "callback: every physics step",
    template: "func _physics_process(delta: float) -> void:\n\t${1:pass}",
  },
  {
    label: "func _init",
    detail: "callback: constructor",
    template: "func _init(${1:}) -> void:\n\t${2:pass}",
  },
  {
    label: "func _input",
    detail: "callback: input event",
    template: "func _input(event: InputEvent) -> void:\n\t${1:pass}",
  },
  {
    label: "func _unhandled_input",
    detail: "callback: unconsumed input",
    template: "func _unhandled_input(event: InputEvent) -> void:\n\t${1:pass}",
  },
  {
    label: "class_name",
    detail: "declare a global class name",
    template: "class_name ${1:ClassName}",
  },
  {
    label: "extends",
    detail: "inherit from a class",
    template: "extends ${1:Node}",
  },
  {
    label: "var (export)",
    detail: "property exported to the inspector",
    template: "@export var ${1:name}: ${2:int} = ${3:0}",
  },
  {
    label: "var (onready)",
    detail: "variable initialized on entering the scene",
    template: "@onready var ${1:name}: ${2:Node} = $${3:Path}",
  },
  {
    label: "signal",
    detail: "declare a signal",
    template: "signal ${1:name}(${2:})",
  },
  {
    label: "enum",
    detail: "declare an enum",
    template: "enum ${1:Name} { ${2:VALUE_ONE}, ${3:VALUE_TWO} }",
  },
  {
    label: "if",
    detail: "conditional block",
    template: "if ${1:condition}:\n\t${2:pass}",
  },
  {
    label: "if / else",
    detail: "conditional block with an alternative",
    template: "if ${1:condition}:\n\t${2:pass}\nelse:\n\t${3:pass}",
  },
  {
    label: "for",
    detail: "for loop",
    template: "for ${1:element} in ${2:collection}:\n\t${3:pass}",
  },
  {
    label: "while",
    detail: "while loop",
    template: "while ${1:condition}:\n\t${2:pass}",
  },
  {
    label: "match",
    detail: "match expression",
    template: "match ${1:value}:\n\t${2:pattern}:\n\t\t${3:pass}\n\t_:\n\t\t${4:pass}",
  },
  {
    label: "class",
    detail: "nested inner class",
    template: "class ${1:Name}:\n\t${2:pass}",
  },
  {
    label: "tool",
    detail: "annotation: also run in the editor",
    template: "@tool",
  },

  // --- Añadidos en 0.6.0 (item 7 del roadmap) ---
  {
    label: "func _enter_tree",
    detail: "callback: entering the scene tree (runs before _ready)",
    template: "func _enter_tree() -> void:\n\t${1:pass}",
  },
  {
    label: "func _exit_tree",
    detail: "callback: leaving the scene tree",
    template: "func _exit_tree() -> void:\n\t${1:pass}",
  },
  {
    label: "func _draw",
    detail: "callback: draw custom content (CanvasItem — Node2D/Control)",
    template: "func _draw() -> void:\n\t${1:pass}",
  },
  {
    label: "script skeleton",
    detail: "extends + class_name + _ready to start a new script",
    template: "extends ${1:Node}\nclass_name ${2:ClassName}\n\n\nfunc _ready() -> void:\n\t${3:pass}",
  },
];
