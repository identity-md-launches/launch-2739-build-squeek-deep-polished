// Build in an isolated temporary directory, preserving the supplied manifests/config.
import { cp, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const root = resolve(".");
const temp = await mkdtemp(join(tmpdir(), "squeekdeep-build-"));
function run(command, args) {
  const r = spawnSync(command, args, { cwd: temp, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${command} exited ${r.status}`);
}
try {
  for (const name of [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    "src",
    "public",
  ])
    await cp(join(root, name), join(temp, name), { recursive: true });
  const reuse = process.env.SQUEEK_BUILD_DEPS;
  if (reuse) await symlink(resolve(reuse), join(temp, "node_modules"), "dir");
  else
    run("npm", [
      "ci",
      "--no-audit",
      "--no-fund",
      "--cache",
      join(tmpdir(), "squeekdeep-npm-cache"),
    ]);
  run("npm", ["run", "build"]);
  const out = join(temp, "dist");
  for (const name of [
    "mock_gameplay_target.png",
    "share/share_card_example.png",
    "keyart/title_keyart.png",
  ])
    await rm(join(out, "assets", name), { force: true });
  async function walk(dir, prefix = "") {
    const entries = await readdir(dir, { withFileTypes: true });
    return (
      await Promise.all(
        entries.map(async (e) =>
          e.isDirectory()
            ? walk(join(dir, e.name), `${prefix}${e.name}/`)
            : [`${prefix}${e.name}`],
        ),
      )
    ).flat();
  }
  const files = (await walk(out)).filter((p) => p !== "sw.js");
  const version = `squeekdeep-v1-${Date.now()}`;
  const sw = `/* Generated from the complete static export. */\nconst CACHE=${JSON.stringify(version)};\nconst FILES=${JSON.stringify(["./", ...files.map((p) => "./" + p)])};\nself.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});\nself.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('squeekdeep-v1-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});\nself.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):Response.error())));});\n`;
  await writeFile(join(out, "sw.js"), sw);
  await rm(join(root, "dist"), { recursive: true, force: true });
  await cp(out, join(root, "dist"), { recursive: true });
  console.log(
    `Exported ${files.length + 1} files to dist/ (including index.html and offline worker).`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
