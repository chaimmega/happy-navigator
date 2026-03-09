#!/usr/bin/env node
/**
 * soak-autofix.js
 *
 * Parses a Playwright JSON report, identifies fixable failures, applies
 * conservative automated fixes, and writes FIXES_APPLIED.md.
 *
 * Usage:
 *   node scripts/soak-autofix.js playwright-report/results.json
 *
 * Exit codes:
 *   0 — at least one fix was applied (caller should re-run tests)
 *   1 — nothing was fixable (or no failures found)
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ─── CLI arg ──────────────────────────────────────────────────────────────────

const reportPath = process.argv[2];
if (!reportPath) {
  console.error("Usage: node scripts/soak-autofix.js <playwright-report/results.json>");
  process.exit(1);
}

if (!fs.existsSync(reportPath)) {
  console.error(`Report not found: ${reportPath}`);
  process.exit(1);
}

// ─── Types (JSDoc only — this is plain JS) ────────────────────────────────────

/**
 * @typedef {{ title: string; error?: { message?: string }; file?: string }} PWTest
 * @typedef {{ title: string; specs: PWSpec[] }} PWSuite
 * @typedef {{ title: string; tests: PWTest[] }} PWSpec
 * @typedef {{ suites?: PWSuite[] }} PWReport
 */

// ─── Parse report ─────────────────────────────────────────────────────────────

/** @type {PWReport} */
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

/** @type {{ title: string; error: string; file: string }[]} */
const failures = [];

/**
 * Recursively collect failed tests from nested suite structure.
 * @param {PWReport | PWSuite} node
 * @param {string} file
 */
function collectFailures(node, file) {
  // A node can have suites (from a file) and/or specs (from a describe block)
  const suites = /** @type {PWSuite[]} */ (node.suites ?? []);
  for (const suite of suites) {
    const suiteFile = suite.file ?? file;
    // specs inside suite
    const specs = /** @type {PWSpec[]} */ (suite.specs ?? []);
    for (const spec of specs) {
      for (const test of spec.tests ?? []) {
        const status = test.results?.[0]?.status ?? "passed";
        if (status === "failed" || status === "timedOut") {
          failures.push({
            title: `${spec.title} > ${test.title}`,
            error: test.results?.[0]?.error?.message ?? "",
            file: suiteFile,
          });
        }
      }
    }
    // Recurse into nested suites
    collectFailures(suite, suiteFile);
  }
}

collectFailures(report, "");

if (failures.length === 0) {
  console.log("No failures found in report. Nothing to fix.");
  process.exit(1);
}

console.log(`Found ${failures.length} failure(s). Analysing...`);
failures.forEach((f, i) => console.log(`  [${i + 1}] ${f.title}`));

// ─── Fix strategies ───────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, "..");
const COMPONENT_DIRS = [
  path.join(REPO_ROOT, "app", "components"),
  path.join(REPO_ROOT, "app"),
];

/** @type {{ file: string; description: string }[]} */
const fixesApplied = [];

/**
 * Scan all .tsx/.ts component files for a given testid and return the
 * file path if found, or null.
 * @param {string} testid
 * @returns {string | null}
 */
function findComponentWithTestId(testid) {
  for (const dir of COMPONENT_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".tsx") && !entry.name.endsWith(".ts")) continue;
      const filePath = path.join(dir, entry.name);
      const src = fs.readFileSync(filePath, "utf8");
      if (src.includes(`data-testid="${testid}"`)) return filePath;
    }
  }
  return null;
}

/**
 * Try to add a missing data-testid to a likely element in a component file.
 * Strategy: look for the first <element without a data-testid that matches
 * a heuristic (e.g. the role from the test name).
 *
 * This is very conservative: only acts when the element is unambiguous.
 * @param {string} testid
 * @returns {boolean}
 */
function tryAddTestId(testid) {
  // e.g. "btn-clear-start" → look for a <button near "clear" and "start"
  const parts = testid.split("-");
  const tag = parts[0] === "btn"   ? "button" :
              parts[0] === "input" ? "input"  :
              parts[0] === "error" ? "div"    : null;

  if (!tag) return false;

  // Keywords to match against surrounding context
  const keywords = parts.slice(1);

  for (const dir of COMPONENT_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".tsx")) continue;
      const filePath = path.join(dir, entry.name);
      let src = fs.readFileSync(filePath, "utf8");

      // Does this file contain all keywords?
      const hasAllKeywords = keywords.every((kw) =>
        src.toLowerCase().includes(kw.toLowerCase())
      );
      if (!hasAllKeywords) continue;

      // Find a <tag line that doesn't already have data-testid and
      // is near all our keywords within 5 lines
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes(`<${tag}`) && !line.includes(`<${tag.toUpperCase()}`)) continue;
        if (line.includes("data-testid")) continue;

        // Check surrounding context (5 lines each direction)
        const context = lines
          .slice(Math.max(0, i - 5), Math.min(lines.length, i + 5))
          .join(" ")
          .toLowerCase();
        const allKeywordsNearby = keywords.every((kw) =>
          context.includes(kw.toLowerCase())
        );
        if (!allKeywordsNearby) continue;

        // Insert data-testid= after the tag name
        const fixed = line.replace(
          new RegExp(`(<${tag})(\\s|>)`, "i"),
          `$1 data-testid="${testid}"$2`
        );
        if (fixed === line) continue; // no change

        lines[i] = fixed;
        fs.writeFileSync(filePath, lines.join("\n"), "utf8");
        fixesApplied.push({
          file: filePath,
          description: `Added data-testid="${testid}" to <${tag}> in ${entry.name}`,
        });
        return true;
      }
    }
  }
  return false;
}

/**
 * Run TypeScript type-check and attempt to fix simple issues.
 * @returns {boolean}
 */
function tryFixTypeScriptErrors() {
  let output = "";
  try {
    execSync("npx tsc --noEmit 2>&1", { cwd: REPO_ROOT, encoding: "utf8", stdio: "pipe" });
    return false; // No errors — nothing to fix
  } catch (err) {
    output = /** @type {Error & { stdout?: string }} */ (err).stdout ?? String(err);
  }

  // Look for the simplest fixable pattern: unused variable warnings that
  // TypeScript surfaces as errors under strict mode. We won't auto-fix
  // complex type errors — only clear-cut unused imports.
  const unusedImportRe = /([^\n]+\.tsx?)\(\d+,\d+\): error TS\d+: '[^']+' is declared but its value is never read\./g;
  let anyFixed = false;
  let match;
  while ((match = unusedImportRe.exec(output)) !== null) {
    const filePath = path.resolve(REPO_ROOT, match[1]);
    if (!fs.existsSync(filePath)) continue;
    // We don't auto-remove imports — too risky. Just flag it.
    console.log(`  [TS] Unfixable unused import in ${filePath}`);
  }

  // Run ESLint --fix on all source files (safe, non-destructive formatting)
  try {
    execSync(
      'npx eslint "app/**/*.{ts,tsx}" "e2e/**/*.ts" --fix --quiet',
      { cwd: REPO_ROOT, encoding: "utf8", stdio: "pipe" }
    );
    anyFixed = true;
    fixesApplied.push({
      file: "app/**",
      description: "Ran eslint --fix on app and e2e source files",
    });
  } catch {
    // ESLint may exit non-zero if unfixable errors remain — that's fine
  }

  return anyFixed;
}

/**
 * Try to add a missing aria attribute to the element that owns the given testid.
 * @param {string} testid
 * @param {string} ariaAttr  e.g. "aria-pressed"
 * @param {string} value     e.g. "false"
 * @returns {boolean}
 */
function tryAddAriaAttribute(testid, ariaAttr, value) {
  const filePath = findComponentWithTestId(testid);
  if (!filePath) return false;

  let src = fs.readFileSync(filePath, "utf8");
  // Check it's not already there
  if (src.includes(`${ariaAttr}=`)) return false;

  // Insert the attribute right after the data-testid
  const before = `data-testid="${testid}"`;
  const after = `data-testid="${testid}" ${ariaAttr}={${value}}`;
  if (!src.includes(before)) return false;

  src = src.replace(before, after);
  fs.writeFileSync(filePath, src, "utf8");
  fixesApplied.push({
    file: filePath,
    description: `Added ${ariaAttr}={${value}} to element with data-testid="${testid}"`,
  });
  return true;
}

// ─── Analyse each failure and attempt fixes ───────────────────────────────────

for (const failure of failures) {
  const errorMsg = failure.error;
  console.log(`\nAnalysing: "${failure.title}"`);

  // Strategy 1: missing data-testid
  const testidMatch = errorMsg.match(/getByTestId\(['"]([^'"]+)['"]\)/);
  if (!testidMatch) {
    // Also check for "Unable to find element" with data-testid attr
    const attrMatch = errorMsg.match(/data-testid="([^"]+)"/);
    if (attrMatch) {
      const testid = attrMatch[1];
      console.log(`  → Missing data-testid="${testid}" detected`);
      if (tryAddTestId(testid)) {
        console.log(`  ✓ Added data-testid="${testid}"`);
      } else {
        console.log(`  ✗ Could not auto-add — needs manual fix`);
      }
    }
  } else {
    const testid = testidMatch[1];
    const existing = findComponentWithTestId(testid);
    if (!existing) {
      console.log(`  → data-testid="${testid}" not found in components`);
      if (tryAddTestId(testid)) {
        console.log(`  ✓ Added data-testid="${testid}"`);
      } else {
        console.log(`  ✗ Could not auto-add — needs manual fix`);
      }
    } else {
      console.log(`  → data-testid="${testid}" exists in ${path.basename(existing)}`);
    }
  }

  // Strategy 2: missing aria-pressed attribute
  if (errorMsg.includes("aria-pressed")) {
    const tidMatch = errorMsg.match(/route-card-(\d+)/);
    if (tidMatch) {
      const testid = `route-card-${tidMatch[1]}`;
      console.log(`  → Missing aria-pressed on ${testid}`);
      if (tryAddAriaAttribute(testid, "aria-pressed", "isSelected")) {
        console.log(`  ✓ Added aria-pressed`);
      }
    }
  }

  // Strategy 3: lint error (ESLint) — run fix pass
  if (
    errorMsg.includes("ESLint") ||
    errorMsg.includes("no-unused-vars") ||
    errorMsg.includes("@typescript-eslint")
  ) {
    console.log("  → ESLint error detected — running eslint --fix");
    if (tryFixTypeScriptErrors()) {
      console.log("  ✓ ESLint --fix applied");
    }
  }

  // Strategy 4: TypeScript compile error
  if (
    errorMsg.includes("TS") &&
    (errorMsg.includes("Type error") || errorMsg.includes("tsc"))
  ) {
    console.log("  → TypeScript error detected — running tsc check");
    tryFixTypeScriptErrors();
  }
}

// ─── Write FIXES_APPLIED.md ───────────────────────────────────────────────────

const now = new Date().toISOString();

if (fixesApplied.length === 0) {
  console.log("\nNo automated fixes could be applied.");

  fs.writeFileSync(
    path.join(REPO_ROOT, "FIXES_APPLIED.md"),
    `# Soak Autofix Report\n\n**Run:** ${now}\n\n## Result\n\nNo automated fixes were applied.\n\n## Failures analysed\n\n${
      failures.map((f) => `- ${f.title}`).join("\n")
    }\n`
  );

  process.exit(1);
}

const fixLines = fixesApplied
  .map((f) => `- **${path.relative(REPO_ROOT, f.file)}**: ${f.description}`)
  .join("\n");

fs.writeFileSync(
  path.join(REPO_ROOT, "FIXES_APPLIED.md"),
  `# Soak Autofix Report\n\n**Run:** ${now}\n\n## Fixes applied (${fixesApplied.length})\n\n${fixLines}\n\n## Failures that triggered fixes\n\n${
    failures.map((f) => `- ${f.title}`).join("\n")
  }\n`
);

console.log(`\n${fixesApplied.length} fix(es) applied. See FIXES_APPLIED.md for details.`);
process.exit(0);
