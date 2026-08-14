import { resolveCmModule } from "./runtime/resolve-cm-module.js";

const PLUGIN_ID = "acode.plugin.repechul.godot.gdscript.support.dx"; // debe coincidir con plugin.json
const LANGUAGE_NAME = "gdscript";
const GD_EXTENSIONS = ["gd", "gdscript"];
const GD_FILENAME_RE = /\.(gd|gdscript)$/i;

function isGdscriptFilename(name) {
  return GD_FILENAME_RE.test(String(name || ""));
}

/**
 * Sonda barata y sin efectos secundarios: ¿ya expone Acode los alias de
 * @codemirror/language y @lezer/highlight? (resolveCmModule solo cachea
 * ÉXITOS, nunca fallos, así que llamarla varias veces es seguro).
 *
 * Por qué existe esto en vez de dejar que el import() de abajo reintente
 * solo: esbuild compila ese import() dinámico como un inicializador de
 * "una sola vez" (perezoso, pero no reintentable) — si su primer intento
 * falla porque Acode aún no publicó esos módulos, ese intento queda
 * "gastado" para siempre en esta sesión de la app, aunque Acode los
 * publique un instante después. Probar aquí ANTES de disparar el import()
 * evita quemar ese único intento con un fallo transitorio de arranque.
 */
function isCmRuntimeReady() {
  try {
    resolveCmModule("@codemirror/language", { silent: true });
    resolveCmModule("@lezer/highlight", { silent: true });
    return true;
  } catch (_err) {
    return false;
  }
}

/** Reintenta isCmRuntimeReady() con espera corta hasta maxWaitMs. */
async function waitForCmRuntime(maxWaitMs = 4000, stepMs = 60) {
  const deadline = Date.now() + maxWaitMs;
  while (!isCmRuntimeReady()) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  return true;
}

/**
 * Repara pestañas que Acode haya podido abrir/restaurar en modo "text"
 * antes de que este plugin llegara a registrar el lenguaje "gdscript"
 * (típico al reabrir la app con un .gd de una sesión anterior, cuando la
 * restauración de pestañas y la carga de plugins compiten entre sí).
 * Se apoya en la API documentada de Acode: editorManager.files y
 * file.setMode(name). Idempotente: no pasa nada si el archivo ya estaba
 * en modo "gdscript".
 */
function reconcileOpenFiles() {
  try {
    if (typeof editorManager === "undefined" || !editorManager) return;
    const files = editorManager.files || [];
    for (const file of files) {
      const name = file && (file.filename || file.name);
      if (isGdscriptFilename(name) && typeof file.setMode === "function") {
        file.setMode(LANGUAGE_NAME);
      }
    }
  } catch (err) {
    console.error("[gdscript] Could not reconcile the mode of already-open files:", err);
  }
}

if (typeof window !== "undefined" && window.acode) {
  acode.setPluginInit(PLUGIN_ID, async (_baseUrl, _$page, _cache) => {
    const editorLanguages = acode.require("editorLanguages");

    editorLanguages.register(
      LANGUAGE_NAME,
      GD_EXTENSIONS,
      "GDScript",
      async () => {
        try {
          // Ver waitForCmRuntime() arriba: nos aseguramos de que
          // @codemirror/language y @lezer/highlight ya estén disponibles
          // ANTES de disparar el import() de abajo, que solo se puede
          // "intentar de verdad" una vez por sesión de la app.
          await waitForCmRuntime();
          // Import diferido a propósito: hasta que Acode invoca este loader
          // (es decir, hasta que de verdad hace falta el modo "gdscript")
          // no se toca ningún módulo de @codemirror/*  ni @lezer/* (ver
          // src/runtime/resolve-cm-module.js). editorLanguages.register(),
          // arriba, ya no depende de esa resolución, así que Acode conoce
          // la extensión ".gd" de forma fiable desde el arranque del
          // plugin, aunque este loader tarde en resolverse o falle.
          const { gdscript } = await import("./language/index.js");
          return gdscript();
        } catch (err) {
          console.error("[gdscript] Could not build the language extension:", err);
          if (typeof window.toast === "function") {
            window.toast("GDScript: failed to load highlighting/autocomplete. Check the console.", 4000);
          }
          return [];
        }
      }
    );

    // Cubre los archivos ya abiertos en el momento en que este plugin
    // termina de inicializar (instalación/recarga en caliente, etc.)...
    reconcileOpenFiles();
    // ...y los que Acode restaure de la sesión anterior, evento que puede
    // llegar antes o después de este punto según el arranque.
    if (typeof editorManager !== "undefined" && editorManager && typeof editorManager.on === "function") {
      editorManager.on("init-open-file-list", reconcileOpenFiles);
    }
  });

  acode.setPluginUnmount(PLUGIN_ID, () => {
    try {
      const editorLanguages = acode.require("editorLanguages");
      editorLanguages.unregister(LANGUAGE_NAME);
    } catch (_err) {
      // el módulo puede no estar disponible al desinstalar; no es crítico
    }
    try {
      if (typeof editorManager !== "undefined" && editorManager && typeof editorManager.off === "function") {
        editorManager.off("init-open-file-list", reconcileOpenFiles);
      }
    } catch (_err) {
      // idem
    }
  });
}
