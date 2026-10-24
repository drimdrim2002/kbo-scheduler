package org.optaplanner.examples.baseball.web;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.score.ScoreFormulas;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 보여주는 문의 서버 쪽: 실제 2025 1차 일정 지표(시작 때 한 번), 기본 결과(없으면 시작 때 한 번 편성), 비교·결과·OG 응답.
 */
final class Showcase {

    private static final Logger LOG = LoggerFactory.getLogger(Showcase.class);
    static final String DEFAULT_ID = "default";

    private final JobManager jobs;
    private final ResultStore store;
    private final ServerLimits limits;
    private final JSONObject problem;
    private final JSONObject real;
    private volatile String defaultStatus = "MISSING";

    Showcase(JobManager jobs, ResultStore store, ServerLimits limits, Path inputFile) {
        this.jobs = jobs;
        this.store = store;
        this.limits = limits;
        this.problem = BaseballApp.readJsonFile(inputFile.toString());
        this.real = realMetrics(problem);
    }

    /** input JSON의 initialPlan(= KBO 발표 1차 일정)을 같은 채점기로 채점한다. */
    @SuppressWarnings("unchecked")
    private static JSONObject realMetrics(JSONObject problem) {
        BaseballSolution solution = ProblemCodec.toSolution(problem);
        Map<String, Long> slotByDate = new HashMap<>();
        for (Calendar c : solution.getCalendarList()) {
            if (c.isRegular()) {
                slotByDate.put(c.getStartTime().toString().replace('T', ' ') + (c.getStartTime().getSecond() == 0 && c.getStartTime().toString().length() == 16 ? ":00" : ""), c.getId());
            }
        }
        JSONArray plan = new JSONArray();
        JSONArray initial = Json.array(problem.get("initialPlan"));
        if (initial != null) {
            for (int i = 0; i < initial.size(); i++) {
                JSONObject e = Json.object(initial.get(i));
                Long slot = e == null ? null : slotByDate.get(Json.asString(e.get("datetime"), ""));
                plan.add(Json.obj("match", (long) i, "calendar", slot == null ? -1L : slot));
            }
        }
        boolean complete = ProblemCodec.applyPlan(solution, problem, plan);
        BendableLongScore score = ScoreFormulas.evaluate(solution.getTeamList(), solution.getCalendarList(),
                solution.getMatchList(), solution.getSettings());
        JSONObject m = Metrics.of(solution);
        m.put("label", "실제 2025 1차 일정(KBO 발표)");
        m.put("score", Json.score(score));
        m.put("scoreString", score.toString());
        m.put("feasible", score.getHardScore(0) == 0 && score.getHardScore(1) == 0);
        m.put("complete", complete);
        m.put("plan", plan);
        return m;
    }

    JSONObject realMetrics() {
        return real;
    }

    JSONObject problem() {
        return problem;
    }

    /** 기본 결과가 없으면 시작 때 한 번 편성한다(큐에 넣고 바로 돌아온다). */
    void ensureDefault() {
        if (store.exists(DEFAULT_ID)) {
            defaultStatus = "READY";
            return;
        }
        defaultStatus = "RUNNING";
        JSONObject options = Json.obj("timeLimitSec", Math.min(30L, limits.maxSeconds()), "seed", 42L,
                "seeds", (long) limits.defaultSeeds(), "init", "SCRATCH");
        try {
            SolveJob job = jobs.submit(problem, SolveOptions.from(options, limits), "server-default", true);
            job.onDone = payload -> {
                JSONObject copy = (JSONObject) payload.clone();
                copy.put("id", DEFAULT_ID);
                copy.put("title", "기본 조건 · 시드 42");
                store.save(DEFAULT_ID, copy);
                defaultStatus = "READY";
                LOG.info("default result ready: {}", copy.get("scoreString"));
            };
            if (job.isFinished()) {
                // 메모리 캐시에서 바로 끝난 경우
                Optional<JSONObject> cached = store.load(job.cacheKey.substring(0, 12));
                cached.ifPresent(p -> job.onDone.accept(p));
            }
        } catch (RuntimeException e) {
            defaultStatus = "ERROR";
            LOG.error("default result failed", e);
        }
    }

    String defaultStatus() {
        return defaultStatus;
    }

    /** GET /api/v1/results/{id}: 저장된 결과 + 실제 일정 요약. */
    Optional<JSONObject> result(String id) {
        return store.load(id).map(r -> {
            JSONObject out = (JSONObject) r.clone();
            if (out.get("real") == null) {
                out.put("real", Json.obj("totalKm", real.get("totalKm"), "spreadKm", real.get("spreadKm"),
                        "weekendHomeMin", real.get("weekendHomeMin"), "weekendHomeMax", real.get("weekendHomeMax")));
            }
            return out;
        });
    }

    /** GET /api/v1/compare: 실제 vs 기본 결과. 기본 결과가 아직 없으면 empty. */
    Optional<JSONObject> compare() {
        return store.load(DEFAULT_ID).map(def -> {
            JSONObject engine = (JSONObject) Json.object(def.get("metrics")).clone();
            engine.put("label", "매치봇 결과");
            engine.put("id", DEFAULT_ID);
            engine.put("seed", def.get("seed"));
            engine.put("options", def.get("options"));
            engine.put("elapsedMs", def.get("elapsedMs"));
            engine.put("improvementCount", def.get("improvementCount"));
            engine.put("score", def.get("score"));
            engine.put("scoreString", def.get("scoreString"));
            JSONObject realOut = (JSONObject) real.clone();
            realOut.remove("plan");
            long realKm = Json.asLong(real.get("totalKm"), 1);
            long engKm = Json.asLong(engine.get("totalKm"), 0);
            double realSpread = Json.asDouble(real.get("spreadKm"), 1);
            double engSpread = Json.asDouble(engine.get("spreadKm"), 0);
            JSONObject diff = Json.obj("totalKmPct", Math.round((1 - engKm / (double) realKm) * 1000) / 10.0,
                    "spreadKmRatio", realSpread == 0 ? 0.0 : Math.round(engSpread / realSpread * 100) / 100.0);
            JSONArray cal = Json.array(problem.get("calendar"));
            String from = cal == null || cal.isEmpty() ? "" : Json.asString(((JSONObject) cal.get(0)).get("datetime"), "").substring(0, 10);
            String to = cal == null || cal.isEmpty() ? "" : Json.asString(((JSONObject) cal.get(cal.size() - 1)).get("datetime"), "").substring(0, 10);
            return Json.obj("schemaVersion", 1L, "season", 2025L, "generatedAt", Instant.now().toString(),
                    "range", Json.obj("from", from, "to", to, "slots", (long) (cal == null ? 0 : cal.size()),
                            "series", (long) (Json.array(problem.get("matches")) == null ? 0 : Json.array(problem.get("matches")).size())),
                    "real", realOut, "engine", engine, "diff", diff);
        });
    }

    /** GET /og/{id}.png: 파일 캐시 → 없으면 그린다. */
    Optional<byte[]> og(String id) throws IOException {
        if (!ResultStore.validId(id)) {
            return Optional.empty();
        }
        Path png = store.pngPath(id);
        if (Files.isRegularFile(png)) {
            return Optional.of(Files.readAllBytes(png));
        }
        Optional<JSONObject> r = result(id);
        if (r.isEmpty()) {
            return Optional.empty();
        }
        JSONObject res = r.get();
        JSONObject m = Json.object(res.get("metrics"));
        long engKm = m == null ? 0 : Json.asLong(m.get("totalKm"), 0);
        double engSpread = m == null ? 0 : Json.asDouble(m.get("spreadKm"), 0);
        long realKm = Json.asLong(real.get("totalKm"), 0);
        double realSpread = Json.asDouble(real.get("spreadKm"), 0);
        long pct = Math.round((1 - engKm / (double) Math.max(1, realKm)) * 100);
        OgImage.Spec spec = new OgImage.Spec(
                DEFAULT_ID.equals(id) ? "KBO 일정, 매치봇이 다시 만든다면?" : "내가 만든 KBO 2025 일정",
                Json.asString(res.get("title"), ""),
                new String[] {"총 이동거리", "실제 대비", "구단 간 차이 (실제 " + String.format("%,.0f", realSpread) + "km)"},
                new String[] {String.format("%,d km", engKm), (pct >= 0 ? "−" : "+") + Math.abs(pct) + "%",
                        String.format("%,.0f km", engSpread)},
                realKm, engKm, "schedulelab.kr · 같은 입력·같은 채점기로 비교");
        byte[] bytes = OgImage.render(spec);
        store.savePng(id, bytes);
        return Optional.of(bytes);
    }
}
