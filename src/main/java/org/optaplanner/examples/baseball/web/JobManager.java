package org.optaplanner.examples.baseball.web;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
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
 * 대기 중인데 아무도 지켜보지 않는 작업(탭 닫기·연결 끊김)은 차례가 오기 전에 빼서 뒷사람의 대기를 줄인다.
 */
final class JobManager {

    private static final Logger LOG = LoggerFactory.getLogger(JobManager.class);
    /** 대기 중 작업을 이만큼 아무도 지켜보지 않으면 뺀다. POST 뒤 SSE를 여는 틈보다 넉넉하게. */
    static final long ABANDON_MS = 10_000;
    /** 같은 주소에서 다시 눌렀을 때는 이만큼만 지나도 앞 작업을 버린 것으로 본다(끊김 → 다시 누름). */
    static final long RETRY_ABANDON_MS = 1_000;
    /** 끝난 작업은 이만큼 들고 있다가 잊는다(결과는 캐시·ResultStore에 남는다). */
    static final long KEEP_FINISHED_MS = 10 * 60_000;

    private final ServerLimits limits;
    private final Executor runner;
    private final Map<String, SolveJob> jobs = new ConcurrentHashMap<>();
    /** 대기 줄. 실행 순서도 이 줄을 따른다(runNext가 맨 앞을 꺼낸다). */
    private final List<SolveJob> queue = new ArrayList<>();
    private final Map<String, JSONObject> cache;
    private final Map<String, Integer> activePerIp = new HashMap<>();
    private final ResultStore store;

    JobManager(ServerLimits limits, ResultStore store) {
        this(limits, store, Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "kbo-job-runner");
            t.setDaemon(true);
            return t;
        }));
    }

    /** 테스트는 작업을 실제로 돌리지 않는 runner를 넣는다. */
    JobManager(ServerLimits limits, ResultStore store, Executor runner) {
        this.limits = limits;
        this.store = store;
        this.runner = runner;
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

    /** 5초마다 sweep을 돈다(서버에서만 켠다). */
    void startSweeper() {
        ScheduledExecutorService s = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "kbo-job-sweeper");
            t.setDaemon(true);
            return t;
        });
        s.scheduleWithFixedDelay(() -> {
            try {
                sweep(System.currentTimeMillis());
            } catch (RuntimeException e) {
                LOG.warn("sweep failed", e);
            }
        }, 5, 5, TimeUnit.SECONDS);
    }

    /** 아무도 지켜보지 않는 대기 작업을 빼고, 끝난 지 오래된 작업을 잊는다. */
    void sweep(long now) {
        synchronized (this) {
            for (SolveJob j : List.copyOf(queue)) {
                if (j.unwatchedFor(now, ABANDON_MS)) {
                    cancelQueued(j, "ABANDONED");
                }
            }
        }
        jobs.values().removeIf(j -> j.isFinished() && now - j.finishedAt() > KEEP_FINISHED_MS);
    }

    /** 작업을 만든다. 캐시에 있으면 바로 DONE 상태로 돌려준다. */
    SolveJob submit(JSONObject problem, SolveOptions options, String clientIp) {
        return submit(problem, options, clientIp, false);
    }

    /** unattended: 서버가 스스로 낸 작업이라 지켜보는 사람이 없어도 빼지 않는다. */
    SolveJob submit(JSONObject problem, SolveOptions options, String clientIp, boolean unattended) {
        if (!"INITIAL".equals(options.mode())) {
            throw new RejectedException(400, "이번 버전은 mode=INITIAL만 지원합니다.");
        }
        // 문제를 먼저 변환해 본다: 형식 오류는 큐에 넣기 전에 400으로 돌려준다.
        BaseballSolution probe = ProblemCodec.toSolution(problem);
        boolean fullPlan = ProblemCodec.applyPlan(probe, problem, null);
        String cacheKey = cacheKey(problem, options, fullPlan);
        String id = UUID.randomUUID().toString().substring(0, 8);
        SolveJob job = new SolveJob(id, cacheKey, clientIp, problem, options);
        job.unattended = unattended;
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
            // 연결이 끊겨 다시 누른 경우: 같은 주소의 대기 작업을 아무도 보고 있지 않으면 그 자리를 이어받는다
            int place = queue.size();
            if (activePerIp.getOrDefault(clientIp, 0) >= limits.maxJobsPerIp()) {
                long now = System.currentTimeMillis();
                for (SolveJob j : List.copyOf(queue)) {
                    if (j.clientIp.equals(clientIp) && j.unwatchedFor(now, RETRY_ABANDON_MS)) {
                        place = Math.min(place, queue.indexOf(j));
                        cancelQueued(j, "ABANDONED");
                    }
                }
            }
            int active = activePerIp.getOrDefault(clientIp, 0);
            if (active >= limits.maxJobsPerIp()) {
                throw new RejectedException(429, "이미 실행 중인 편성이 있습니다. 끝난 뒤 다시 시도하세요.");
            }
            activePerIp.put(clientIp, active + 1);
            jobs.put(id, job);
            queue.add(Math.min(place, queue.size()), job);
            renumber();
        }
        runner.execute(this::runNext);
        return job;
    }

    void stop(SolveJob job) {
        job.stopRequested = true;
        if (cancelQueued(job, "STOPPED")) {
            return;
        }
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

    /** 아직 차례가 오지 않은 작업을 큐에서 빼고 IP 몫을 바로 돌려준다. 이미 큐에 없으면(돌기 시작함) false. */
    private synchronized boolean cancelQueued(SolveJob job, String reason) {
        if (!queue.remove(job)) {
            return false;
        }
        releaseIp(job.clientIp);
        renumber();
        job.done(Json.obj("jobId", job.id, "reason", reason, "score", null, "plan", new JSONArray()), true);
        LOG.info("job {} {} while queued", job.id, reason);
        return true;
    }

    private synchronized void releaseIp(String ip) {
        int active = activePerIp.getOrDefault(ip, 0);
        if (active <= 1) {
            activePerIp.remove(ip);
        } else {
            activePerIp.put(ip, active - 1);
        }
    }

    /** submit마다 하나씩 runner에 들어간다. 그 사이 취소된 작업이 있으면 꺼낼 것이 없어 그냥 끝난다. */
    void runNext() {
        SolveJob job;
        synchronized (this) {
            if (queue.isEmpty()) {
                return;
            }
            job = queue.remove(0);
            renumber();
        }
        run(job);
    }

    private void run(SolveJob job) {
        try {
            if (job.stopRequested || job.unwatchedFor(System.currentTimeMillis(), ABANDON_MS)) {
                job.done(Json.obj("jobId", job.id, "reason", job.stopRequested ? "STOPPED" : "ABANDONED", "score", null,
                        "plan", new JSONArray()), true);
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
            releaseIp(job.clientIp);
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
        // 홈 구장 지정은 보낸 값이 아니라 실제로 적용되는 연전 기간별 홈 의무 구단(이벤트·예전 obligationTeams·기본값을 푼 결과)
        BaseballSolution solution = ProblemCodec.toSolution(problem);
        out.put("homeDesignations", ProblemCodec.homeDesignations(solution));
        out.put("childrenDayHomeTeams", ProblemCodec.childrenDayTeams(solution));
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
        return word + (teams.length() > 0 ? " · 어린이날 홈 " + teams : "") + " · 시드 " + seed;
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
