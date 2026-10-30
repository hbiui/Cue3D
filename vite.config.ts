import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { searchForWorkspaceRoot } from "vite";
import path from "path";

export default defineConfig({
  base: "/",
  assetsInclude: ["**/*.fbx", "**/*.obj"],
  plugins: [react()],
  server: {
    fs: {
      allow: [
        // 自动识别项目根目录（安全且通用）
        searchForWorkspaceRoot(process.cwd()),
        // 明确允许访问上级目录的「模型库」
        path.resolve(process.cwd(), "../模型库"),
      ],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    pool: "threads",
    maxWorkers: 1,
    setupFiles: "./src/test/setup.ts",
  },
});