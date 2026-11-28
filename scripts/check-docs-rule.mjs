#!/usr/bin/env node
/**
 * Unified documentation structure & Markdown rule validator for FAMS LMS (HCM26_CPL_JAVA_10).
 *
 * Single source of truth used by:
 *   1. Antigravity PreToolUse hook:  node ../scripts/check-docs-rule.mjs --hook-antigravity
 *   2. Claude Code PreToolUse hook:  node scripts/check-docs-rule.mjs --hook-claude
 *   3. Git pre-commit hook:          node scripts/check-docs-rule.mjs --staged
 *   4. GitHub Actions CI & manual:   node scripts/check-docs-rule.mjs --ci
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(REPO_ROOT, "docs");

const ALLOWED_ROOT_MD = new Set([
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "SRS_FAMS_LMS_MockProject_Hub_ThucTe_v2.0_With_UI.md",
  "team-contributions.md",
]);

const ALLOWED_DOCS_ROOT_FILES = new Set(["README.md"]);
const TOPIC_DIR_PATTERN = /^[0-9]{2}-[a-z0-9-]+$/;
const LOCAL_PATH_PATTERN = /\]\((?:[A-Za-z]:[/\\]|file:\/\/\/)/;

// Hidden AI/tool metadata directories where .md files are configuration, not project docs
const EXEMPT_TOP_DIRS = new Set([
  ".agents",
  ".agent",
  ".claude",
  ".cursor",
  ".github",
  ".gemini",
  "node_modules",
]);

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function listTopicDirs() {
  if (!fs.existsSync(DOCS_DIR)) return [];
  return fs
    .readdirSync(DOCS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && TOPIC_DIR_PATTERN.test(d.name))
    .map((d) => `docs/${d.name}/`)
    .sort();
}

function buildGuidanceMessage(errors) {
  const dirs = listTopicDirs();
  const dirList =
    dirs.length > 0
      ? dirs.map((d) => `  - ${d}`).join("\n")
      : "  - docs/01-getting-started/ .. docs/09-deployment-operations/";

  return [
    "Vi pham quy tac tai lieu Markdown (docs/):",
    ...errors.map((e) => `- ${e}`),
    "",
    "Hay doc docs/README.md (va duyet thu muc con trong docs/) truoc khi ghi file.",
    "Cac thu muc chu de hop le hien co:",
    dirList,
    "Quy uoc: khong dat .md roi o goc repo hoac goc docs/, ten file khong dau cach, dung link tuong doi (khong dung C:/, D:/, file:///).",
  ].join("\n");
}

/**
 * Resolve a path relative to REPO_ROOT. Returns null if outside the repo.
 */
function resolveRepoRelative(rawPath, fallbackCwd) {
  if (!rawPath || typeof rawPath !== "string") return null;
  const abs = path.isAbsolute(rawPath)
    ? path.resolve(rawPath)
    : path.resolve(fallbackCwd || REPO_ROOT, rawPath);

  const rel = path.relative(REPO_ROOT, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }
  return toPosix(rel);
}

/**
 * Validate a single repo-relative Markdown path and optional content snippets.
 */
function validateMarkdownTarget(relPosix, contentSnippets = []) {
  const errors = [];
  if (!relPosix || !relPosix.toLowerCase().endsWith(".md")) {
    return errors;
  }

  const parts = relPosix.split("/");
  const top = parts[0];

  // Skip AI/tool metadata directories (.agents, .claude, .cursor, .github, etc.)
  if (EXEMPT_TOP_DIRS.has(top)) {
    return errors;
  }

  // 1. Root-level .md file
  if (parts.length === 1) {
    if (!ALLOWED_ROOT_MD.has(parts[0])) {
      errors.push(
        `[Root .md] '${relPosix}' khong duoc phep dat o goc repository. Hay chuyen vao thu muc chu de phu hop trong docs/01-..09-/.`
      );
    }
  } else if (top === "docs") {
    // 2. Direct file inside docs/
    if (parts.length === 2) {
      if (!ALLOWED_DOCS_ROOT_FILES.has(parts[1])) {
        errors.push(
          `[Loose docs file] '${relPosix}' khong duoc dat truc tiep o goc docs/. Chi giu docs/README.md; hay dat vao docs/01-..09-/.`
        );
      }
    } else {
      // 3. First-level subfolder inside docs/ must match NN-kebab-case
      const topicDir = parts[1];
      if (!TOPIC_DIR_PATTERN.test(topicDir)) {
        errors.push(
          `[Invalid docs folder] 'docs/${topicDir}/' sai quy uoc. Thu muc cap 1 trong docs/ phai theo mau 'NN-kebab-case' (VD: 02-architecture, 10-new-topic).`
        );
      }
    }

    // 4. Filename spaces inside docs/
    const fileName = parts[parts.length - 1];
    if (fileName.includes(" ")) {
      errors.push(
        `[Filename space] '${relPosix}' chua khoang trang trong ten file. Hay dung kebab-case hoac UPPER_SNAKE_CASE.`
      );
    }
  }

  // 5. Check content snippets for local absolute paths (only for root .md or docs/**)
  if (parts.length === 1 || top === "docs") {
    for (const text of contentSnippets) {
      if (typeof text !== "string" || !text) continue;
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (LOCAL_PATH_PATTERN.test(line)) {
          errors.push(
            `[Local path] '${relPosix}' chua duong dan o dia cuc bo: ${line.trim().slice(0, 120)}. Hay dung duong dan tuong doi.`
          );
          break;
        }
      }
    }
  }

  return errors;
}

function extractToolPathAndContents(args) {
  if (!args || typeof args !== "object") return { targetPath: null, contents: [] };
  const targetPath =
    args.Path ??
    args.TargetFile ??
    args.file_path ??
    args.path ??
    null;

  const contents = [];
  for (const key of ["Content", "Replacement", "CodeContent", "ReplacementContent", "content", "new_string"]) {
    if (typeof args[key] === "string") contents.push(args[key]);
  }
  if (Array.isArray(args.ReplacementChunks)) {
    for (const chunk of args.ReplacementChunks) {
      if (chunk && typeof chunk.ReplacementContent === "string") {
        contents.push(chunk.ReplacementContent);
      }
    }
  }
  if (Array.isArray(args.edits)) {
    for (const edit of args.edits) {
      if (edit && typeof edit.new_string === "string") {
        contents.push(edit.new_string);
      }
    }
  }
  return { targetPath, contents };
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function runAntigravityHook() {
  const raw = readStdin().trim();
  if (!raw) {
    process.stdout.write(JSON.stringify({ decision: "allow" }));
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write(JSON.stringify({ decision: "allow" }));
    return;
  }

  const args = payload?.toolCall?.args ?? {};
  const { targetPath, contents } = extractToolPathAndContents(args);
  const relPosix = resolveRepoRelative(targetPath, payload?.cwd);
  if (!relPosix || !relPosix.toLowerCase().endsWith(".md")) {
    process.stdout.write(JSON.stringify({ decision: "allow" }));
    return;
  }

  const errors = validateMarkdownTarget(relPosix, contents);
  if (errors.length > 0) {
    process.stdout.write(
      JSON.stringify({
        decision: "deny",
        reason: buildGuidanceMessage(errors),
      })
    );
    return;
  }

  process.stdout.write(JSON.stringify({ decision: "allow" }));
}

function runClaudeHook() {
  const raw = readStdin().trim();
  if (!raw) {
    process.stdout.write("{}");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write("{}");
    return;
  }

  const args = payload?.tool_input ?? {};
  const { targetPath, contents } = extractToolPathAndContents(args);
  const relPosix = resolveRepoRelative(targetPath, payload?.cwd);
  if (!relPosix || !relPosix.toLowerCase().endsWith(".md")) {
    process.stdout.write("{}");
    return;
  }

  const errors = validateMarkdownTarget(relPosix, contents);
  if (errors.length > 0) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: buildGuidanceMessage(errors),
        },
      })
    );
    return;
  }

  process.stdout.write("{}");
}

function runGit(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function checkDiffForLocalPaths(diffText, errors) {
  let currentFile = null;
  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      const added = line.slice(1);
      if (LOCAL_PATH_PATTERN.test(added)) {
        errors.push(
          `[Local path] '${currentFile}' chua duong dan o dia cuc bo: ${added.trim().slice(0, 120)}. Hay luu anh vao thu muc images/ va dung duong dan tuong doi.`
        );
      }
    }
  }
}

function runStagedCheck() {
  let stagedOutput = "";
  try {
    stagedOutput = runGit(["diff", "--cached", "--name-only", "--diff-filter=ACM"]);
  } catch {
    process.exit(0);
  }

  const stagedMd = stagedOutput
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.toLowerCase().endsWith(".md"));

  if (stagedMd.length === 0) {
    process.exit(0);
  }

  const errors = [];
  for (const rel of stagedMd) {
    errors.push(...validateMarkdownTarget(rel, []));
  }

  try {
    const diffText = runGit(["diff", "--cached", "--unified=0", "--", "docs/**/*.md", "*.md"]);
    checkDiffForLocalPaths(diffText, errors);
  } catch {
    // Ignore if pathspec matches nothing
  }

  if (errors.length > 0) {
    process.stderr.write(`${buildGuidanceMessage(errors)}\n`);
    process.exit(1);
  }

  process.exit(0);
}

function walkMarkdownFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdownFiles(full, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

function runCiCheck() {
  const errors = [];

  // 1. Check root-level markdown files
  for (const entry of fs.readdirSync(REPO_ROOT, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      if (!ALLOWED_ROOT_MD.has(entry.name)) {
        errors.push(
          `[Root .md] '${entry.name}' khong duoc phep nam o goc repo. Hay chuyen vao thu muc chu de thich hop trong docs/01-..09-/.`
        );
      }
    }
  }

  // 2. Check top-level entries inside docs/
  if (fs.existsSync(DOCS_DIR) && fs.statSync(DOCS_DIR).isDirectory()) {
    for (const entry of fs.readdirSync(DOCS_DIR, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isFile()) {
        if (!ALLOWED_DOCS_ROOT_FILES.has(entry.name)) {
          errors.push(
            `[Loose docs file] 'docs/${entry.name}' khong duoc dat truc tiep o goc docs/. Chi giu docs/README.md; hay chuyen vao docs/01-..09-/.`
          );
        }
      } else if (entry.isDirectory()) {
        if (!TOPIC_DIR_PATTERN.test(entry.name)) {
          errors.push(
            `[Invalid docs folder] 'docs/${entry.name}/' sai quy uoc ten thu muc. Thu muc cap 1 trong docs/ phai khop mau 'NN-kebab-case' (VD: 08-training-operations, 10-new-topic).`
          );
        }
      }
    }

    // 3. Check spaces in markdown filenames under docs/
    for (const full of walkMarkdownFiles(DOCS_DIR).sort()) {
      const name = path.basename(full);
      if (name.includes(" ")) {
        const rel = toPosix(path.relative(REPO_ROOT, full));
        errors.push(
          `[Filename space] '${rel}' chua khoang trang trong ten file. Hay dung kebab-case hoac UPPER_SNAKE_CASE.`
        );
      }
    }
  }

  // 4. On PRs, reject newly added lines containing local absolute paths
  const eventName = process.env.EVENT_NAME || "";
  const baseSha = process.env.BASE_SHA || "";
  const headSha = process.env.HEAD_SHA || "";
  if (eventName === "pull_request" && baseSha && headSha) {
    try {
      const diffText = runGit(["diff", "--unified=0", `${baseSha}...${headSha}`, "--", "docs/**/*.md", "*.md"]);
      checkDiffForLocalPaths(diffText, errors);
    } catch {
      // Ignore if diff returns empty
    }
  }

  if (errors.length > 0) {
    if (process.env.GITHUB_ACTIONS === "true") {
      console.log("::error::Docs structure validation failed!");
    }
    console.error(buildGuidanceMessage(errors));
    process.exit(1);
  }

  console.log("OK: Docs structure and markdown rules passed.");
}

const mode = process.argv[2] || "--ci";
switch (mode) {
  case "--hook-antigravity":
    runAntigravityHook();
    break;
  case "--hook-claude":
    runClaudeHook();
    break;
  case "--staged":
    runStagedCheck();
    break;
  case "--ci":
    runCiCheck();
    break;
  default:
    console.error(`Unknown mode: ${mode}. Use --hook-antigravity | --hook-claude | --staged | --ci`);
    process.exit(2);
}
