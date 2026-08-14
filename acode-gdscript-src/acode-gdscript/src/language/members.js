// Como el plugin no hace inferencia de tipos real, tras escribir "algo."
// se ofrece este conjunto curado de métodos/propiedades muy comunes en
// Node/Object/CanvasItem/Node2D/Node3D — cubre el uso diario aunque no
// sea exhaustivo ni específico del tipo exacto de la expresión.
//
// Decisión de diseño deliberada (0.8.0): NO se incluyen miembros de
// singletons como Input/Engine/OS/ProjectSettings (p.ej.
// Input.is_action_pressed()), aunque sean de uso frecuentísimo.
// memberOptions se mezcla también en topLevelOptions (ver
// completions.js: en GDScript los métodos propios del nodo se llaman
// sin "self." delante), así que cualquier entrada aquí aparece TANTO
// tras un punto COMO suelta en cualquier parte del código. Eso es
// correcto para algo como "queue_free()" (válido sin prefijo, como
// método propio) pero sería engañoso para "is_action_pressed()" (SOLO
// es válido como "Input.is_action_pressed()", nunca suelto) — incluirlo
// sugeriría una llamada inválida como si fuera un método propio del
// script. Los singletons quedarán cubiertos, si acaso, por una vía
// distinta en el futuro (opciones específicas tras "Input.", no
// mezcladas a nivel superior).
export const COMMON_MEMBERS = [
  // Node
  { name: "get_node", kind: "method", params: ["path"], info: "Gets a child node by its path." },
  { name: "get_node_or_null", kind: "method", params: ["path"], info: "Like get_node(), but returns null if it doesn't exist." },
  { name: "get_parent", kind: "method", params: [], info: "Returns the parent node." },
  { name: "get_child", kind: "method", params: ["idx"], info: "Returns the child at position idx." },
  { name: "get_children", kind: "method", params: [], info: "Returns an Array with all the children." },
  { name: "add_child", kind: "method", params: ["node"], info: "Adds node as a child of this node." },
  { name: "remove_child", kind: "method", params: ["node"], info: "Removes node from the children (without freeing it)." },
  { name: "queue_free", kind: "method", params: [], info: "Frees the node at the end of the current frame." },
  { name: "is_queued_for_deletion", kind: "method", params: [], info: "true if queue_free() was already called on this node." },
  { name: "get_tree", kind: "method", params: [], info: "Returns the active SceneTree." },
  { name: "get_path", kind: "method", params: [], info: "Returns this node's absolute NodePath." },
  { name: "is_inside_tree", kind: "method", params: [], info: "true if the node is inside the scene tree." },
  { name: "has_node", kind: "method", params: ["path"], info: "true if a node exists at that path." },
  { name: "duplicate", kind: "method", params: [], info: "Duplicates the node (and optionally its children)." },
  { name: "add_to_group", kind: "method", params: ["group"], info: "Adds this node to a group, so it can be found/addressed by that name." },
  { name: "remove_from_group", kind: "method", params: ["group"], info: "Removes this node from a group." },
  { name: "is_in_group", kind: "method", params: ["group"], info: "true if this node belongs to the given group." },
  { name: "set_process", kind: "method", params: ["enabled"], info: "Enables/disables calls to _process() for this node." },
  { name: "set_physics_process", kind: "method", params: ["enabled"], info: "Enables/disables calls to _physics_process() for this node." },
  { name: "name", kind: "property", info: "The node's name within its parent." },
  { name: "owner", kind: "property", info: "Owner node (for instantiated scenes)." },
  { name: "process_mode", kind: "property", info: "When the node is processed (paused, always, etc.)." },

  // Object / señales
  { name: "connect", kind: "method", params: ["signal_name", "callable"], info: "Connects a signal to a Callable." },
  { name: "disconnect", kind: "method", params: ["signal_name", "callable"], info: "Disconnects a signal from a Callable." },
  { name: "is_connected", kind: "method", params: ["signal_name", "callable"], info: "true if the signal is already connected." },
  { name: "emit_signal", kind: "method", params: ["signal_name"], info: "Emits a signal by name." },
  { name: "emit", kind: "method", params: [], info: "Emits this signal (signal.emit() syntax)." },
  { name: "has_method", kind: "method", params: ["method_name"], info: "true if the object has that method." },
  { name: "call", kind: "method", params: ["method_name"], info: "Calls a method by name." },
  { name: "call_deferred", kind: "method", params: ["method_name"], info: "Calls a method at the end of the frame." },
  { name: "set", kind: "method", params: ["property", "value"], info: "Sets a property by name." },
  { name: "get", kind: "method", params: ["property"], info: "Reads a property by name." },
  { name: "get_instance_id", kind: "method", params: [], info: "Returns a unique int identifying this object instance." },
  { name: "free", kind: "method", params: [], info: "Frees the object immediately (use with care!)." },

  // CanvasItem / Node2D / Node3D
  { name: "position", kind: "property", info: "Local position (Vector2 in 2D, Vector3 in 3D)." },
  { name: "global_position", kind: "property", info: "Position in global coordinates." },
  { name: "rotation", kind: "property", info: "Local rotation in radians." },
  { name: "rotation_degrees", kind: "property", info: "Local rotation in degrees (same value as rotation, easier to read/set)." },
  { name: "global_rotation", kind: "property", info: "Rotation in global coordinates, in radians." },
  { name: "scale", kind: "property", info: "Local scale." },
  { name: "visible", kind: "property", info: "Whether the node is drawn/visually active." },
  { name: "show", kind: "method", params: [], info: "Makes the node visible (equivalent to setting visible = true)." },
  { name: "hide", kind: "method", params: [], info: "Makes the node invisible (equivalent to setting visible = false)." },
  { name: "queue_redraw", kind: "method", params: [], info: "Schedules a call to _draw() on idle time (Godot 4 name for the old update())." },
  { name: "look_at", kind: "method", params: ["point"], info: "Rotates the node so it faces the given global point." },
  { name: "modulate", kind: "property", info: "Modulation (tint) color of the node." },
  { name: "z_index", kind: "property", info: "Drawing order in 2D." },

  // CharacterBody2D/3D
  { name: "velocity", kind: "property", info: "The body's velocity vector." },
  { name: "move_and_slide", kind: "method", params: [], info: "Moves the body using velocity, sliding along collisions." },
  { name: "is_on_floor", kind: "method", params: [], info: "true if the body is touching the floor." },
  { name: "is_on_wall", kind: "method", params: [], info: "true if the body is touching a wall." },
  { name: "is_on_ceiling", kind: "method", params: [], info: "true if the body is touching the ceiling." },

  // CharacterBody2D/3D (más específicos)
  { name: "move_and_collide", kind: "method", params: ["motion"], info: "Moves the body and stops at the first collision (no sliding)." },
  { name: "get_last_slide_collision", kind: "method", params: [], info: "Info about the last move_and_slide() collision." },
  { name: "get_floor_normal", kind: "method", params: [], info: "Normal of the current floor surface." },
  { name: "get_wall_normal", kind: "method", params: [], info: "Normal of the current wall surface." },
  { name: "get_real_velocity", kind: "method", params: [], info: "Actual velocity resulting from move_and_slide()." },
  { name: "up_direction", kind: "property", info: "Vector the body considers 'up' (affects what counts as floor/wall/ceiling)." },
  { name: "motion_mode", kind: "property", info: "Movement mode: Grounded or Floating." },

  // RigidBody2D/3D
  { name: "apply_impulse", kind: "method", params: ["impulse"], info: "Applies an instantaneous impulse at a point (or the center)." },
  { name: "apply_central_impulse", kind: "method", params: ["impulse"], info: "Applies an instantaneous impulse at the center of mass." },
  { name: "apply_force", kind: "method", params: ["force"], info: "Applies a continuous force at a point (or the center)." },
  { name: "apply_central_force", kind: "method", params: ["force"], info: "Applies a continuous force at the center of mass." },
  { name: "apply_torque_impulse", kind: "method", params: ["torque"], info: "Applies an instantaneous torque impulse (rotation)." },
  { name: "linear_velocity", kind: "property", info: "The body's linear velocity." },
  { name: "angular_velocity", kind: "property", info: "The body's angular velocity (rotation)." },
  { name: "mass", kind: "property", info: "The body's mass; affects forces and impulses." },
  { name: "gravity_scale", kind: "property", info: "Multiplier for the gravity applied to this body." },
  { name: "sleeping", kind: "property", info: "true if the body is 'sleeping' (the engine stops simulating it)." },
  { name: "freeze", kind: "property", info: "Freezes the body (stops being physically simulated)." },
  { name: "lock_rotation", kind: "property", info: "Prevents the body from rotating due to physics." },

  // StaticBody2D/3D
  { name: "constant_linear_velocity", kind: "property", info: "'Drag' velocity transmitted to bodies on top (conveyor belts)." },
  { name: "constant_angular_velocity", kind: "property", info: "'Drag' angular velocity transmitted to bodies on top." },

  // Area2D/3D
  { name: "monitoring", kind: "property", info: "Whether the area actively detects overlaps." },
  { name: "monitorable", kind: "property", info: "Whether other areas/bodies can detect this one." },
  { name: "get_overlapping_bodies", kind: "method", params: [], info: "Array of physics bodies currently overlapping." },
  { name: "get_overlapping_areas", kind: "method", params: [], info: "Array of areas currently overlapping." },
  { name: "body_entered", kind: "property", info: "Signal: a physics body has entered the area." },
  { name: "body_exited", kind: "property", info: "Signal: a physics body has exited the area." },
  { name: "area_entered", kind: "property", info: "Signal: another area has entered this one." },
  { name: "area_exited", kind: "property", info: "Signal: another area has exited this one." },

  // Timer
  { name: "start", kind: "method", params: [], info: "Starts the timer (uses the configured wait_time)." },
  { name: "stop", kind: "method", params: [], info: "Stops the timer." },
  { name: "wait_time", kind: "property", info: "Time (in seconds) between timeouts." },
  { name: "one_shot", kind: "property", info: "If true, the timer stops after firing once instead of repeating." },
  { name: "autostart", kind: "property", info: "If true, the timer starts automatically on _ready()." },
  { name: "timeout", kind: "property", info: "Signal: emitted when the timer reaches the end of its wait_time." },

  // AnimationPlayer
  { name: "play", kind: "method", params: ["anim_name"], info: "Plays the given animation (or resumes the current one if no name is given)." },
  { name: "is_playing", kind: "method", params: [], info: "true if an animation is currently playing." },
  { name: "current_animation", kind: "property", info: "Name of the animation currently playing (or last played)." },
  { name: "animation_finished", kind: "property", info: "Signal: emitted when a non-looping animation finishes playing." },
];
