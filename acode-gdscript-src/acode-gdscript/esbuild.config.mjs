import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isServe = process.argv.includes("--serve");

// -----------------------------------------------------------------------
// IMPORTANTE (léeme):
//
// Acode ya trae su propia copia de @codemirror/* y @lezer/* cargada en
// memoria. Si este plugin empaquetara su PROPIA copia de esos paquetes,
// las comprobaciones de identidad internas de CodeMirror 6 (Facets,
// StateFields, etc.) fallarían de forma silenciosa: el resaltado, el
// folding o el autocompletado simplemente no se aplicarían.
//
// Por eso, en vez de instalar @codemirror/* y @lezer/* como dependencias
// normales, redirigimos esos imports a pequeños "shims" locales en
// src/runtime/*.js que intentan obtener la MISMA instancia que ya usa
// Acode (vía acode.require(...)). Es el mismo patrón que usa el plugin
// oficial "acode-additional-langmodes" de Acode-Foundation.
//
// Si al probar el plugin en tu dispositivo ves en la consola remota
// (chrome://inspect) un error de "no se pudo resolver módulo", abre
// src/runtime/resolve-cm-module.js y ajusta CANDIDATE keys allí — ver
// las instrucciones de depuración en el README_EXT.md.
// -----------------------------------------------------------------------

const runtimeModules = {
  "@codemirror/state": "./src/runtime/codemirror-state.js",
  "@codemirror/view": "./src/runtime/codemirror-view.js",
  "@codemirror/language": "./src/runtime/codemirror-language.js",
  "@codemirror/autocomplete": "./src/runtime/codemirror-autocomplete.js",
  "@lezer/common": "./src/runtime/lezer-common.js",
  "@lezer/highlight": "./src/runtime/lezer-highlight.js",
};

const acodeRuntimePlugin = {
  name: "acode-runtime",
  setup(build) {
    build.onResolve({ filter: /^(@codemirror|@lezer)\// }, (args) => {
      const target = runtimeModules[args.path];
      if (!target) return;
      return { path: path.resolve(__dirname, target) };
    });
  },
};

const buildConfig = {
  entryPoints: ["src/main.js"],
  bundle: true,
  minify: !isServe,
  sourcemap: isServe ? "inline" : false,
  format: "iife",
  target: ["es2020"],
  logLevel: "info",
  color: true,
  outfile: "dist/main.js",
  plugins: [acodeRuntimePlugin],
};

(async function main() {
  if (isServe) {
    console.log("Starting development server at http://localhost:3000 ...");
    const ctx = await esbuild.context(buildConfig);
    await ctx.watch();
    await ctx.serve({ servedir: ".", port: 3000 });
    console.log("Use the 'Remote' option in Acode with http://<your-ip>:3000 and the reload button in the Extensions tab.");
  } else {
    console.log("Building production bundle...");
    await esbuild.build(buildConfig);
    console.log("Done: dist/main.js");
  }
})();
