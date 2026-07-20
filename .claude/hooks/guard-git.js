#!/usr/bin/env node
// ── guard-git ─────────────────────────────────────────────────────────
// PreToolUse(Bash) hook. Blocks sweep-staging git commands.
//
// WHY: a parallel Claude chat is usually working in this repo with its own
// uncommitted WIP. `git add -A` / `git commit -a` would commit their
// half-finished work along with ours. The rule is: stage ONLY your own files,
// by path. See CLAUDE.md "Never sweep-stage in git".
//
// Contract: reads the tool call as JSON on stdin. Exit 0 = allow.
// Exit 2 = BLOCK, and stderr is shown to Claude as the reason.

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let cmd = '';
  try {
    cmd = JSON.parse(raw)?.tool_input?.command ?? '';
  } catch {
    process.exit(0); // unparseable → don't get in the way
  }
  if (!cmd) process.exit(0);

  // Collapse whitespace, then blank out quoted strings so a "-a" inside a
  // commit MESSAGE (git commit -m "add -a support") never false-positives.
  const norm = cmd.replace(/\s+/g, ' ').trim();
  const bare = norm.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");

  const RULES = [
    {
      re: /\bgit\s+add\s+(-A\b|--all\b|-u\b|--update\b|\.(?=\s|$))/,
      what: 'git add -A / . / -u',
    },
    {
      // -a, -am, -av ... but NOT --amend (second char is "-", not a letter)
      re: /\bgit\s+commit\b[^|;&]*\s-[a-zA-Z]*a[a-zA-Z]*\b/,
      what: 'git commit -a',
    },
  ];

  for (const r of RULES) {
    if (r.re.test(bare)) {
      console.error(
        `BLOCKED: ${r.what} is not allowed in this repo.\n\n` +
          `A parallel Claude chat shares this working tree and has uncommitted WIP.\n` +
          `Sweep-staging would commit their unfinished work.\n\n` +
          `Do this instead:\n` +
          `  1. git status --short          # see what's actually yours\n` +
          `  2. git add <path> [<path>...]  # stage ONLY your files, by path\n` +
          `  3. git diff --cached           # READ it before committing\n` +
          `  4. git commit -m "..."\n\n` +
          `(Or one shot: git commit -o <path1> <path2> -m "...")\n` +
          `See CLAUDE.md → "Never sweep-stage in git".`
      );
      process.exit(2);
    }
  }

  process.exit(0);
});
