import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        setupFiles: ['./vitest.setup.js'],
        include: ["src/**/*.test.ts"],
        exclude: [
            "dist/**",
            "node_modules/**"
        ]
    },
});