import { cp, mkdir } from "node:fs/promises";

await mkdir("dist/nodes/OpenSerp", { recursive: true });
await cp("nodes/OpenSerp/openserp.svg", "dist/nodes/OpenSerp/openserp.svg");
await cp("nodes/OpenSerp/OpenSerp.node.json", "dist/nodes/OpenSerp/OpenSerp.node.json");
