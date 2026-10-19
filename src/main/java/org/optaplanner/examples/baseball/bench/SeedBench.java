package org.optaplanner.examples.baseball.bench;

import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.core.api.solver.Solver;
import org.optaplanner.core.api.solver.SolutionManager;
import org.optaplanner.core.api.solver.SolverFactory;
import org.optaplanner.core.config.solver.SolverConfig;
import org.optaplanner.examples.baseball.domain.BaseballSolution;

/**
 * Seed-variance benchmark for the KBO solver.
 *
 * <pre>
 * java -cp ... org.optaplanner.examples.baseball.bench.SeedBench &lt;mode&gt; &lt;outDir&gt; [secondsPerRun]
 *   A      seeds 0..19, one solver each, moveThreadCount 4 (production)
 *   B      5 bundles x 4 seeds, 4 single-threaded solvers in parallel, best of bundle
 *   C      acceptor/forager variants, seeds 0..9, moveThreadCount 4
 *   trace  one run (seed 0) recorded by SolveTrace into data/baseball/trace-sample.json
 *   one    one run: SeedBench one &lt;outDir&gt; &lt;seconds&gt; &lt;seed&gt; &lt;moveThreadCount&gt;
 *   all    A, B, C, trace in that order
 * </pre>
 *
 * Every run re-reads the input and re-initializes it with the run's seed, so runs never share state.
 * Results are appended to {@code <outDir>/bench-<mode>.md} as Markdown tables plus one line per run
 * in {@code <outDir>/runs.tsv}.
 */
public final class SeedBench {

    public static final String TRACE_SAMPLE = "data/baseball/trace-sample.json";
    private static final int STUCK_LEVEL_DISTANCE = 2;
    private static final int STUCK_LEVEL_HOLIDAY = 3;
    private static final int TOTAL_DISTANCE_LEVEL = 4;

    public record RunResult(String experiment, String variant, long seed, String moveThreads,
            BendableLongScore initialScore, BendableLongScore finalScore, long lastImprovedMs,
            long timeSpentMs, int bestEventCount, long soft2ZeroMs, long soft3ZeroMs, BaseballSolution solution) {

        public boolean stuck() {
            return finalScore.softScore(STUCK_LEVEL_DISTANCE) != 0
                    || finalScore.softScore(STUCK_LEVEL_HOLIDAY) != 0;
        }

        public long totalDistance() {
            return -finalScore.softScore(TOTAL_DISTANCE_LEVEL);
        }
    }

    private final Path outDir;
    private final long seconds;
    private final PrintStream log;

    public SeedBench(Path outDir, long seconds) {
        this.outDir = outDir;
        this.seconds = seconds;
        this.log = System.err;
    }

    public static void main(String[] args) throws Exception {
        String mode = args.length > 0 ? args[0] : "all";
        Path outDir = Path.of(args.length > 1 ? args[1] : "target/bench");
        long seconds = args.length > 2 ? Long.parseLong(args[2]) : 10L;
        Files.createDirectories(outDir);
        SeedBench bench = new SeedBench(outDir, seconds);
        switch (mode) {
            case "A" -> bench.experimentA();
            case "B" -> bench.experimentB();
            case "C" -> bench.experimentC();
            case "trace" -> bench.trace();
            case "one" -> bench.run("one", "manual", Long.parseLong(args[3]), args[4], null, null);
            case "all" -> {
                bench.experimentA();
                bench.experimentB();
                bench.experimentC();
                bench.trace();
            }
            default -> throw new IllegalArgumentException("unknown mode " + mode);
        }
    }

    // ---- single run -------------------------------------------------------------------------

    public RunResult run(String experiment, String variant, long seed, String moveThreads,
            Integer lateAcceptanceSize, Integer acceptedCountLimit) {
        BaseballSolution problem = BenchSupport.initializedProblem(seed);
        SolverConfig config = BenchSupport.solverConfig(seed, seconds, moveThreads, lateAcceptanceSize,
                acceptedCountLimit);
        SolverFactory<BaseballSolution> factory = SolverFactory.create(config);
        BendableLongScore initialScore = initialScore(factory, problem);
        Solver<BaseballSolution> solver = factory.buildSolver();
        ScoreRecorder recorder = new ScoreRecorder();
        solver.addEventListener(recorder);
        long startNanos = System.nanoTime();
        BaseballSolution solved = solver.solve(problem);
        long timeSpentMs = (System.nanoTime() - startNanos) / 1_000_000L;
        RunResult result = new RunResult(experiment, variant, seed, moveThreads, initialScore,
                solved.getBendableLongScore(), recorder.lastImprovedMs(), timeSpentMs, recorder.eventCount(),
                recorder.firstZeroMs(STUCK_LEVEL_DISTANCE), recorder.firstZeroMs(STUCK_LEVEL_HOLIDAY), solved);
        log.printf(Locale.ROOT, "[%s/%s] seed=%d threads=%s final=%s lastImproved=%dms spent=%dms events=%d%n",
                experiment, variant, seed, moveThreads, result.finalScore(), result.lastImprovedMs(),
                timeSpentMs, result.bestEventCount());
        appendTsv(result);
        appendCurve(result, recorder);
        return result;
    }

    /** Score of the initialized starting solution; the solver only fires best events after its first step. */
    static BendableLongScore initialScore(SolverFactory<BaseballSolution> factory, BaseballSolution problem) {
        return (BendableLongScore) SolutionManager.create(factory).update(problem);
    }

    // ---- experiment A: 20 seeds, production config ---------------------------------------------

    public List<RunResult> experimentA() throws IOException {
        List<RunResult> results = new ArrayList<>();
        for (long seed = 0; seed < 20; seed++) {
            results.add(run("A", "prod", seed, "4", null, null));
        }
        StringBuilder md = new StringBuilder();
        md.append("## 실험 A: 시드 0~19, 단일 실행, moveThreadCount 4, ").append(seconds).append("초\n\n");
        md.append(runTable(results));
        md.append('\n').append(summary("A(단일, 4스레드)", results)).append('\n');
        write("bench-A.md", md.toString());
        return results;
    }

    // ---- experiment B: multi-start ---------------------------------------------------------------

    public List<List<RunResult>> experimentB() throws Exception {
        int bundles = 5;
        int perBundle = 4;
        ExecutorService pool = Executors.newFixedThreadPool(perBundle);
        List<List<RunResult>> bundleResults = new ArrayList<>();
        try {
            for (int bundle = 0; bundle < bundles; bundle++) {
                List<Future<RunResult>> futures = new ArrayList<>();
                for (int k = 0; k < perBundle; k++) {
                    long seed = (long) bundle * perBundle + k;
                    String variant = "bundle" + bundle;
                    futures.add(pool.submit(() -> run("B", variant, seed, "NONE", null, null)));
                }
                List<RunResult> runs = new ArrayList<>();
                for (Future<RunResult> future : futures) {
                    runs.add(future.get());
                }
                bundleResults.add(runs);
            }
        } finally {
            pool.shutdownNow();
        }
        StringBuilder md = new StringBuilder();
        md.append("## 실험 B: 멀티스타트, 묶음 5개 × 시드 4개, 각 moveThreadCount NONE, ")
                .append(seconds).append("초 병렬\n\n");
        List<RunResult> singles = new ArrayList<>();
        List<RunResult> bests = new ArrayList<>();
        md.append("| 묶음 | 시드 | 시드별 최종 점수 | 묶음 최고(선택) | 갇힌 시드 수 |\n|---|---|---|---|---|\n");
        for (int bundle = 0; bundle < bundleResults.size(); bundle++) {
            List<RunResult> runs = bundleResults.get(bundle);
            singles.addAll(runs);
            RunResult best = runs.stream().max(Comparator.comparing(RunResult::finalScore)).orElseThrow();
            bests.add(new RunResult("B", "best" + bundle, best.seed(), best.moveThreads(), best.initialScore(),
                    best.finalScore(), best.lastImprovedMs(), best.timeSpentMs(), best.bestEventCount(),
                    best.soft2ZeroMs(), best.soft3ZeroMs(), best.solution()));
            long stuck = runs.stream().filter(RunResult::stuck).count();
            md.append("| ").append(bundle).append(" | ")
                    .append(runs.get(0).seed()).append("~").append(runs.get(runs.size() - 1).seed()).append(" | ");
            for (RunResult run : runs) {
                md.append(run.finalScore()).append("<br>");
            }
            md.append(" | seed ").append(best.seed()).append(": ").append(best.finalScore())
                    .append(" | ").append(stuck).append("/").append(runs.size()).append(" |\n");
        }
        md.append("\n### 개별 단일스레드 실행 20개\n\n").append(runTable(singles));
        md.append('\n').append(summary("B 개별(단일스레드 1개)", singles)).append('\n');
        md.append('\n').append(summary("B 묶음 최고(4개 중 최고)", bests)).append('\n');
        write("bench-B.md", md.toString());
        return bundleResults;
    }

    // ---- experiment C: acceptor / forager variants ---------------------------------------------

    public record Variant(String name, int lateAcceptanceSize, int acceptedCountLimit) {
    }

    public static final List<Variant> VARIANTS = List.of(
            new Variant("LA400-ACL40", 400, 40),
            new Variant("LA10000-ACL40", 10000, 40),
            new Variant("LA2000-ACL1", 2000, 1));

    /** The XML default (LA 2000, ACL 40) is not repeated here; experiment A seeds 0..9 serve as the baseline. */
    public List<List<RunResult>> experimentC() throws IOException {
        List<List<RunResult>> all = new ArrayList<>();
        StringBuilder md = new StringBuilder();
        md.append("## 실험 C: 갇힘 완화 설정 비교, 시드 0~9, moveThreadCount 4, ").append(seconds).append("초\n\n");
        for (Variant variant : VARIANTS) {
            List<RunResult> results = new ArrayList<>();
            for (long seed = 0; seed < 10; seed++) {
                results.add(run("C", variant.name(), seed, "4", variant.lateAcceptanceSize(),
                        variant.acceptedCountLimit()));
            }
            all.add(results);
            md.append("### ").append(variant.name()).append("\n\n").append(runTable(results)).append('\n')
                    .append(summary(variant.name(), results)).append("\n\n");
        }
        md.append("### 요약\n\n");
        md.append("| 설정 | 갇힘 | 총거리 최고 | 중앙 | 최악 | 평균 | 마지막 개선 중앙(ms) |\n|---|---|---|---|---|---|---|\n");
        for (int i = 0; i < VARIANTS.size(); i++) {
            md.append(summaryRow(VARIANTS.get(i).name(), all.get(i))).append('\n');
        }
        write("bench-C.md", md.toString());
        return all;
    }

    // ---- trace -----------------------------------------------------------------------------------

    public SolveTrace trace() throws IOException {
        long seed = 0L;
        BaseballSolution problem = BenchSupport.initializedProblem(seed);
        SolverConfig config = BenchSupport.solverConfig(seed, seconds, "4", null, null);
        SolverFactory<BaseballSolution> factory = SolverFactory.create(config);
        BendableLongScore initialScore = initialScore(factory, problem);
        Solver<BaseballSolution> solver = factory.buildSolver();
        SolveTrace trace = new SolveTrace(problem, seed, initialScore);
        solver.addEventListener(trace);
        BaseballSolution solved = solver.solve(problem);
        long bytes = trace.writeTo(Path.of(TRACE_SAMPLE));
        String line = String.format(Locale.ROOT,
                "trace seed=%d initial=%s final=%s events=%d changes=%d bytes=%d file=%s%n",
                seed, initialScore, solved.getBendableLongScore(), trace.eventCount(), trace.changeCount(), bytes, TRACE_SAMPLE);
        log.print(line);
        write("bench-trace.md", "## 트레이스 샘플\n\n" + line);
        return trace;
    }

    // ---- reporting -------------------------------------------------------------------------------

    static String runTable(List<RunResult> results) {
        StringBuilder sb = new StringBuilder();
        sb.append("| 시드 | 최종 점수 | 총거리(km) | 마지막 개선(ms) | 실행(ms) | best 이벤트 | soft2→0(ms) | soft3→0(ms) | 갇힘 |\n");
        sb.append("|---|---|---|---|---|---|---|---|---|\n");
        for (RunResult r : results) {
            sb.append("| ").append(r.seed()).append(" | ").append(r.finalScore()).append(" | ")
                    .append(r.totalDistance()).append(" | ").append(r.lastImprovedMs()).append(" | ")
                    .append(r.timeSpentMs()).append(" | ").append(r.bestEventCount()).append(" | ")
                    .append(ms(r.soft2ZeroMs())).append(" | ").append(ms(r.soft3ZeroMs())).append(" | ")
                    .append(r.stuck() ? "**갇힘**" : "") .append(" |\n");
        }
        return sb.toString();
    }

    private static String ms(long value) {
        return value < 0 ? "-" : Long.toString(value);
    }

    static String summary(String label, List<RunResult> results) {
        return "| 집합 | 갇힘 | 총거리 최고 | 중앙 | 최악 | 평균 | 마지막 개선 중앙(ms) |\n|---|---|---|---|---|---|---|\n"
                + summaryRow(label, results);
    }

    static String summaryRow(String label, List<RunResult> results) {
        List<RunResult> sorted = new ArrayList<>(results);
        sorted.sort(Comparator.comparing(RunResult::finalScore).reversed());
        long stuck = results.stream().filter(RunResult::stuck).count();
        RunResult best = sorted.get(0);
        RunResult median = sorted.get(sorted.size() / 2);
        RunResult worst = sorted.get(sorted.size() - 1);
        double mean = results.stream().mapToLong(RunResult::totalDistance).average().orElse(Double.NaN);
        List<Long> improved = results.stream().map(RunResult::lastImprovedMs).sorted().toList();
        long medianImproved = improved.get(improved.size() / 2);
        return String.format(Locale.ROOT, "| %s | %d/%d | %s | %s | %s | %.0f | %d |", label, stuck,
                results.size(), scoreCell(best), scoreCell(median), scoreCell(worst), mean, medianImproved);
    }

    private static String scoreCell(RunResult r) {
        return r.stuck() ? r.totalDistance() + " (갇힘 " + r.finalScore() + ")" : Long.toString(r.totalDistance());
    }

    private synchronized void appendTsv(RunResult r) {
        String line = String.join("\t", r.experiment(), r.variant(), Long.toString(r.seed()), r.moveThreads(),
                String.valueOf(r.initialScore()), String.valueOf(r.finalScore()), Long.toString(r.lastImprovedMs()),
                Long.toString(r.timeSpentMs()), Integer.toString(r.bestEventCount()),
                Long.toString(r.soft2ZeroMs()), Long.toString(r.soft3ZeroMs()), Boolean.toString(r.stuck())) + "\n";
        try {
            Files.writeString(outDir.resolve("runs.tsv"), line, StandardCharsets.UTF_8,
                    java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.APPEND);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    /** One line per best event: experiment, variant, seed, elapsedMs, score. */
    private synchronized void appendCurve(RunResult r, ScoreRecorder recorder) {
        StringBuilder sb = new StringBuilder();
        for (ScoreRecorder.Point point : recorder.points()) {
            sb.append(String.join("\t", r.experiment(), r.variant(), Long.toString(r.seed()),
                    Long.toString(point.elapsedMs()), point.score().toString())).append('\n');
        }
        try {
            Files.writeString(outDir.resolve("curves.tsv"), sb.toString(), StandardCharsets.UTF_8,
                    java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.APPEND);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private void write(String name, String content) throws IOException {
        Files.writeString(outDir.resolve(name), content, StandardCharsets.UTF_8);
        log.println("wrote " + outDir.resolve(name));
    }
}
