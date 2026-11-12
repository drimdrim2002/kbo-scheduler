# AGENTS.md

This file provides guidance to coding agents (Claude Code, Codex, etc.) when working with code in this repository.

## How to explain

### Every explanation
- Lead with the conclusion.
- Do not scatter the things the user has to decide through the text. **Collect them in one place at the very end.** If there is nothing to decide, leave that part out.

### When an explanation would be 500+ characters
Do not explain right away. State the conclusion in one or two sentences, then ask the user to choose a style first.

- **All at once**: explain everything in one go, as before.
- **Tutor mode**: explain step by step.

### Tutor mode
- Start with the most important point and explain one step at a time.
- Say only one step per turn; move on to the next when the user replies.
- End each step with whatever the user has to decide at that step.

## What this repository is

An engine that builds KBO (Korean pro baseball) season schedules (OptaPlanner 9.44, Java 25), plus the public site on top of it, **schedulelab.kr**. Two parts:

- `src/` — the engine and the HTTP server. No Spring or other framework: the JDK's built-in `HttpServer` serves the static UI and the REST/SSE API together.
- `ui/` — build-less vanilla JS/CSS screens. No bundler, no npm, and they must also work when opened from `file://`.

To get oriented quickly, read `docs/STATUS.md` (progress and how to test by hand), `docs/KBO_PLAYGROUND_PRODUCT_DEFINITION.md` (product scope) and `deploy/README.md` (deployment). Docs and on-screen text are in Korean.

## Commands

```bash
mvn -q test                                   # all Java tests
mvn -q test -Dtest=StaticCacheTest            # one test class (one method: -Dtest=Class#method)
bash deploy/build.sh                          # compile + collect dependency jars into target/lib (required by run.sh)
scripts/run-server.sh --port 8080 --ui ui     # run the server; PORT, DATA_DIR, MAX_SECONDS, SEEDS, JAVA_XMX env vars also work
```

The server is `BaseballWebServer` (args `--port --ui --data --max-seconds --seeds --input`). On start it uses `data/results/default.json` if present; otherwise it solves a fresh default for 30 seconds.

All UI checks use headless Chrome on macOS (`/Applications/Google Chrome.app`). Everything below must pass, except for simple changes (see "Working rules"):

| Check | Command | Expected |
| :--- | :--- | :--- |
| UI core unit tests | `node ui/core/test/run-tests.js` | all pass (the JS scorer is compared against golden files pre-scored by Java `ScoreFormulas`) |
| Showcase, 3 pages × 375/768/1440 | `bash ui/tools/show/check.sh [index compare r]` | every line `PASS` |
| Studio self-test | `bash ui/tools/studio/selftest.sh 1440 877` | `ALL PASS` |
| Studio, every route | `bash ui/tools/studio/checkall.sh` (4 Chrome at once; `ONLY=pf-` = current flow only, ~15 s — use that while iterating, the full run before a merge) | every line `data-errors="0"` |
| Replay player alone | `bash ui/tools/replay/check.sh` | `data-errors="0"` |

The check scripts read attributes the page writes on `<html>` (`data-errors`, `data-scroll`, `data-selftest`, …) via `--dump-dom`. A new screen should collect console errors the same way (see the head of `ui/index.html`). Screenshots are taken with `shot.sh` into `ui/shots/`.

## Engine structure

The domain is an assignment of `Match` (a series, the planning entity) to `Calendar` (a slot). The score is a `BendableLongScore` (2 hard levels, 5 soft levels), and distances are computed as integers in units of 0.1 km.

- **The score formulas live in more than one place.** `ScoreFormulas` holds the math and weights; `BaseballConstraintProvider` (Bavet, used by the real solver) and `BaseballEasyScoreCalculator` (a cross-check) both use it. `BaseballScoreParityTest` keeps the two in agreement. When you change a rule, look at all three plus `ui/core/score.js` (the JS port) and the golden files. Rescheduling (date-by-date, design in `docs/RESCHEDULE_DAILY_ENGINE_DESIGN.md`) is the same: `RescheduleScoreFormulas`, the test-only `RescheduleReferenceScorer`, the sentences in `RuleCheck`/`RescheduleDiagnosis`/`RescheduleCodec`, and `ui/core/reschedule-daily.js` must give identical scores, numbers, violations and sentences for the same schedule. A mismatch between server and browser is a bug, not a quality difference; regenerate the golden files with `mvn -q test -Dtest=RescheduleGoldenTest -Dgolden.write=true` with every rule change (`node ui/core/test/run-tests.js` then compares the browser against them).
- **Initial solution**: `BaseballSolutionInitializer` builds a schedule with zero hard violations every time, using a GRASP multi-start (`initialPlan` is not read). Design notes: `docs/INITIAL_SOLUTION_CONSTRUCTION_PLAN.md`.
- **Moves**: `KempeChainMoveIteratorFactory` and `RoundBlockMoveIteratorFactory` produce `SeriesReassignmentMove`; their shared checks are in `RoundNeighborhood`. Moves that would break a hard constraint are rejected in `isMoveDoable` before any score is computed. Configuration is `baseballSolverConfig.xml` (Late Acceptance, three move selectors).
- **Web side** (`web/`):
  - `MultiStartSolver` — runs one single-threaded solver per seed in parallel and keeps the best solution. A single run has a large seed variance and gets stuck (evidence: `docs/ENGINE_SEED_BENCHMARK.md`).
  - `JobManager` — job queue (one job at a time, since one job uses every core), result cache (same problem and options give the same result), at most 1 concurrent job per IP. Queued jobs nobody is watching are dropped.
  - `ProblemCodec` — UI project JSON ↔ `BaseballSolution`. Series id = position in the `matches` array, slot id = position in the `calendar` array.
  - `Showcase`, `ResultStore`, `OgImage` — comparison numbers, results saved to `data/results/<id>.json` (share links), and the 1200×630 share image.
- Benchmarks and the replay trace are in `bench/` (`SeedBench`, `SolveTrace`). `data/baseball/trace-sample.json` is the mock data for the replay player.
- The server API is documented in the header comment of `BaseballWebServer`: `/api/v1/solve` (SSE progress), `/score`, `/compare`, `/results/<id>`, `/og/<id>.png`.

## UI structure

One server splits the paths between two apps (`BaseballWebServer.resolveStatic`).

| Path | Content |
| :--- | :--- |
| `/`, `/compare`, `/r/<id>` | **The showcase** (보여주는 문), `ui/show/` — three pages for fans on phones. A single `show.js` serves all three, switched by `body[data-page]`. Designed from 375px up |
| `/studio/` | **The scheduling studio** (만져보는 문), `ui/index.html` + `app/studio/` — a desktop wizard. `app/common/` holds shared screen parts |
| replay player | `app/replay/` + `core/replay-model.js` — animates the search process. Used by both the showcase and the studio |
| `/studio/admin` | **Run history** (편성 기록), `ui/admin/` — owner only, admin password, linked from no menu. One table per day of every solve call (`/api/v1/history`). Under `file://` it shows `sample-history.js`. Check: `bash ui/tools/admin/check.sh` → `data-errors="0" data-scroll="none" data-admin="list"` |

- `ui/core/` is pure core code with no DOM dependency (scoring, calendar generation, rescheduling, mock solver, store, SVG charts). It is classic-script, attaches to `globalThis.KBO`, and can also be `require`d from Node. See `ui/core/README.md` for the full table.
- There are two engine adapters. `RestEngineAdapter` talks to the server; `MockEngineAdapter` runs in a browser Worker when there is no server (`file://`). The showcase's `SHOW.api` likewise falls back to the JSON in `fixtures/` under `file://`. If you change the server API's shape, change the fixtures too.
- `ui-archive/` keeps design candidates from before the final choice. Do not edit it. The root-level `KBO_*_UI_REQUIREMENTS.md` files are the original requirements for the wizard.

## Deployment and caching

One server (Akamai, Tokyo) + Caddy + Cloudflare. An update is `HOST=<IP> bash deploy/deploy.sh` (git pull on the server → build → restart, about 5 seconds of downtime), and **you do it only when the user asks**. Static files are served with `no-cache` plus an ETag (modification time + size) and Last-Modified, and answer 304; the comparison also tolerates the `-gzip`/`-zstd` suffix Caddy's compression adds (`StaticCacheTest`). Cloudflare's Browser Cache TTL must be "Respect Existing Headers". The `?v=` value in HTML is optional now. Details: `deploy/README.md`.

## Working rules (conventions of this repository)

- The user of this project is not a developer. On-screen text must not use developer terms such as JSON, file names or seeds; keep titles short and put the explanation on the line below. The showcase's design rules (blue = clickable and the match bot, orange = real, boxes only for data, block order title → one-line lead → figure → secondary) are the "한 결 규칙" comment block in `ui/show/show.css` (near the end).
- For UI work, build alternatives (1 standard + 2–3 options) in separate worktrees and let the user choose. Merge and deploy only when asked. Worktrees live in `.claude/worktrees/`, and merges use `--no-ff`.
- The studio is desktop only and shows no "window too narrow" notice. The current flow is checked at 1440 and up and was measured to have no horizontal scroll down to 1217; the old `classic=1` screens overflow below 1280–1350. The showcase is designed for phones first. After a change, run the matching check script and confirm zero console errors and no horizontal scroll, except for simple changes (next rule).
- Simple changes, such as changing the text shown on screen, get no checks: do not run check scripts or tests, and do not open the screen to verify. Make the change, then tell the user what to look at so they can confirm it themselves.
- When you do run a check, save its full output to a file and read the result from there. Do not cut the output (`tail`, `head`) in a way that forces the same check to run again.
- Only `default.json` under `data/results/` is tracked; every other result file is gitignored. `default.json` is the source of the numbers quoted on the intro page, so do not regenerate it casually.
