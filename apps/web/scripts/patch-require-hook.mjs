/**
 * Pre-build patch for OpenNext on Cloudflare Workers.
 *
 * Next.js require-hook.js calls require('module') to patch Module.prototype.require
 * for .shared-runtime redirects. CF Workers' 'module' built-in does not expose
 * Module.prototype, so mod.prototype is undefined and the assignment throws:
 *   TypeError: Cannot read properties of undefined (reading 'require')
 *
 * Fix: guard all accesses to mod.prototype so they're no-ops when undefined.
 * Runs BEFORE opennextjs-cloudflare build so the patched code gets bundled.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const REQUIRE_HOOK = 'node_modules/next/dist/server/require-hook.js'

let src = readFileSync(REQUIRE_HOOK, 'utf-8')

let patched = src

// Guard originalRequire assignment
patched = patched.replace(
  'const originalRequire = mod.prototype.require;',
  'const originalRequire = mod && mod.prototype ? mod.prototype.require : undefined;'
)

// Guard resolveFilename assignment
patched = patched.replace(
  'const resolveFilename = // @ts-expect-error\nmod._resolveFilename;',
  'const resolveFilename = mod ? mod._resolveFilename : undefined;'
)

// Guard mod._resolveFilename reassignment
patched = patched.replace(
  '// @ts-expect-error\nmod._resolveFilename = (function(',
  'if (mod) mod._resolveFilename = (function('
)
patched = patched.replace(
  '}).bind(null, resolveFilename, hookPropertyMap);',
  '}).bind(null, resolveFilename, hookPropertyMap);'
)

// Guard mod.prototype.require reassignment
patched = patched.replace(
  '// @ts-expect-error\n// This is a hack to make sure that if a user requires a Next.js module that wasn\'t bundled\n// that needs to point to the rendering runtime version, it will point to the correct one.\n// This can happen on `pages` when a user requires a dependency that uses next/image for example.\nmod.prototype.require = function(request) {',
  'if (mod && mod.prototype) mod.prototype.require = function(request) {'
)

if (patched === src) {
  console.log('patch-require-hook: no patterns matched — already patched or Next.js changed. Skipping.')
  process.exit(0)
}

writeFileSync(REQUIRE_HOOK, patched)
console.log('patch-require-hook: guarded mod.prototype accesses in require-hook.js for CF Workers ✓')
