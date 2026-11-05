package org.optaplanner.examples.baseball.web;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.lang.management.ManagementFactory;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.simple.JSONObject;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.score.ScoreFormulas;
import org.optaplanner.examples.baseball.solver.BaseballSolutionInitializer;

/**
 * 동시에 찾는 갈래 수(시드 수) 4 vs 8 벤치. 서버와 같은 {@link MultiStartSolver}·{@code JobManager.problemFor}(SCRATCH) 경로를 쓴다.
 * 결과 문서는 docs/ENGINE_8SEED_BENCHMARK.md, 집계는 scripts/seed-count-summary.py.
 *
 * <pre>
 * java -cp ... org.optaplanner.examples.baseball.web.SeedCountBench \
 *     &lt;problem.json&gt; &lt;outDir&gt; &lt;label&gt; &lt;seconds&gt; &lt;unimprovedSec|0&gt; &lt;groups&gt; &lt;seedBase&gt; [atOnceGroups]
 * </pre>
 *
 * 묶음 g마다 차례로(조건을 번갈아 돌려 부하 변화가 한쪽에 몰리지 않게):
 * <ul>
 * <li>four: 시드 4개를 한 번에(지금 4코어 서버와 같다). 시드 seedBase + 4g ..</li>
 * <li>eight: 시드 8개를 4개씩 두 판(8코어 서버에서 시드마다 코어 하나를 쓰는 것을 흉내), 두 판 중 최고. 시드 seedBase + 10000 + 8g ..</li>
 * <li>atonce: 시드 8개를 이 컴퓨터에서 한 번에(참고용, 일부가 효율 코어에 올라가 8코어 서버보다 불리). g &lt; atOnceGroups만. 시드 seedBase + 20000 + 8g ..</li>
 * </ul>
 * 첫 판은 JVM 예열용으로 버린다. 판마다 시작 전 부하(1분 load average, 이 프로세스 밖 CPU 합)를 재고, 다른 프로세스가 CPU를
 * {@value #BUSY_CPU_PERCENT}% 넘게 쓰면 최대 {@value #MAX_WAIT_SEC}초 기다린 뒤 그 사실을 기록하고 진행한다.
 * 출력: outDir/rounds.tsv(판마다), seeds.tsv(시드마다), groups.tsv(묶음 결과마다). 모두 덧붙이기라 여러 실행을 한 폴더에 모을 수 있다.
 */
public final class SeedCountBench {

    static final double BUSY_CPU_PERCENT = 250.0;
    static final int MAX_WAIT_SEC = 1200;

    private final JSONObject problem;
    private final Path outDir;
    private final String label;
    private final long seconds;
    private final Long unimprovedSec;

    private SeedCountBench(JSONObject problem, Path outDir, String label, long seconds, Long unimprovedSec) {
        this.problem = problem;
        this.outDir = outDir;
        this.label = label;
        this.seconds = seconds;
        this.unimprovedSec = unimprovedSec;
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 7) {
            System.err.println("usage: SeedCountBench <problem.json> <outDir> <label> <seconds> <unimprovedSec|0> <groups> <seedBase> [atOnceGroups]");
            System.exit(2);
        }
        JSONObject problem = BaseballApp.readJsonFile(args[0]);
        Path outDir = Path.of(args[1]);
        Files.createDirectories(outDir);
        long seconds = Long.parseLong(args[3]);
        long unimproved = Long.parseLong(args[4]);
        int groups = Integer.parseInt(args[5]);
        long seedBase = Long.parseLong(args[6]);
        int atOnceGroups = args.length > 7 ? Integer.parseInt(args[7]) : 0;
        SeedCountBench bench = new SeedCountBench(problem, outDir, args[2], seconds, unimproved > 0 ? unimproved : null);
        bench.run(groups, seedBase, atOnceGroups);
    }

    private void run(int groups, long seedBase, int atOnceGroups) throws Exception {
        log("start " + label + " T=" + seconds + "s unimproved=" + unimprovedSec + " groups=" + groups + " atOnce=" + atOnceGroups);
        round("warmup", -1, 'w', seeds(seedBase + 90000, 4), Math.min(seconds, 10));
        for (int g = 0; g < groups; g++) {
            Round four = round("four", g, '-', seeds(seedBase + 4L * g, 4), seconds);
            group("four", g, four.result.best(), four.result.bestScore(), four.result.bestSeed(), four.result.seeds().size());
            long base8 = seedBase + 10000 + 8L * g;
            Round a = round("eight", g, 'a', seeds(base8, 4), seconds);
            Round b = round("eight", g, 'b', seeds(base8 + 4, 4), seconds);
            Round win = b.result.bestScore().compareTo(a.result.bestScore()) > 0 ? b : a;
            group("eight", g, win.result.best(), win.result.bestScore(), win.result.bestSeed(), 8);
            if (g < atOnceGroups) {
                Round x = round("atonce", g, '-', seeds(seedBase + 20000 + 8L * g, 8), seconds);
                group("atonce", g, x.result.best(), x.result.bestScore(), x.result.bestSeed(), 8);
            }
        }
        log("done " + label + " T=" + seconds);
    }

    private record Round(String kind, int group, char part, MultiStartSolver.Result result) {
    }

    private Round round(String kind, int group, char part, long[] seeds, long sec) throws Exception {
        double[] load = waitForQuiet();
        log("round-start " + kind + " g=" + group + part + " seeds=" + seeds[0] + ".." + seeds[seeds.length - 1]
                + String.format(Locale.ROOT, " load1=%.2f othersCpu=%.0f waited=%.0fs", load[0], load[1], load[2]));
        MultiStartSolver.Result r = new MultiStartSolver().run(this::problemFor, seeds, sec, unimprovedSec, NO_SINK);
        double[] after = loadNow();
        log("round-end " + kind + " g=" + group + part + " best=" + r.bestScore() + " elapsedMs=" + r.elapsedMs() + " reason=" + r.reason());
        if (!"warmup".equals(kind)) {
            append("rounds.tsv", "label\tseconds\tkind\tgroup\tpart\tseedCount\tbestSeed\tbestScore\telapsedMs\treason\tload1Before\tothersCpuBefore\twaitedSec\tload1After\tothersCpuAfter\tat",
                    String.join("\t", label, Long.toString(seconds), kind, Integer.toString(group), Character.toString(part),
                            Integer.toString(seeds.length), Long.toString(r.bestSeed()), r.bestScore().toString(),
                            Long.toString(r.elapsedMs()), r.reason(), fmt(load[0]), fmt(load[1]), fmt(load[2]),
                            fmt(after[0]), fmt(after[1]), Instant.now().toString()));
            for (MultiStartSolver.SeedResult s : r.seeds()) {
                append("seeds.tsv", "label\tseconds\tkind\tgroup\tpart\tseed\tscore\thardOk\tstuck\ttotalKm\tlastImprovementMs\telapsedMs\timprovementCount",
                        String.join("\t", label, Long.toString(seconds), kind, Integer.toString(group), Character.toString(part),
                                Long.toString(s.seed()), s.score().toString(), Boolean.toString(hardOk(s.score())),
                                Boolean.toString(stuck(s.score())), Long.toString(-s.score().softScore(4)),
                                Long.toString(s.lastImprovementMs()), Long.toString(s.elapsedMs()), Integer.toString(s.improvementCount())));
            }
        }
        return new Round(kind, group, part, r);
    }

    /** 묶음 결과: 고른 해의 화면 네 기준(이동 횟수 격차, 이동 거리 격차, 주말·공휴일 홈 격차, 전체 이동 거리). */
    private void group(String kind, int group, BaseballSolution best, BendableLongScore score, long bestSeed, int seedCount)
            throws IOException {
        ScoreFormulas.TeamTotals t = ScoreFormulas.computeTeamTotals(best.getTeamList(), best.getMatchList());
        JSONObject m = Metrics.of(best);
        append("groups.tsv", "label\tseconds\tkind\tgroup\tseedCount\tbestSeed\tscore\thardOk\tstuck\ttotalKm\tmoveGap\tdistanceGapKm\tholidayGap\tweekendHomeGap",
                String.join("\t", label, Long.toString(seconds), kind, Integer.toString(group), Integer.toString(seedCount),
                        Long.toString(bestSeed), score.toString(), Boolean.toString(hardOk(score)), Boolean.toString(stuck(score)),
                        String.valueOf(m.get("totalKm")), Long.toString(gap(t.moveCount)),
                        fmt(gap(t.distanceTenths) / 10.0), Long.toString(gap(t.holidayWeight)),
                        Long.toString((Long) m.get("weekendHomeMax") - (Long) m.get("weekendHomeMin"))));
    }

    /** JobManager.problemFor와 같다(SCRATCH): 고정한 시리즈는 그 자리에 두고 나머지를 시드로 새로 짠다. */
    private BaseballSolution problemFor(long seed) {
        BaseballSolution solution = ProblemCodec.toSolution(problem);
        ProblemCodec.applyPlan(solution, problem, null);
        BaseballSolutionInitializer.initialize(solution, seed);
        return solution;
    }

    /** soft0(미배정)~soft3(목적식 1~3순위 허용 차이 초과) 중 하나라도 남으면 갇힘. soft4는 전체 이동 거리. */
    static boolean stuck(BendableLongScore s) {
        for (int i = 0; i < 4; i++) {
            if (s.softScore(i) != 0) {
                return true;
            }
        }
        return false;
    }

    static boolean hardOk(BendableLongScore s) {
        return s.hardScore(0) == 0 && s.hardScore(1) == 0;
    }

    private static long gap(long[] v) {
        long min = Long.MAX_VALUE, max = Long.MIN_VALUE;
        for (long x : v) {
            min = Math.min(min, x);
            max = Math.max(max, x);
        }
        return max - min;
    }

    private static long[] seeds(long first, int n) {
        long[] out = new long[n];
        for (int i = 0; i < n; i++) {
            out[i] = first + i;
        }
        return out;
    }

    /** 다른 프로세스가 바쁘면 조금 기다린다. {load1, othersCpu%, waitedSec} */
    private static double[] waitForQuiet() throws InterruptedException {
        long t0 = System.currentTimeMillis();
        double[] now = loadNow();
        while (now[1] > BUSY_CPU_PERCENT && System.currentTimeMillis() - t0 < MAX_WAIT_SEC * 1000L) {
            Thread.sleep(15_000);
            now = loadNow();
        }
        return new double[] { now[0], now[1], (System.currentTimeMillis() - t0) / 1000.0 };
    }

    /** {1분 load average, 이 JVM 밖 프로세스들의 %CPU 합(ps)} */
    private static double[] loadNow() {
        double load1 = ManagementFactory.getOperatingSystemMXBean().getSystemLoadAverage();
        double others = 0;
        long self = ProcessHandle.current().pid();
        try {
            Process p = new ProcessBuilder("ps", "-A", "-o", "pid=,%cpu=").redirectErrorStream(true).start();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) {
                    String[] f = line.trim().split("\\s+");
                    if (f.length == 2 && Long.parseLong(f[0]) != self) {
                        others += Double.parseDouble(f[1]);
                    }
                }
            }
            p.waitFor();
        } catch (IOException | InterruptedException | NumberFormatException e) {
            others = -1;
        }
        return new double[] { load1, others };
    }

    private void append(String file, String header, String line) throws IOException {
        Path path = outDir.resolve(file);
        boolean fresh = !Files.exists(path);
        Files.writeString(path, (fresh ? header + "\n" : "") + line + "\n", StandardCharsets.UTF_8,
                StandardOpenOption.CREATE, StandardOpenOption.APPEND);
    }

    private static String fmt(double v) {
        return String.format(Locale.ROOT, "%.1f", v);
    }

    private static void log(String msg) {
        PrintStream out = System.out;
        out.println(">>> " + Instant.now() + " " + msg);
        out.flush();
    }

    private static final MultiStartSolver.Sink NO_SINK = new MultiStartSolver.Sink() {
        @Override
        public void seedBest(long seed, BendableLongScore score, long elapsedMs) {
        }

        @Override
        public void best(BaseballSolution solution, long seed, BendableLongScore score, long elapsedMs, int improvementCount) {
        }
    };
}
