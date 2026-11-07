package org.optaplanner.examples.baseball.web;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.examples.baseball.reschedule.RescheduleDiagnosis;
import org.optaplanner.examples.baseball.reschedule.RescheduleInitializer;
import org.optaplanner.examples.baseball.reschedule.RescheduleScoreFormulas;
import org.optaplanner.examples.baseball.reschedule.RescheduleSolution;
import org.optaplanner.examples.baseball.reschedule.RuleCheck;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * mode=RESCHEDULE 작업과 채점(설계 §5). 큐·IP 한도·캐시는 {@link JobManager}가 맡고, 여기서는 문제 만들기, 돌리기, 결과 모양을 정한다.
 * 결과는 메모리 캐시에만 둔다(공유 링크 저장은 이번 범위가 아니다).
 */
final class RescheduleJobs {

    private static final Logger LOG = LoggerFactory.getLogger(RescheduleJobs.class);
    /** 고칠 곳 확인: 마감일을 하루씩 늦춰 보는 최대 일수, 한 번 확인에 쓰는 첫 배정 반복 수. */
    static final int PROBE_MAX_EXTRA_DAYS = 14;
    static final int PROBE_RESTARTS = 10;

    private RescheduleJobs() {
    }

    static String cacheKey(JSONObject problem, SolveOptions options) {
        JSONObject key = ProblemCodec.engineInput(problem);
        key.put("plan", problem.get("plan"));
        key.put("settings", problem.get("settings"));
        key.put("games", problem.get("games"));
        key.put("reschedule", problem.get("reschedule"));
        key.put("options", options.toJson());
        key.put("scoring", "reschedule-1");
        return JobManager.sha256(Json.canonical(key));
    }

    static JSONObject run(SolveJob job) throws InterruptedException {
        RescheduleCodec.Parsed template = RescheduleCodec.parse(job.problem);
        MultiStartSolver<RescheduleSolution> solver = MultiStartSolver.reschedule();
        job.solver = solver;
        long start = System.currentTimeMillis();
        MultiStartSolver.Sink<RescheduleSolution> sink = new MultiStartSolver.Sink<>() {
            @Override
            public void seedBest(long seed, BendableLongScore score, long elapsedMs) {
                job.seedBest(Json.obj("jobId", job.id, "seed", seed, "score", Json.score(score), "scoreString", score.toString(),
                        "elapsedMs", elapsedMs));
            }

            @Override
            public void best(RescheduleSolution solution, long seed, BendableLongScore score, long elapsedMs, int improvementCount) {
                job.best(Json.obj("jobId", job.id, "mode", SolveOptions.RESCHEDULE, "plan", RescheduleCodec.planJson(with(template, solution)),
                        "score", Json.score(score), "scoreString", score.toString(), "unplacedCount", -score.hardScore(1),
                        "elapsedMs", elapsedMs, "improvementCount", (long) improvementCount, "seed", seed));
            }
        };
        MultiStartSolver.Result<RescheduleSolution> result = solver.run(seed -> {
            RescheduleSolution s = RescheduleCodec.parse(job.problem).solution();
            RescheduleInitializer.initialize(s, seed);
            return s;
        }, job.options.seedList(), job.options.timeLimitSec(), job.options.unimprovedSec(), sink);
        job.solver = null;
        RescheduleCodec.Parsed best = with(template, result.best());
        JSONObject payload = report(best);
        JSONArray seeds = new JSONArray();
        for (MultiStartSolver.SeedResult s : result.seeds()) {
            seeds.add(Json.obj("seed", s.seed(), "score", Json.score(s.score()), "scoreString", s.score().toString(),
                    "initialScore", Json.score(s.initialScore()), "elapsedMs", s.elapsedMs()));
        }
        payload.put("jobId", job.id);
        payload.put("reason", result.reason());
        payload.put("elapsedMs", result.elapsedMs());
        payload.put("seed", result.bestSeed());
        payload.put("seedResults", seeds);
        payload.put("options", job.options.toJson());
        payload.put("fixes", Json.arr(fixes(job.problem, best)));
        LOG.info("reschedule job {} {} {} in {}ms", job.id, result.reason(), result.bestScore(), System.currentTimeMillis() - start);
        return payload;
    }

    private static RescheduleCodec.Parsed with(RescheduleCodec.Parsed template, RescheduleSolution solution) {
        return new RescheduleCodec.Parsed(solution, template.played(), template.start(), template.end(), template.firstRoundLast());
    }

    /** /api/v1/score mode=RESCHEDULE: 보낸 일정 [{game, date}]을 채점한다. */
    static JSONObject score(JSONObject problem, JSONArray plan) {
        RescheduleCodec.Parsed parsed = RescheduleCodec.parse(problem);
        RescheduleCodec.applyPlan(parsed, plan);
        return report(parsed);
    }

    /** 결과·채점 공통: 일정, 점수, 평가 숫자, 규칙 위반, 못 넣은 경기와 이유. */
    static JSONObject report(RescheduleCodec.Parsed parsed) {
        RescheduleSolution s = parsed.solution();
        BendableLongScore score = RescheduleScoreFormulas.evaluate(s);
        JSONArray violations = new JSONArray();
        for (RuleCheck.Violation v : RuleCheck.violations(s)) {
            violations.add(Json.obj("code", v.code(), "team", v.team(), "from", v.from(), "to", v.to(), "text", v.text()));
        }
        RescheduleDiagnosis.Result d = RescheduleDiagnosis.explain(s);
        JSONArray unplaced = new JSONArray();
        for (RescheduleDiagnosis.Unplaced u : d.unplaced()) {
            JSONArray reasons = new JSONArray();
            for (RescheduleDiagnosis.Reason r : u.reasons()) {
                reasons.add(Json.obj("code", r.code(), "team", r.team(), "days", (long) r.days(), "text", r.text()));
            }
            unplaced.add(Json.obj("game", u.game(), "home", u.home(), "away", u.away(), "reasons", reasons, "text", u.text()));
        }
        JSONArray limits = new JSONArray();
        for (RescheduleDiagnosis.TeamLimit l : d.teamLimits()) {
            limits.add(Json.obj("team", l.team(), "capacity", (long) l.capacity(), "need", (long) l.need(), "text", l.text()));
        }
        return Json.obj("mode", SolveOptions.RESCHEDULE, "engine", "server", "plan", RescheduleCodec.planJson(parsed),
                "score", Json.score(score), "scoreString", score.toString(), "levels", Json.arr(s.getSettings().levelNames()),
                "metrics", RescheduleCodec.metrics(parsed), "violations", violations, "unplaced", unplaced, "teamLimits", limits,
                "period", Json.obj("start", parsed.start().toString(), "end", parsed.end().toString()));
    }

    /**
     * 고칠 곳(설계 §2.5의 3): 꼭 지키는 규칙을 하나씩 조금 풀어 첫 배정만 다시 만들어 본다. 실제로 다 들어간 것만 「들어갑니다」.
     * 엔진은 이 값을 적용하지 않는다(요구 §9).
     */
    static List<JSONObject> fixes(JSONObject problem, RescheduleCodec.Parsed best) {
        List<JSONObject> out = new ArrayList<>();
        if (RescheduleScoreFormulas.totals(best.solution()).unplaced == 0) {
            return out;
        }
        int run = best.solution().getSettings().getMaxConsecutiveDays();
        int dh = best.solution().getSettings().getMaxDoubleHeaders();
        for (int k = 1; k <= PROBE_MAX_EXTRA_DAYS; k++) {
            LocalDate end = best.end().plusDays(k);
            if (fits(problem, new RescheduleCodec.Override(end, null, null))) {
                out.add(Json.obj("code", "EXTEND_END", "value", end.toString(), "days", (long) k, "confirmed", Boolean.TRUE,
                        "text", "마감일을 " + RuleCheck.label(end) + "까지 " + k + "일 늦추면 모두 들어갑니다"));
                break;
            }
        }
        if (fits(problem, new RescheduleCodec.Override(null, run + 1, null))) {
            out.add(Json.obj("code", "RAISE_RUN", "value", (long) (run + 1), "confirmed", Boolean.TRUE,
                    "text", "연속 경기일 상한을 " + (run + 1) + "일로 늘리면 모두 들어갑니다"));
        }
        if (fits(problem, new RescheduleCodec.Override(null, null, dh + 1))) {
            out.add(Json.obj("code", "RAISE_DH", "value", (long) (dh + 1), "confirmed", Boolean.TRUE,
                    "text", "더블헤더 상한을 " + (dh + 1) + "번으로 늘리면 모두 들어갑니다"));
        }
        if (out.isEmpty()) {
            out.add(Json.obj("code", "TRY", "confirmed", Boolean.FALSE,
                    "text", "마감일을 늦추거나 연속 경기일·더블헤더 상한을 늘려 보세요"));
        }
        return out;
    }

    private static boolean fits(JSONObject problem, RescheduleCodec.Override override) {
        try {
            RescheduleSolution s = RescheduleCodec.parse(problem, override).solution();
            return RescheduleInitializer.initialize(s, 0, PROBE_RESTARTS) == 0;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
