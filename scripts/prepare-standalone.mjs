import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const standalone = path.join(process.cwd(), ".next", "standalone");

for (const [source, destination] of [
  [path.join(process.cwd(), ".next", "static"), path.join(standalone, ".next", "static")],
  [path.join(process.cwd(), "public"), path.join(standalone, "public")],
]) {
  if (!existsSync(source)) continue;
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}
