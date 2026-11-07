package org.optaplanner.examples.baseball.web;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.LongFunction;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.core.api.solver.SolutionManager;
import org.optaplanner.core.api.solver.Solver;
import org.optaplanner.core.api.solver.SolverFactory;
import org.optaplanner.core.config.solver.SolverConfig;
import org.optaplanner.core.impl.phase.event.PhaseLifecycleListenerAdapter;
import org.optaplanner.core.impl.phase.scope.AbstractPhaseScope;
import org.optaplanner.core.impl.phase.scope.AbstractStepScope;
import org.optaplanner.core.impl.solver.DefaultSolver;
import org.optaplanner.examples.baseball.bench.BenchSupport;
import org.optaplanner.examples.baseball.bench.SolveTrace;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 멀티스타트: 시드마다 단일스레드 솔버를 병렬로 돌리고 점수가 가장 높은 해를 고른다.
 * 근거는 docs/ENGINE_SEED_BENCHMARK.md (단일 실행은 20시드 중 12개가 갇히고, best-of-4는 5묶음 중 1개).
 * 시드마다 step 수로 멈추므로({@link StopRule}) 같은 입력·같은 시드 목록이면 컴퓨터 속도와 상관없이 같은 해가 나온다.
 * 점수가 같으면 시드 목록에서 앞선 시드를 고른다.
 * 끝난 까닭(reason): CALC_LIMIT(정한 계산 수), UNIMPROVED(75% 뒤 개선 없음), TIME_LIMIT(고른 시간 — 이때는 재현을 보장하지 않음), STOPPED.
 */
final class MultiStartSolver {

    private static final Logger LOG = LoggerFactory.getLogger(MultiStartSolver.class);

    /** 진행 알림. 모든 호출은 솔버 스레드에서 온다. */
    interface Sink {
        void seedBest(long seed, BendableLongScore score, long elapsedMs);

        void best(BaseballSolution solution, long seed, BendableLongScore score, long elapsedMs, int improvementCount);
    }

    record SeedResult(long seed, BendableLongScore initialScore, BendableLongScore score, long elapsedMs,
            long lastImprovementMs, int improvementCount, long steps, long calcCount, String reason) {
    }

    record Result(BaseballSolution best, long bestSeed, BendableLongScore bestScore, SolveTrace bestTrace,
            List<SeedResult> seeds, String reason, long elapsedMs) {
    }

    private final List<Solver<BaseballSolution>> solvers = new ArrayList<>();
    private volatile boolean stopRequested;

    /**
     * @param problemForSeed 시드마다 새 문제 인스턴스를 만든다(솔버가 해를 바꾸므로 공유하면 안 된다).
     * @param stop step 기준 종료와 안전장치 시간
     */
    Result run(LongFunction<BaseballSolution> problemForSeed, long[] seeds, StopRule stop, Sink sink)
            throws InterruptedException {
        long start = System.currentTimeMillis();
        ExecutorService pool = Executors.newFixedThreadPool(seeds.length, r -> {
            Thread t = new Thread(r, "kbo-solver");
            t.setDaemon(true);
            return t;
        });
        Object lock = new Object();
        BendableLongScore[] globalBest = new BendableLongScore[1];
        List<Future<SeedRun>> futures = new ArrayList<>();
        try {
            for (long seed : seeds) {
                futures.add(pool.submit(() -> runOne(seed, problemForSeed, stop, sink, lock,
                        globalBest, start)));
            }
            List<SeedRun> runs = new ArrayList<>();
            Throwable firstFailure = null;
            for (Future<SeedRun> f : futures) {
                try {
                    runs.add(f.get());
                } catch (java.util.concurrent.ExecutionException e) {
                    if (firstFailure == null) {
                        firstFailure = e.getCause();
                        LOG.warn("seed run failed", firstFailure);
                    }
                }
            }
            if (runs.isEmpty()) {
                String why = firstFailure == null ? "" : firstFailure.getMessage();
                throw new IllegalStateException("편성을 시작할 수 없습니다" + (why == null || why.isBlank() ? "" : ": " + why), firstFailure);
            }
            SeedRun best = runs.get(0);
            for (SeedRun r : runs) {
                if (r.score.compareTo(best.score) > 0) {
                    best = r;
                }
            }
            List<SeedResult> results = new ArrayList<>();
            for (SeedRun r : runs) {
                results.add(new SeedResult(r.seed, r.initialScore, r.score, r.elapsedMs, r.lastImprovementMs,
                        r.improvementCount, r.steps, r.calcCount, r.reason));
            }
            long elapsed = System.currentTimeMillis() - start;
            String reason = stopRequested ? "STOPPED" : overallReason(runs);
            return new Result(best.solution, best.seed, best.score, best.trace, results, reason, elapsed);
        } finally {
            pool.shutdownNow();
            pool.awaitTermination(5, TimeUnit.SECONDS);
        }
    }

    /** 시드 하나라도 시간에 걸렸으면 TIME_LIMIT(재현 보장 없음), 아니면 계산 수를 다 채운 시드가 있으면 CALC_LIMIT. */
    private static String overallReason(List<SeedRun> runs) {
        boolean calcLimit = false;
        for (SeedRun r : runs) {
            if ("TIME_LIMIT".equals(r.reason)) {
                return "TIME_LIMIT";
            }
            calcLimit |= "CALC_LIMIT".equals(r.reason);
        }
        return calcLimit ? "CALC_LIMIT" : "UNIMPROVED";
    }

    void stop() {
        stopRequested = true;
        synchronized (solvers) {
            for (Solver<BaseballSolution> s : solvers) {
                s.terminateEarly();
            }
        }
    }

    private record SeedRun(long seed, BaseballSolution solution, BendableLongScore initialScore, BendableLongScore score,
            SolveTrace trace, long elapsedMs, long lastImprovementMs, int improvementCount, long steps, long calcCount,
            String reason) {
    }

    private SeedRun runOne(long seed, LongFunction<BaseballSolution> problemForSeed, StopRule stop,
            Sink sink, Object lock, BendableLongScore[] globalBest, long start) {
        BaseballSolution problem = problemForSeed.apply(seed);
        SolverConfig config = BenchSupport.withWorkLimits(BenchSupport.solverConfig(seed, stop.timeSec(), "NONE", null, null),
                stop.calcLimit(), stop.unimprovedStepsOrNull());
        SolverFactory<BaseballSolution> factory = SolverFactory.create(config);
        BendableLongScore initialScore = (BendableLongScore) SolutionManager.create(factory).update(problem);
        SolveTrace trace = new SolveTrace(problem, seed, initialScore);
        Solver<BaseballSolution> solver = factory.buildSolver();
        long[] lastImprovement = {0L};
        int[] improvements = {0};
        long[] steps = {0L};
        long[] calcs = {0L};
        ((DefaultSolver<BaseballSolution>) solver).addPhaseLifecycleListener(new PhaseLifecycleListenerAdapter<>() {
            @Override
            public void stepEnded(AbstractStepScope<BaseballSolution> stepScope) {
                steps[0] = stepScope.getStepIndex() + 1L;
            }

            @Override
            public void phaseEnded(AbstractPhaseScope<BaseballSolution> phaseScope) {
                calcs[0] = phaseScope.getScoreDirector().getCalculationCount();
            }
        });
        solver.addEventListener(trace);
        solver.addEventListener(event -> {
            BendableLongScore score = (BendableLongScore) event.getNewBestScore();
            long elapsed = System.currentTimeMillis() - start;
            lastImprovement[0] = elapsed;
            improvements[0]++;
            sink.seedBest(seed, score, elapsed);
            // 비교와 보내기를 한 잠금 안에서: 밖에서 보내면 두 시드가 엇갈려 더 나쁜 결과가 나중에 나갈 수 있다
            synchronized (lock) {
                if (globalBest[0] == null || score.compareTo(globalBest[0]) > 0) {
                    globalBest[0] = score;
                    sink.best(event.getNewBestSolution(), seed, score, elapsed, improvements[0]);
                }
            }
        });
        synchronized (solvers) {
            if (stopRequested) {
                return new SeedRun(seed, problem, initialScore, initialScore, trace, 0L, 0L, 0, 0L, 0L, "STOPPED");
            }
            solvers.add(solver);
        }
        long t0 = System.currentTimeMillis();
        BaseballSolution solved = solver.solve(problem);
        long solveMs = System.currentTimeMillis() - t0;
        String reason = stopRequested ? "STOPPED"
                : calcs[0] >= stop.calcLimit() ? "CALC_LIMIT"
                : solveMs >= stop.timeSec() * 1000L - 250L ? "TIME_LIMIT" : "UNIMPROVED";
        if ("TIME_LIMIT".equals(reason)) {
            LOG.warn("seed {} hit the {}s time limit after {} of {} calculations; this run is not reproducible", seed,
                    stop.timeSec(), calcs[0], stop.calcLimit());
        }
        BendableLongScore score = solved.getBendableLongScore();
        synchronized (lock) {
            if (globalBest[0] == null || score.compareTo(globalBest[0]) > 0) {
                globalBest[0] = score;
                sink.best(solved, seed, score, System.currentTimeMillis() - start, improvements[0]);
            }
        }
        return new SeedRun(seed, solved, initialScore, score, trace, solveMs, lastImprovement[0], improvements[0], steps[0],
                calcs[0], reason);
    }
}
