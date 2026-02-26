import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node18",
  bundle: true,
  clean: true,
  // Inline workspace packages (their exports point to .ts source, not runnable JS)
  noExternal: ["@taa/db", "@taa/shared"],
});
