package org.optaplanner.examples.baseball.web;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.Team;
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
    /** 요구 사항 점검에 쓰는 프로젝트(설정·이벤트 포함, {@code project_2025.json}). 없으면 엔진 입력 그대로(정한 값 없는 항목은 INFO). */
    private final JSONObject verifyProblem;
    private final JSONObject real;
    private volatile String defaultStatus = "MISSING";
    /** id + createdAt → {@link #recount} 결과. 저장된 결과는 바뀌지 않으니 한 번만 센다. */
    private final Map<String, JSONObject> recounted = new ConcurrentHashMap<>();

    Showcase(JobManager jobs, ResultStore store, ServerLimits limits, Path inputFile) {
        this.jobs = jobs;
        this.store = store;
        this.limits = limits;
        this.problem = BaseballApp.readJsonFile(inputFile.toString());
        this.verifyProblem = loadVerifyProblem(inputFile, problem);
        this.real = realMetrics(problem);
    }

    /** {@code input_2025.json} 옆의 {@code project_2025.json}({@code node ui/tools/build-project.js}로 만든 2025 프리셋 프로젝트). */
    static JSONObject loadVerifyProblem(Path inputFile, JSONObject fallback) {
        String name = inputFile.getFileName().toString().replaceFirst("^input", "project");
        Path project = inputFile.toAbsolutePath().resolveSibling(name);
        if (!name.equals(inputFile.getFileName().toString()) && Files.isRegularFile(project)) {
            try {
                return BaseballApp.readJsonFile(project.toString());
            } catch (RuntimeException e) {
                LOG.warn("{} unreadable; requirement checks use the engine input", project, e);
            }
        }
        return fallback;
    }

    JSONObject verifyProblem() {
        return verifyProblem;
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

    /** GET /api/v1/results/{id}: 저장된 결과 + 실제 일정 요약 + 요구 사항 점검(저장된 결과에 없으면 열 때 센다). */
    Optional<JSONObject> result(String id) {
        return store.load(id).map(r -> {
            JSONObject out = (JSONObject) recount(id, r).clone();
            if (out.get("real") == null) {
                out.put("real", Json.obj("totalKm", real.get("totalKm"), "spreadKm", real.get("spreadKm"),
                        "weekendHomeMin", real.get("weekendHomeMin"), "weekendHomeMax", real.get("weekendHomeMax")));
            }
            return out;
        });
    }

    /**
     * 요구 사항 점검이 생기기 전에 저장된 결과(기본 결과 포함)는 파일을 다시 만들지 않고 열 때 센다. 저장된 결과에는 문제(설정·이벤트)가
     * 없으므로 서버의 2025 프로젝트에 저장된 조건(어린이날 홈 구단·홈 구장 지정)을 입혀서 센다. 일정이 그 프로젝트와 맞지 않으면
     * (스튜디오에서 연전 기간·시리즈를 고친 결과) 점검하지 않고 그 이유를 싣는다.
     */
    private JSONObject verifyStored(JSONObject stored) {
        JSONArray plan = Json.array(stored.get("plan"));
        if (plan == null) {
            return Json.obj("error", "저장된 결과에 일정이 없어 점검하지 못했습니다.");
        }
        JSONObject problemForCheck = problemWithKnobs(verifyProblem, Json.object(stored.get("knobs")));
        if (!planFits(problemForCheck, plan)) {
            return Json.obj("error", "이 결과는 서버가 아는 2025 연전 기간·시리즈와 달라 다시 점검하지 못했습니다(스튜디오에서 고친 일정).");
        }
        return JobManager.verify(problemForCheck, plan);
    }

    /** 저장된 손잡이(homeDesignations: 연전 기간 시작일 → 홈 구단)를 이벤트(홈 구장 지정)로 바꿔 프로젝트에 입힌다. */
    @SuppressWarnings("unchecked")
    static JSONObject problemWithKnobs(JSONObject base, JSONObject knobs) {
        JSONObject out = (JSONObject) base.clone();
        JSONObject settings = Json.object(base.get("settings"));
        settings = settings == null ? new JSONObject() : (JSONObject) settings.clone();
        out.put("settings", settings);
        if (knobs == null) {
            return out;
        }
        JSONArray children = Json.array(knobs.get("childrenDayHomeTeams"));
        if (children != null && !children.isEmpty()) {
            settings.put("obligationTeams", children);
        }
        JSONObject designations = Json.object(knobs.get("homeDesignations"));
        if (designations == null || designations.isEmpty()) {
            return out;
        }
        JSONArray cal = Json.array(base.get("calendar"));
        java.time.LocalDate opening = cal == null || cal.isEmpty() ? null : RequirementChecker.parseDate(Json.asString(((JSONObject) cal.get(0)).get("datetime"), ""));
        String openingDate = opening == null ? "" : opening.toString();
        JSONArray events = new JSONArray();
        JSONArray baseEvents = Json.array(base.get("events"));
        java.util.Set<String> covered = new java.util.HashSet<>();
        for (Object key : new java.util.TreeSet<>(designations.keySet())) {
            String date = String.valueOf(key);
            JSONArray teams = Json.array(designations.get(key));
            if (teams == null) {
                continue;
            }
            String type = date.equals(openingDate) ? "OPENING" : date.endsWith("-05-05") || isChildrenSlot(cal, date) ? "CHILDREN" : "CUSTOM";
            String name = "OPENING".equals(type) ? "개막전" : "CHILDREN".equals(type) ? "어린이날" : "홈 구장 지정";
            covered.add(type);
            events.add(Json.obj("id", "knob-" + date, "type", type, "name", name, "date", "CHILDREN".equals(type) ? date.substring(0, 4) + "-05-05" : date,
                    "mode", "STADIUM", "teams", teams));
        }
        if (baseEvents != null) {
            for (Object o : baseEvents) {
                JSONObject ev = Json.object(o);
                if (ev != null && !covered.contains(Json.asString(ev.get("type"), ""))) {
                    events.add(ev);
                }
            }
        }
        out.put("events", events);
        return out;
    }

    /** 연전 기간 시작일 date가 그 해 5/5를 품는 기간인가. */
    private static boolean isChildrenSlot(JSONArray cal, String date) {
        if (cal == null) {
            return false;
        }
        java.time.LocalDate start = RequirementChecker.parseDate(date);
        if (start == null) {
            return false;
        }
        java.time.LocalDate children = java.time.LocalDate.of(start.getYear(), 5, 5);
        for (Object o : cal) {
            JSONObject c = (JSONObject) o;
            java.time.LocalDate s = RequirementChecker.parseDate(Json.asString(c.get("datetime"), ""));
            if (s != null && s.equals(start)) {
                long len = Json.asLong(c.get("consecutive"), 3);
                return !children.isBefore(s) && children.isBefore(s.plusDays(len));
            }
        }
        return false;
    }

    /** plan의 시리즈 수가 프로젝트와 같고, 배정된 모든 시리즈의 연전 수가 그 기간의 연전 수와 같은가(미배정 -1은 점검기가 잡는다). */
    static boolean planFits(JSONObject problem, JSONArray plan) {
        JSONArray matches = Json.array(problem.get("matches"));
        JSONArray cal = Json.array(problem.get("calendar"));
        if (matches == null || cal == null || plan.size() != matches.size()) {
            return false;
        }
        for (Object o : plan) {
            JSONObject e = Json.object(o);
            long m = e == null ? -1 : Json.asLong(e.get("match"), -1);
            long c = e == null ? -1 : Json.asLong(e.get("calendar"), -1);
            if (m < 0 || m >= matches.size() || c >= cal.size()) {
                return false;
            }
            if (c < 0) {
                continue;
            }
            if (Json.asLong(((JSONObject) matches.get((int) m)).get("consecutive"), 3) != Json.asLong(((JSONObject) cal.get((int) c)).get("consecutive"), 3)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 올스타 휴식기(경기 없는 날 {@link ScoreFormulas#LONG_BREAK_REST_DAYS}일 이상) 사이 이동을 세지 않게 바뀌기 전에 저장된
     * 결과의 지표를, 저장된 일정(plan)은 그대로 두고 지금 채점기로 다시 센다. 2025 입력으로 만든 결과인지는 저장된 지표가
     * 「지금 지표 + 휴식기 이동」과 구단마다 같은지로 본다(스튜디오에서 거리·연전을 고친 결과는 건드리지 않는다).
     * 점수는 문제 설정을 아는 기본 결과만 다시 센다(보여주는 문은 결과 점수를 보여 주지 않는다).
     */
    JSONObject recount(String id, JSONObject stored) {
        String key = id + "|" + stored.get("createdAt");
        return recounted.computeIfAbsent(key, k -> {
            JSONObject out = stored;
            try {
                out = recountNow(problem, id, stored);
            } catch (RuntimeException e) {
                LOG.warn("result {} not recounted", id, e);
            }
            if (out.get("verification") == null) {
                JSONObject withCheck = (JSONObject) out.clone();
                withCheck.put("verification", verifyStored(out));
                out = withCheck;
            }
            return out;
        });
    }

    static JSONObject recountNow(JSONObject problem, String id, JSONObject stored) {
        JSONArray plan = Json.array(stored.get("plan"));
        JSONObject old = Json.object(stored.get("metrics"));
        if (plan == null || old == null || Json.array(old.get("teams")) == null) {
            return stored;
        }
        BaseballSolution solution = ProblemCodec.toSolution(problem);
        if (!ProblemCodec.applyPlan(solution, problem, plan)) {
            return stored;
        }
        JSONObject fresh = Metrics.of(solution);
        Map<String, Long> breakLeg = breakLegTenths(solution);
        Map<String, JSONObject> freshByName = new HashMap<>();
        for (Object o : Json.array(fresh.get("teams"))) {
            JSONObject row = Json.object(o);
            freshByName.put(Json.asString(row.get("name"), ""), row);
        }
        JSONArray oldTeams = Json.array(old.get("teams"));
        if (oldTeams.size() != freshByName.size()) {
            return stored;
        }
        boolean same = true;
        for (Object o : oldTeams) {
            JSONObject was = Json.object(o);
            String name = Json.asString(was.get("name"), "");
            JSONObject now = freshByName.get(name);
            if (now == null || !breakLeg.containsKey(name)) {
                return stored;
            }
            long leg = breakLeg.get(name);
            long nowTenths = Math.round(Json.asDouble(now.get("distanceKm"), -1) * 10);
            long wasTenths = Math.round(Json.asDouble(was.get("distanceKm"), -1) * 10);
            long nowMoves = Json.asLong(now.get("moves"), -1);
            long wasMoves = Json.asLong(was.get("moves"), -2);
            boolean otherSame = Json.asLong(now.get("holidayWeight"), -1) == Json.asLong(was.get("holidayWeight"), -2)
                    && Json.asLong(now.get("weekendHome"), -1) == Json.asLong(was.get("weekendHome"), -2);
            if (!otherSame) {
                return stored;
            }
            if (nowTenths == wasTenths && nowMoves == wasMoves) {
                continue;
            }
            same = false;
            if (wasTenths != nowTenths + leg || wasMoves != nowMoves + (leg > 0 ? 1 : 0)) {
                return stored;
            }
        }
        if (same) {
            return stored;
        }
        JSONObject out = (JSONObject) stored.clone();
        out.put("metrics", fresh);
        if (DEFAULT_ID.equals(id)) {
            BendableLongScore score = ScoreFormulas.evaluate(solution.getTeamList(), solution.getCalendarList(),
                    solution.getMatchList(), solution.getSettings());
            out.put("score", Json.score(score));
            out.put("scoreString", score.toString());
        }
        LOG.info("result {} recounted without the all-star leg: {} km → {} km", id, old.get("totalKm"), fresh.get("totalKm"));
        return out;
    }

    /** 구단 이름 → 이제 세지 않는 휴식기 이동 거리(0.1km). 휴식기를 건너는 이동이 없으면 0. */
    private static Map<String, Long> breakLegTenths(BaseballSolution solution) {
        Map<String, Long> out = new HashMap<>();
        for (Team team : solution.getTeamList()) {
            List<Match> route = solution.getMatchList().stream()
                    .filter(m -> ScoreFormulas.isRegular(m) && (m.getHome() == team || m.getAway() == team))
                    .sorted(Comparator.comparingInt((Match m) -> m.getCalendar().getSlotIndex()).thenComparingLong(Match::getId))
                    .toList();
            long leg = 0L;
            for (int i = 1; i < route.size(); i++) {
                if (ScoreFormulas.isLongBreak(route.get(i - 1).getCalendar(), route.get(i).getCalendar())) {
                    leg += route.get(i - 1).getHome().getDistanceTenthsTo(route.get(i).getHome().getIndex());
                }
            }
            out.put(team.getName(), leg);
        }
        return out;
    }

    /** GET /api/v1/compare: 실제 vs 기본 결과. 기본 결과가 아직 없으면 empty. */
    Optional<JSONObject> compare() {
        return store.load(DEFAULT_ID).map(stored -> {
            JSONObject def = recount(DEFAULT_ID, stored);
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
