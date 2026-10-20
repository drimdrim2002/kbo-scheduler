package org.optaplanner.examples.baseball.web;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.ParseException;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.examples.baseball.bench.SolveTrace;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.solver.BaseballSolutionInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 작업 큐(한 번에 하나: 한 작업이 코어를 모두 쓴다), 결과 캐시(같은 문제·옵션이면 같은 결과), IP당 동시 작업 제한.
 */
final class JobManager {

    private static final Logger LOG = LoggerFactory.getLogger(JobManager.class);

    private final ServerLimits limits;
    private final ExecutorService runner = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "kbo-job-runner");
        t.setDaemon(true);
        return t;
    });
    private final Map<String, SolveJob> jobs = new ConcurrentHashMap<>();
    private final Deque<SolveJob> queue = new ArrayDeque<>();
    private final Map<String, JSONObject> cache;
    private final Map<String, Integer> activePerIp = new HashMap<>();
    private final ResultStore store;

    JobManager(ServerLimits limits, ResultStore store) {
        this.limits = limits;
        this.store = store;
        this.cache = new LinkedHashMap<>(64, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, JSONObject> eldest) {
                return size() > limits.cacheSize();
            }
        };
    }

    static final class RejectedException extends RuntimeException {
        final int httpStatus;

        RejectedException(int httpStatus, String message) {
            super(message);
            this.httpStatus = httpStatus;
        }
    }

    SolveJob get(String id) {
        return jobs.get(id);
    }

    synchronized int queueLength() {
        return queue.size();
    }

    /** 작업을 만든다. 캐시에 있으면 바로 DONE 상태로 돌려준다. */
    SolveJob submit(JSONObject problem, SolveOptions options, String clientIp) {
        if (!"INITIAL".equals(options.mode())) {
            throw new RejectedException(400, "이번 버전은 mode=INITIAL만 지원합니다.");
        }
        // 문제를 먼저 변환해 본다: 형식 오류는 큐에 넣기 전에 400으로 돌려준다.
        BaseballSolution probe = ProblemCodec.toSolution(problem);
        boolean fullPlan = ProblemCodec.applyPlan(probe, problem, null);
        String cacheKey = cacheKey(problem, options, fullPlan);
        String id = UUID.randomUUID().toString().substring(0, 8);
        SolveJob job = new SolveJob(id, cacheKey, clientIp, problem, options);
        JSONObject cached;
        synchronized (this) {
            cached = cache.get(cacheKey);
        }
        if (cached == null && store != null) {
            cached = store.load(resultId(cacheKey)).orElse(null);
        }
        if (cached != null) {
            jobs.put(id, job);
            job.running();
            JSONObject payload = (JSONObject) cached.clone();
            payload.put("jobId", id);
            payload.put("cached", Boolean.TRUE);
            job.done(payload, false);
            return job;
        }
        synchronized (this) {
            int active = activePerIp.getOrDefault(clientIp, 0);
            if (active >= limits.maxJobsPerIp()) {
                throw new RejectedException(429, "이미 실행 중인 편성이 있습니다. 끝난 뒤 다시 시도하세요.");
            }
            activePerIp.put(clientIp, active + 1);
            jobs.put(id, job);
            queue.addLast(job);
            renumber();
        }
        runner.submit(() -> run(job));
        return job;
    }

    void stop(SolveJob job) {
        job.stopRequested = true;
        MultiStartSolver s = job.solver;
        if (s != null) {
            s.stop();
        }
    }

    private synchronized void renumber() {
        int i = 1;
        for (SolveJob j : queue) {
            j.queued(i++);
        }
    }

    private void run(SolveJob job) {
        synchronized (this) {
            queue.remove(job);
            renumber();
        }
        try {
            if (job.stopRequested) {
                job.done(Json.obj("jobId", job.id, "reason", "STOPPED", "score", null, "plan", new JSONArray()), true);
                return;
            }
            job.running();
            long start = System.currentTimeMillis();
            MultiStartSolver solver = new MultiStartSolver();
            job.solver = solver;
            MultiStartSolver.Sink sink = new MultiStartSolver.Sink() {
                @Override
                public void seedBest(long seed, BendableLongScore score, long elapsedMs) {
                    job.seedBest(Json.obj("jobId", job.id, "seed", seed, "score", Json.score(score),
                            "scoreString", score.toString(), "elapsedMs", elapsedMs));
                }

                @Override
                public void best(BaseballSolution solution, long seed, BendableLongScore score, long elapsedMs,
                        int improvementCount) {
                    job.best(Json.obj("jobId", job.id, "plan", ProblemCodec.planJson(solution), "score", Json.score(score),
                            "scoreString", score.toString(), "elapsedMs", elapsedMs, "improvementCount", (long) improvementCount,
                            "seed", seed));
                }
            };
            MultiStartSolver.Result result = solver.run(seed -> problemFor(job, seed), job.options.seedList(),
                    job.options.timeLimitSec(), job.options.unimprovedSec(), sink);
            JSONObject payload = donePayload(job, result);
            if (!"STOPPED".equals(result.reason())) {
                String id = resultId(job.cacheKey);
                payload.put("id", id);
                payload.put("createdAt", java.time.Instant.now().toString());
                payload.put("knobs", knobsWithDefaults(job.problem));
                payload.put("title", titleOf(job.problem, result.bestSeed()));
                payload.put("metrics", Metrics.of(result.best()));
                JSONObject forCache = (JSONObject) payload.clone();
                forCache.remove("jobId");
                synchronized (this) {
                    cache.put(job.cacheKey, forCache);
                }
                if (store != null) {
                    store.save(id, forCache);
                }
                java.util.function.Consumer<JSONObject> hook = job.onDone;
                if (hook != null) {
                    try {
                        hook.accept(forCache);
                    } catch (RuntimeException e) {
                        LOG.warn("onDone hook failed", e);
                    }
                }
            }
            job.done(payload, "STOPPED".equals(result.reason()));
            LOG.info("job {} {} {} in {}ms (seeds={}, {}s)", job.id, result.reason(), result.bestScore(),
                    System.currentTimeMillis() - start, job.options.seeds(), job.options.timeLimitSec());
        } catch (Exception e) {
            LOG.error("job {} failed", job.id, e);
            job.error(e.getMessage() == null ? e.toString() : e.getMessage());
        } finally {
            job.solver = null;
            synchronized (this) {
                int active = activePerIp.getOrDefault(job.clientIp, 0);
                if (active <= 1) {
                    activePerIp.remove(job.clientIp);
                } else {
                    activePerIp.put(job.clientIp, active - 1);
                }
            }
        }
    }

    /** 시드마다 새 문제 인스턴스. KEEP이면 보낸 plan에서, 아니면 초기해 생성기로 시작한다. */
    private BaseballSolution problemFor(SolveJob job, long seed) {
        BaseballSolution solution = ProblemCodec.toSolution(job.problem);
        boolean fullPlan = ProblemCodec.applyPlan(solution, job.problem, null);
        if ("SCRATCH".equals(job.options.init()) || !fullPlan) {
            BaseballSolutionInitializer.initialize(solution, seed);
        }
        return solution;
    }

    private static JSONObject donePayload(SolveJob job, MultiStartSolver.Result result) throws ParseException {
        JSONArray seeds = new JSONArray();
        for (MultiStartSolver.SeedResult s : result.seeds()) {
            seeds.add(Json.obj("seed", s.seed(), "score", Json.score(s.score()), "scoreString", s.score().toString(),
                    "initialScore", Json.score(s.initialScore()), "elapsedMs", s.elapsedMs(),
                    "lastImprovementMs", s.lastImprovementMs(), "improvementCount", (long) s.improvementCount()));
        }
        SolveTrace trace = result.bestTrace();
        JSONObject payload = Json.obj("jobId", job.id, "reason", result.reason(), "plan", ProblemCodec.planJson(result.best()),
                "score", Json.score(result.bestScore()), "scoreString", result.bestScore().toString(),
                "elapsedMs", result.elapsedMs(), "seed", result.bestSeed(), "seedResults", seeds,
                "options", job.options.toJson(), "improvementCount", (long) (trace == null ? 0 : trace.eventCount()));
        if (trace != null) {
            payload.put("trace", Json.parse(trace.toJson()));
        }
        return payload;
    }

    /** 공유 링크 id: 캐시 키 앞 12자리. */
    static String resultId(String cacheKey) {
        return cacheKey.substring(0, 12);
    }

    @SuppressWarnings("unchecked")
    static JSONObject knobsWithDefaults(JSONObject problem) {
        JSONObject k = ProblemCodec.knobs(problem);
        JSONObject out = Json.obj("distanceToleranceKm", 300.0, "holidayTolerance", ProblemCodec.WEB_DEFAULT_HOLIDAY_TOLERANCE, "moveTolerance", 2.0,
                "childrenDayHomeTeams", Json.arr(java.util.List.of("두산", "키움", "한화", "NC", "롯데")),
                "unavailableHomeSlots", new JSONArray());
        if (k.get("distanceToleranceKm") != null) {
            out.put("distanceToleranceKm", Json.asDouble(k.get("distanceToleranceKm"), 300.0));
        }
        if (k.get("holidayTolerance") != null) {
            out.put("holidayTolerance", Json.asDouble(k.get("holidayTolerance"), ProblemCodec.WEB_DEFAULT_HOLIDAY_TOLERANCE));
        }
        if (k.get("moveTolerance") != null) {
            out.put("moveTolerance", Json.asDouble(k.get("moveTolerance"), 2.0));
        }
        if (k.get("obligationTeams") != null) {
            out.put("childrenDayHomeTeams", k.get("obligationTeams"));
        }
        return out;
    }

    static String titleOf(JSONObject problem, long seed) {
        JSONObject k = knobsWithDefaults(problem);
        StringBuilder teams = new StringBuilder();
        for (Object t : Json.array(k.get("childrenDayHomeTeams"))) {
            if (teams.length() > 0) {
                teams.append('·');
            }
            teams.append(t);
        }
        double km = Json.asDouble(k.get("distanceToleranceKm"), 300.0);
        // 일상어 제목. ui/show/show.js tolWord와 같은 구간
        String word = km <= 150 ? "이동거리 거의 똑같게" : km <= 450 ? "이동거리 비슷하게" : "이동거리 달라도 괜찮게";
        return word + " · 어린이날 홈 " + teams + " · 시드 " + seed;
    }

    private static String cacheKey(JSONObject problem, SolveOptions options, boolean fullPlan) {
        JSONObject key = ProblemCodec.engineInput(problem);
        if (fullPlan && "KEEP".equals(options.init())) {
            key.put("plan", problem.get("plan"));
            JSONArray pins = new JSONArray();
            JSONArray matches = Json.array(problem.get("matches"));
            if (matches != null) {
                for (Object m : matches) {
                    JSONObject src = Json.object(m);
                    pins.add(src != null && Json.asBool(src.get("pinned"), false));
                }
            }
            key.put("pinned", pins);
        }
        key.put("options", options.toJson());
        // 기본값이 바뀌어도 다른 키가 되도록, 명시된 값이 아니라 실제 적용되는 값을 넣는다
        key.put("knobs", knobsWithDefaults(problem));
        return sha256(Json.canonical(key));
    }

    private static String sha256(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
