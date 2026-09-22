const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "src");
const OUTPUT = path.join(process.cwd(), "docs", "SRC_STRUCTURE.md");

function walk(dir, prefix = "") {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    // Directories first, then files
    entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
    });

    let lines = [];

    entries.forEach((entry, index) => {
        const last = index === entries.length - 1;
        const pointer = last ? "└── " : "├── ";

        lines.push(`${prefix}${pointer}${entry.name}`);

        if (entry.isDirectory()) {
            lines.push(
                ...walk(
                    path.join(dir, entry.name),
                    prefix + (last ? "    " : "│   ")
                )
            );
        }
    });

    return lines;
}

const tree = [
    "src",
    ...walk(ROOT)
].join("\n");

const markdown = `# Source Directory Structure

> **Auto-generated.** Do not edit manually.

Generated: ${new Date().toLocaleString()}

\`\`\`text
${tree}
\`\`\`
`;

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, markdown);

console.log("✅ Generated docs/SRC_STRUCTURE.md");