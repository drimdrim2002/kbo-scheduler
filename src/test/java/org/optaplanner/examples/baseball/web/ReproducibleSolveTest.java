package org.optaplanner.examples.baseball.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.bench.BenchSupport;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Constants;

/**
 * 같은 입력·같은 시드·같은 계산 수면 같은 일정이 나와야 한다. 한 번은 혼자, 한 번은 다른 편성과 CPU를 나눠 쓰며(그래서 더 느리게)
 * 돌려 속도가 달라도 결과가 같은지 본다. 시간 제한은 넉넉히(600초) 두어 계산 수로 멈추게 한다.
 */
class ReproducibleSolveTest {

    private static final long[] SEEDS = {5L, 6L};
    private static final StopRule STOP = new StopRule(60_000, 30, 600);

    @Test
    void sameSeedsAndCalculationsGiveTheSamePlanAtAnySpeed() throws Exception {
        MultiStartSolver.Result alone = solve(SEEDS, STOP);

        ExecutorService noise = Executors.newFixedThreadPool(1);
        MultiStartSolver.Result loaded;
        try {
            Future<?> busy = noise.submit(() -> solve(new long[] {101L, 102L, 103L, 104L}, STOP));
            loaded = solve(SEEDS, STOP);
            busy.get();
        } finally {
            noise.shutdownNow();
        }

        assertTrue(!"TIME_LIMIT".equals(alone.reason()) && !"TIME_LIMIT".equals(loaded.reason()),
                alone.reason() + " / " + loaded.reason());
        assertEquals(alone.bestSeed(), loaded.bestSeed());
        assertEquals(alone.bestScore(), loaded.bestScore());
        assertEquals(ProblemCodec.planJson(alone.best()).toJSONString(), ProblemCodec.planJson(loaded.best()).toJSONString());
        for (int i = 0; i < SEEDS.length; i++) {
            assertEquals(alone.seeds().get(i).calcCount(), loaded.seeds().get(i).calcCount(), "calcs of seed " + SEEDS[i]);
            assertEquals(alone.seeds().get(i).steps(), loaded.seeds().get(i).steps(), "steps of seed " + SEEDS[i]);
            assertEquals(alone.seeds().get(i).score(), loaded.seeds().get(i).score(), "score of seed " + SEEDS[i]);
        }
    }

    /** 개선이 금방 멈춰도 계산 수의 75%는 채운다. 개선 없는 step을 아주 짧게(5) 줘서 일부러 일찍 멈추게 해 본다. */
    @Test
    void noImprovementStopWaitsUntilThreeQuartersOfTheCalculations() throws Exception {
        StopRule stop = new StopRule(80_000, 5, 600);
        MultiStartSolver.Result r = solve(new long[] {108L, 116L}, stop);
        assertEquals(60_000L, stop.minCalcs());
        for (MultiStartSolver.SeedResult s : r.seeds()) {
            assertTrue(s.calcCount() >= 60_000 && s.calcCount() <= 80_000, "seed " + s.seed() + " did " + s.calcCount());
        }
        assertTrue(r.seeds().stream().anyMatch(s -> "UNIMPROVED".equals(s.reason()) && s.calcCount() < 80_000),
                "at least one seed should stop on no improvement between 75% and 100%");
    }

    /** 계산 수를 다 못 채워도 고른 시간이 지나면 멈춘다(OR). 고른 시간은 첫 일정을 만드는 시간까지 포함한다. */
    @Test
    void timeLimitStillEndsTheRunAndIncludesSetup() throws Exception {
        solve(new long[] {7L}, new StopRule(1_000, 0, 60)); // 예열: 처음 한 번은 준비가 느리다
        long start = System.currentTimeMillis();
        MultiStartSolver.Result r = solve(new long[] {7L, 8L}, new StopRule(1_000_000_000L, 0, 4));
        long ms = System.currentTimeMillis() - start;
        assertEquals("TIME_LIMIT", r.reason());
        assertTrue(ms < 4_000 + 1_000, "took " + ms + "ms for a 4-second run");
        for (MultiStartSolver.SeedResult s : r.seeds()) {
            assertTrue(s.elapsedMs() < 4_000, "seed " + s.seed() + " searched " + s.elapsedMs() + "ms");
        }
    }

    /** 서버 요청 길(JobManager → 문제 변환 → 초기해 또는 보낸 일정에서 이어 풀기)로도 같은 일정이 나온다. 서로 저장소를 나누지 않는 두 관리자로 돌린다. */
    @Test
    void sameRequestGivesTheSamePlanThroughTheServerPath() throws Exception {
        JSONObject problem = BaseballApp.readJsonFile(Constants.inputFileName);
        JSONObject scratch = Json.obj("seed", 11L, "seeds", 2L, "init", "SCRATCH", "timeLimitSec", 60L,
                "calcLimit", 60_000L, "unimprovedSteps", 30L);
        JSONObject first = solveThroughServer(problem, scratch);
        JSONObject second = solveThroughServer(problem, scratch);
        assertTrue(!"TIME_LIMIT".equals(first.get("reason")) && !"TIME_LIMIT".equals(second.get("reason")));
        assertEquals(first.get("plan").toString(), second.get("plan").toString());
        assertEquals(first.get("scoreString"), second.get("scoreString"));

        JSONObject withPlan = (JSONObject) problem.clone();
        withPlan.put("plan", first.get("plan"));
        JSONObject keep = Json.obj("seed", 21L, "seeds", 2L, "init", "KEEP", "timeLimitSec", 60L,
                "calcLimit", 60_000L, "unimprovedSteps", 30L);
        JSONObject a = solveThroughServer(withPlan, keep);
        JSONObject b = solveThroughServer(withPlan, keep);
        assertEquals(a.get("plan").toString(), b.get("plan").toString());
        assertEquals(a.get("scoreString"), b.get("scoreString"));
    }

    @Test
    void secondsBecomeCalculations() {
        StopRule twoMinutes = StopRule.fromSeconds(120, 60L);
        assertEquals((120 - StopRule.SETUP_ESTIMATE_SEC) * BenchSupport.CALCS_PER_SECOND, twoMinutes.calcLimit());
        assertEquals(5 * BenchSupport.CALCS_PER_SECOND, StopRule.fromSeconds(10, null).calcLimit());
        assertEquals(2 * BenchSupport.CALCS_PER_SECOND, StopRule.fromSeconds(4, null).calcLimit());
        assertEquals(1 * BenchSupport.CALCS_PER_SECOND, StopRule.fromSeconds(1, null).calcLimit());
        assertEquals(60 * BenchSupport.STEPS_PER_SECOND, twoMinutes.unimprovedSteps());
        assertEquals(120, twoMinutes.timeSec());
    }

    private static JSONObject solveThroughServer(JSONObject problem, JSONObject options) throws Exception {
        List<Runnable> runner = new ArrayList<>();
        JobManager jobs = new JobManager(ServerLimits.defaults(), null, runner::add);
        SolveJob job = jobs.submit(problem, SolveOptions.from(options, ServerLimits.defaults()), "198.51.100.20");
        runner.forEach(Runnable::run);
        JSONObject done = Json.object(job.statusJson().get("done"));
        assertTrue(done != null && done.get("plan") instanceof JSONArray plan && !plan.isEmpty(), String.valueOf(job.statusJson()));
        return done;
    }

    private static MultiStartSolver.Result solve(long[] seeds, StopRule stop) throws InterruptedException {
        return new MultiStartSolver().run(BenchSupport::initializedProblem, seeds, stop, NO_SINK);
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
