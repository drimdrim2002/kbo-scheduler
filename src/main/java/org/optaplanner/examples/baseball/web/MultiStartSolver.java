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
import org.optaplanner.examples.baseball.bench.BenchSupport;
import org.optaplanner.examples.baseball.bench.SolveTrace;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.reschedule.RescheduleSolution;
import org.optaplanner.examples.baseball.reschedule.RescheduleSolverRunner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 멀티스타트: 시드마다 단일스레드 솔버를 병렬로 돌리고 점수가 가장 높은 해를 고른다.
 * 근거는 docs/ENGINE_SEED_BENCHMARK.md (단일 실행은 20시드 중 12개가 갇히고, best-of-4는 5묶음 중 1개).
 * 1차 편성({@link #baseball()})과 날짜 단위 재편성({@link #reschedule()})이 함께 쓴다. 다른 점은 {@link Engine}에 있다.
 */
final class MultiStartSolver<S> {

    /** 해 종류마다 다른 것: 솔버 설정, 해의 점수, 재생 기록(없으면 null). */
    interface Engine<S> {
        SolverConfig config(long seed, long timeLimitSec);

        BendableLongScore scoreOf(S solution);

        SolveTrace trace(S problem, long seed, BendableLongScore initialScore);
    }

    static final Engine<BaseballSolution> BASEBALL = new Engine<>() {
        @Override
        public SolverConfig config(long seed, long timeLimitSec) {
            return BenchSupport.solverConfig(seed, timeLimitSec, "NONE", null, null);
        }

        @Override
        public BendableLongScore scoreOf(BaseballSolution solution) {
            return solution.getBendableLongScore();
        }

        @Override
        public SolveTrace trace(BaseballSolution problem, long seed, BendableLongScore initialScore) {
            return new SolveTrace(problem, seed, initialScore);
        }
    };

    static final Engine<RescheduleSolution> RESCHEDULE = new Engine<>() {
        @Override
        public SolverConfig config(long seed, long timeLimitSec) {
            return RescheduleSolverRunner.config(seed, timeLimitSec, null);
        }

        @Override
        public BendableLongScore scoreOf(RescheduleSolution solution) {
            return solution.getScore();
        }

        @Override
        public SolveTrace trace(RescheduleSolution problem, long seed, BendableLongScore initialScore) {
            return null;
        }
    };

    static MultiStartSolver<BaseballSolution> baseball() {
        return new MultiStartSolver<>(BASEBALL);
    }

    static MultiStartSolver<RescheduleSolution> reschedule() {
        return new MultiStartSolver<>(RESCHEDULE);
    }

    private final Engine<S> engine;

    MultiStartSolver(Engine<S> engine) {
        this.engine = engine;
    }

    private static final Logger LOG = LoggerFactory.getLogger(MultiStartSolver.class);

    /** 진행 알림. 모든 호출은 솔버 스레드에서 온다. */
    interface Sink<S> {
        void seedBest(long seed, BendableLongScore score, long elapsedMs);

        void best(S solution, long seed, BendableLongScore score, long elapsedMs, int improvementCount);
    }

    record SeedResult(long seed, BendableLongScore initialScore, BendableLongScore score, long elapsedMs,
            long lastImprovementMs, int improvementCount) {
    }

    record Result<S>(S best, long bestSeed, BendableLongScore bestScore, SolveTrace bestTrace,
            List<SeedResult> seeds, String reason, long elapsedMs) {
    }

    private final List<Solver<S>> solvers = new ArrayList<>();
    private volatile boolean stopRequested;

    /**
     * @param problemForSeed 시드마다 새 문제 인스턴스를 만든다(솔버가 해를 바꾸므로 공유하면 안 된다).
     * @param unimprovedSec null이면 개선 없음 종료를 쓰지 않는다
     */
    Result<S> run(LongFunction<S> problemForSeed, long[] seeds, long timeLimitSec, Long unimprovedSec,
            Sink<S> sink) throws InterruptedException {
        long start = System.currentTimeMillis();
        ExecutorService pool = Executors.newFixedThreadPool(seeds.length, r -> {
            Thread t = new Thread(r, "kbo-solver");
            t.setDaemon(true);
            return t;
        });
        Object lock = new Object();
        BendableLongScore[] globalBest = new BendableLongScore[1];
        List<Future<SeedRun<S>>> futures = new ArrayList<>();
        try {
            for (long seed : seeds) {
                futures.add(pool.submit(() -> runOne(seed, problemForSeed, timeLimitSec, unimprovedSec, sink, lock,
                        globalBest, start)));
            }
            List<SeedRun<S>> runs = new ArrayList<>();
            Throwable firstFailure = null;
            for (Future<SeedRun<S>> f : futures) {
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
            SeedRun<S> best = runs.get(0);
            for (SeedRun<S> r : runs) {
                if (r.score.compareTo(best.score) > 0) {
                    best = r;
                }
            }
            List<SeedResult> results = new ArrayList<>();
            for (SeedRun<S> r : runs) {
                results.add(new SeedResult(r.seed, r.initialScore, r.score, r.elapsedMs, r.lastImprovementMs,
                        r.improvementCount));
            }
            long elapsed = System.currentTimeMillis() - start;
            String reason = stopRequested ? "STOPPED" : elapsed < timeLimitSec * 1000L - 500L ? "UNIMPROVED" : "TIME_LIMIT";
            return new Result<>(best.solution, best.seed, best.score, best.trace, results, reason, elapsed);
        } finally {
            pool.shutdownNow();
            pool.awaitTermination(5, TimeUnit.SECONDS);
        }
    }

    void stop() {
        stopRequested = true;
        synchronized (solvers) {
            for (Solver<S> s : solvers) {
                s.terminateEarly();
            }
        }
    }

    private record SeedRun<S>(long seed, S solution, BendableLongScore initialScore, BendableLongScore score,
            SolveTrace trace, long elapsedMs, long lastImprovementMs, int improvementCount) {
    }

    private SeedRun<S> runOne(long seed, LongFunction<S> problemForSeed, long timeLimitSec, Long unimprovedSec,
            Sink<S> sink, Object lock, BendableLongScore[] globalBest, long start) {
        S problem = problemForSeed.apply(seed);
        SolverConfig config = engine.config(seed, timeLimitSec);
        if (unimprovedSec != null && unimprovedSec > 0) {
            config.getTerminationConfig().setUnimprovedSecondsSpentLimit(unimprovedSec);
        }
        SolverFactory<S> factory = SolverFactory.create(config);
        BendableLongScore initialScore = (BendableLongScore) SolutionManager.create(factory).update(problem);
        SolveTrace trace = engine.trace(problem, seed, initialScore);
        Solver<S> solver = factory.buildSolver();
        long[] lastImprovement = {0L};
        int[] improvements = {0};
        if (trace != null) {
            @SuppressWarnings("unchecked")
            org.optaplanner.core.api.solver.event.SolverEventListener<S> listener =
                    (org.optaplanner.core.api.solver.event.SolverEventListener<S>) (Object) trace;
            solver.addEventListener(listener);
        }
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
                return new SeedRun<>(seed, problem, initialScore, initialScore, trace, 0L, 0L, 0);
            }
            solvers.add(solver);
        }
        long t0 = System.currentTimeMillis();
        S solved = solver.solve(problem);
        BendableLongScore score = engine.scoreOf(solved);
        synchronized (lock) {
            if (globalBest[0] == null || score.compareTo(globalBest[0]) > 0) {
                globalBest[0] = score;
                sink.best(solved, seed, score, System.currentTimeMillis() - start, improvements[0]);
            }
        }
        return new SeedRun<>(seed, solved, initialScore, score, trace, System.currentTimeMillis() - t0, lastImprovement[0],
                improvements[0]);
    }
}
