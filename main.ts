// Ship It Friday — make.fun entry generator (u-mgwals-ship-it-friday-30bd407a)
//
// Writes ONE line to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback /output/entry.txt):
// the funniest git commit message an AI coding agent writes right before
// breaking production on a Friday.
//
// How it works:
//   1. A hand-written list of candidate commit messages (13 of them).
//   2. A small deterministic scorer ranks each candidate against the
//      judge's five criteria, most important first:
//        (1) is a git commit message from an AI coding agent, funny, set
//            just before breaking production on a Friday;
//        (2) lands the joke with a real punch in one read;
//        (3) sounds like an AI coding agent's voice: confident, cheerful,
//            completely unaware of the disaster it is about to cause;
//        (4) carries the Friday feeling, the end-of-week rush, the doomed
//            urge to ship it now;
//        (5) reads cleanly as a single line a real engineer would
//            recognise as a commit message.
//   3. The best candidate is picked, checked against the gate (exactly one
//      line, 1-159 characters, no surrounding whitespace), written out,
//      read back, and verified byte-for-byte.
//
// Deterministic: no network, no randomness, no clock. Same output every run.
// Node 22+ stdlib only.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const GATE_MIN = 1;
const GATE_MAX = 159;

// ---------------------------------------------------------------------------
// Candidates — all written by hand for this bounty.
// ---------------------------------------------------------------------------
const CANDIDATES: string[] = [
  "feat: ship to prod Friday 4:59pm — I tested it thoroughly (I did not test it) and honestly, what could go wrong?",
  "feat: ship to prod Friday 4:59pm — I tested it thoroughly (there are no tests) and honestly, what could go wrong?",
  "feat: push to prod Friday 4:59pm — all tests pass (there are no tests), logging off, see you Monday",
  "chore: delete the test suite, it was slowing down the vibe — shipping to prod Friday 4:59pm, what could go wrong?",
  "fix: deploy the untested refactor straight to prod, it's Friday, the weekend starts when I say it starts",
  "chore: remove all tests, they were slowing down the vibe — happy Friday, production!",
  "fix: production was fine until I improved it — deploying now, logging off, see you in the incident channel",
  "feat: refactor auth, payments, and the database in one commit — Friday energy, let's goooo",
  "fix: I have tested this thoroughly (I have not tested this) — shipping Friday at 5pm, wish me luck",
  "deploy: change everything, tell no one, leave at 5 — it's Friday and the CI is green (it's not)",
  "feat: push to prod on a Friday because I read the docs and the docs said 'you got this'",
  "ship it: Friday deploy, full send — if it breaks we simply won't be here until Monday",
  "chore: replace the prod database with a vibe, deploy now, see everyone Monday (maybe)",
];

// ---------------------------------------------------------------------------
// Deterministic scorer. Weights follow the judge's criteria order:
// criterion 1 matters most, then 2, then 3, then 4, then 5.
// ---------------------------------------------------------------------------
interface ScoreBreakdown {
  line: string;
  chars: number;
  onSubject: number; // criterion 1: commit message + AI agent + Friday + prod
  punch: number; // criterion 2: a real punch that pays off in one read
  agentVoice: number; // criterion 3: confident, cheerful, unaware
  fridayFeeling: number; // criterion 4: end-of-week rush, ship-it-now urge
  commitShape: number; // criterion 5: reads like a real commit message
  total: number;
}

function has(text: string, ...needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

function score(line: string): ScoreBreakdown {
  const chars = [...line].length;

  // Criterion 1 — on subject: a commit message, from an AI agent, funny,
  // right before breaking production on a Friday.
  let onSubject = 0;
  if (/^(feat|fix|chore|deploy|ship it|refactor|docs|style|test)(\(.+\))?:/i.test(line)) onSubject += 6;
  if (has(line, "friday")) onSubject += 8;
  if (has(line, "prod", "production")) onSubject += 8;
  if (has(line, "deploy", "ship")) onSubject += 4;
  if (has(line, "break", "breaks", "incident", "untested", "did not test", "not test", "no tests")) onSubject += 4;

  // Criterion 2 — punch: a twist that lands in one read. A parenthetical
  // confession, a "what could go wrong", or a sharp contrast delivers it.
  let punch = 0;
  if (/\(.*(not|no|did not|didn't|never).*\)/i.test(line)) punch += 10; // "(I did not test it)"
  // "(there are no tests)" is a sharper twist than "(I did not test it)":
  // the agent didn't merely skip testing, there is no test suite at all,
  // yet it still claims to have tested thoroughly. The boast collapses
  // completely inside one parenthetical.
  if (has(line, "there are no tests")) punch += 6;
  if (has(line, "what could go wrong")) punch += 8;
  if (has(line, "until i improved it", "was fine until")) punch += 6;
  if (has(line, "simply won't be here", "see you in the incident")) punch += 6;
  if (has(line, "slowing down the vibe", "with a vibe")) punch += 5;
  if (has(line, "weekend starts when i say")) punch += 5;
  if (has(line, "let's goooo", "full send")) punch += 4;
  if (has(line, "it's not")) punch += 4;
  if (has(line, "you got this")) punch += 3;

  // Criterion 3 — AI agent voice: first-person confidence, cheerful,
  // blissfully unaware of the coming disaster.
  let agentVoice = 0;
  if (has(line, "i tested", "i have tested", "i read the docs", "i say it starts")) agentVoice += 8;
  if (has(line, "honestly", "what could go wrong", "wish me luck", "let's go")) agentVoice += 5;
  if (has(line, "happy friday", "friday energy")) agentVoice += 4;
  if (has(line, "thoroughly")) agentVoice += 3;
  if (has(line, "i did not", "i have not")) agentVoice += 3; // cheerful self-own

  // Criterion 4 — Friday feeling: the clock, the rush, the weekend, the
  // doomed urge to ship it now.
  let fridayFeeling = 0;
  if (has(line, "friday")) fridayFeeling += 6;
  if (has(line, "4:59pm", "5pm", "leave at 5", "logging off")) fridayFeeling += 6;
  if (has(line, "weekend", "monday", "see you monday")) fridayFeeling += 5;
  if (has(line, "ship it", "deploy now", "deploying now", "shipping friday", "full send")) fridayFeeling += 5;
  if (has(line, "right now", "straight to prod")) fridayFeeling += 3;

  // Criterion 5 — reads like a real commit message: conventional type
  // prefix, single line, sensible length, no stray formatting.
  let commitShape = 0;
  if (/^(feat|fix|chore|deploy|refactor|docs|style|test)(\(.+\))?:\s+\S/.test(line)) commitShape += 8;
  else if (/^ship it:/i.test(line)) commitShape += 5;
  if (!line.includes("\n") && !line.includes("\r")) commitShape += 4;
  if (chars >= 60 && chars <= 130) commitShape += 4; // punchy, not bloated
  else if (chars > 130 && chars <= GATE_MAX) commitShape += 1;
  if (line === line.trim() && line.length > 0) commitShape += 2;

  const total = onSubject * 5 + punch * 4 + agentVoice * 3 + fridayFeeling * 2 + commitShape;

  return { line, chars, onSubject, punch, agentVoice, fridayFeeling, commitShape, total };
}

function main(): void {
  // Score every candidate, best total wins; ties break to the shorter line,
  // then to the earlier candidate (fully deterministic).
  const scored = CANDIDATES.map(score);
  scored.sort((a, b) => b.total - a.total || a.chars - b.chars || 0);
  const winner = scored[0];

  // Print the ranking so the choice is auditable.
  for (const s of scored) {
    console.log(
      `${String(s.total).padStart(3)} pts | ${s.chars} chars | ${s.line}`,
    );
  }
  console.log(`\nWinner: ${winner.line}`);
  console.log(`Characters: ${winner.chars}`);

  // Gate: exactly one line, 1-159 characters, not only whitespace,
  // no surrounding whitespace.
  const line = winner.line;
  if (line !== line.trim()) throw new Error("gate failed: surrounding whitespace");
  if (line.includes("\n") || line.includes("\r")) throw new Error("gate failed: not a single line");
  if (line.length < GATE_MIN || [...line].length > GATE_MAX) {
    throw new Error(`gate failed: ${[...line].length} chars, must be ${GATE_MIN}-${GATE_MAX}`);
  }
  if (line.trim().length === 0) throw new Error("gate failed: only whitespace");

  // Write and verify.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output/entry.txt";
  const dir = outDir.endsWith("entry.txt") ? outDir.slice(0, -"entry.txt".length) || "." : outDir;
  const outPath = outDir.endsWith("entry.txt") ? outDir : join(outDir, "entry.txt");
  mkdirSync(dir === "" ? "." : dir, { recursive: true });
  writeFileSync(outPath, line, "utf8");

  const back = readFileSync(outPath, "utf8");
  if (back !== line) throw new Error("verify failed: bytes read back do not match");
  if ([...back].length !== [...line].length) throw new Error("verify failed: char count mismatch");

  console.log(`Wrote ${outPath} (${[...back].length} chars, verified byte-for-byte)`);
}

main();
