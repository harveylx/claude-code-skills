import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [,, goalsFile, expectationsFile, outputDir] = process.argv;
if (!goalsFile || !expectationsFile || !outputDir) {
    process.stderr.write("Usage: node extract-scenarios.mjs <goals.md> <expectations.json> <output-dir>\n");
    process.exit(1);
}

const goalsText = readFileSync(goalsFile, "utf8").replace(/\r\n/g, "\n");
const expectations = JSON.parse(readFileSync(expectationsFile, "utf8"));
const sections = [...goalsText.matchAll(/^## (.+)\n([\s\S]*?)(?=^## |\s*$)/gm)]
    .map((match) => ({ title: match[1].trim(), body: match[2].trim() }));

if (!Array.isArray(expectations.scenarios) || expectations.scenarios.length === 0) {
    throw new Error("expectations.json must define a non-empty scenarios array");
}
if (sections.length !== expectations.scenarios.length) {
    throw new Error(`Scenario count mismatch: goals has ${sections.length}, expectations has ${expectations.scenarios.length}`);
}

mkdirSync(outputDir, { recursive: true });

const manifest = expectations.scenarios.map((scenario, index) => {
    const section = sections[index];
    const promptPath = resolve(outputDir, `${scenario.id}.md`);
    const prompt =
        `# ${section.title}\n\n` +
        `Run only this scenario. Do not make unrelated changes. Show your work.\n\n` +
        `${section.body}\n`;
    writeFileSync(promptPath, prompt, "utf8");
    return {
        ...scenario,
        title: section.title,
        promptFile: promptPath,
    };
});

writeFileSync(resolve(outputDir, "manifest.json"), JSON.stringify({ scenarios: manifest }, null, 2), "utf8");
process.stdout.write(JSON.stringify({ scenarios: manifest }, null, 2));
