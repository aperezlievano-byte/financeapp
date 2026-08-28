import { execSync } from "node:child_process";

// Playwright global setup. It shells out instead of importing anything from
// the project: this file is type-checked from build step 1 onwards, while the
// Prisma client only exists from step 2, so a direct import would break an
// earlier step's gate.
function run(command: string): void {
  execSync(command, { stdio: "inherit" });
}

export default function globalSetup(): void {
  run("pnpm db:migrate:test");
  run("pnpm db:seed:test");
  run("pnpm fixtures");
}
