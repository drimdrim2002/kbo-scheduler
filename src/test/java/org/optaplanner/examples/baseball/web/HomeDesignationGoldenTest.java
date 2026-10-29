package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Constants;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.score.ScoreFormulas;
import org.optaplanner.examples.baseball.solver.BaseballSolutionInitializer;

/**
 * 홈 구장 지정 골든 값: {@code ui/core/test/golden/home-designation.json}. 브라우저 채점기 엔진 호환 기준
 * ({@code ui/core/test/home-designation.test.js})이 같은 파일을 읽어 같은 점수가 나와야 한다.
 * 다시 만들기: {@code mvn -q test -Dtest=HomeDesignationGoldenTest -Dgolden.write=true}
 */
class HomeDesignationGoldenTest {

    private static final Path GOLDEN = Path.of("ui/core/test/golden/home-designation.json");
    private static final int SLOTS = 45;

    private static JSONObject event(String type, String date, List<String> teams) {
        return Json.obj("id", "ev-" + type.toLowerCase() + "-" + date, "type", type, "name", type, "date", date,
                "mode", "STADIUM", "teams", Json.arr(teams), "fix", "home");
    }

    /** 이름 → settings 덮어쓰기와 events. 2025 입력: 개막 홈 LG·SSG·KT·삼성·KIA, 어린이날 기본 두산·키움·한화·NC·롯데. */
    private static List<JSONObject> cases() {
        List<String> children = List.of("두산", "키움", "한화", "NC", "롯데");
        List<String> opening = List.of("LG", "SSG", "KT", "삼성", "KIA");
        List<JSONObject> out = new ArrayList<>();
        out.add(Json.obj("name", "no-events-legacy", "events", new JSONArray()));
        out.add(Json.obj("name", "no-events-legacy-obligationTeams", "obligationTeams", Json.arr(opening), "events", new JSONArray()));
        out.add(Json.obj("name", "opening-home-and-children", "events",
                Json.arr(List.of(event("OPENING", "2025-03-22", opening), event("CHILDREN", "2025-05-05", children)))));
        out.add(Json.obj("name", "partial-overlap-custom", "events", Json.arr(List.of(
                event("CHILDREN", "2025-05-05", List.of("두산", "키움")),
                event("CUSTOM", "2025-05-06", List.of("한화")),
                event("CUSTOM", "2025-06-06", List.of("KIA", "NC")),
                event("CUSTOM", "2025-07-17", List.of("SSG"))))));
        out.add(Json.obj("name", "children-legacy-wins-when-full", "obligationTeams", Json.arr(List.of("LG", "키움", "한화", "NC", "롯데")),
                "events", Json.arr(List.of(event("CHILDREN", "2025-05-05", children)))));
        JSONObject pairsOnly = Json.obj("id", "ev-opening", "type", "OPENING", "name", "개막전", "date", "2025-03-22",
                "mode", "STADIUM", "fix", "pairs", "pairs", Json.arr(List.of(Json.obj("home", "LG", "away", "롯데"),
                        Json.obj("home", "KT", "away", "한화"))));
        out.add(Json.obj("name", "pairs-only-and-empty", "events", Json.arr(List.of(pairsOnly,
                Json.obj("id", "ev-x", "type", "CUSTOM", "name", "빈 지정", "date", "2025-06-10", "mode", "STADIUM", "teams", new JSONArray())))));
        return out;
    }

    private static JSONObject problem(JSONObject spec) {
        JSONObject p = BaseballApp.readJsonFile(Constants.inputFileName);
        JSONObject settings = Json.obj("distanceToleranceKm", 300.0, "holidayTolerance", 1.5, "moveTolerance", 2.0);
        if (spec.get("obligationTeams") != null) {
            settings.put("obligationTeams", spec.get("obligationTeams"));
        }
        p.put("settings", settings);
        p.put("events", spec.get("events"));
        return p;
    }

    private static BendableLongScore score(JSONObject problem, List<Long> plan) {
        BaseballSolution solution = ProblemCodec.toSolution(problem);
        Map<Long, Calendar> byId = new HashMap<>();
        for (Calendar c : solution.getCalendarList()) {
            byId.put(c.getId(), c);
        }
        for (Match m : solution.getMatchList()) {
            long slot = plan.get(m.getId().intValue());
            m.setCalendar(slot < 0 ? null : byId.get(slot));
        }
        return ScoreFormulas.evaluate(solution.getTeamList(), solution.getCalendarList(), solution.getMatchList());
    }

    private static List<List<Long>> plans() {
        BaseballSolution base = BaseballApp.makeSolution(BaseballApp.readJsonFile(Constants.inputFileName));
        BaseballSolutionInitializer.initialize(base, 0L, new BaseballSolutionInitializer.Settings(8, 2, 2_000, 100, false));
        int matchCount = base.getMatchList().size();
        Long[] feasible = new Long[matchCount];
        for (Match m : base.getMatchList()) {
            feasible[m.getId().intValue()] = m.getCalendar().getId();
        }
        List<List<Long>> out = new ArrayList<>();
        out.add(List.of(feasible));
        // 같은 배정에서 시리즈 몇 개만 맞바꾼 것(어린이날·개막 근처의 의무 위반이 생긴다)
        Random random = new Random(20271029L);
        Long[] swapped = feasible.clone();
        for (int k = 0; k < 30; k++) {
            int a = random.nextInt(matchCount);
            int b = random.nextInt(matchCount);
            Long t = swapped[a];
            swapped[a] = swapped[b];
            swapped[b] = t;
        }
        out.add(List.of(swapped));
        Long[] noise = new Long[matchCount];
        for (int m = 0; m < matchCount; m++) {
            noise[m] = random.nextDouble() < 0.04 ? -1L : (long) random.nextInt(SLOTS);
        }
        out.add(List.of(noise));
        return out;
    }

    private static JSONArray scoreJson(BendableLongScore s) {
        List<Long> levels = new ArrayList<>();
        for (int i = 0; i < ScoreFormulas.HARD_LEVELS; i++) {
            levels.add(s.hardScore(i));
        }
        for (int i = 0; i < ScoreFormulas.SOFT_LEVELS; i++) {
            levels.add(s.softScore(i));
        }
        return Json.arr(levels);
    }

    @Test
    void javaScoresMatchTheGoldenFile() throws Exception {
        if (Boolean.getBoolean("golden.write")) {
            List<List<Long>> plans = plans();
            List<JSONObject> out = new ArrayList<>();
            for (JSONObject spec : cases()) {
                List<JSONArray> expected = new ArrayList<>();
                for (List<Long> plan : plans) {
                    expected.add(scoreJson(score(problem(spec), plan)));
                }
                JSONObject c = (JSONObject) spec.clone();
                c.put("expected", Json.arr(expected));
                out.add(c);
            }
            List<JSONArray> planJson = new ArrayList<>();
            for (List<Long> plan : plans) {
                planJson.add(Json.arr(plan));
            }
            JSONObject golden = Json.obj("note", "Java ScoreFormulas.evaluate(input_2025.json + settings + events) — HomeDesignationGoldenTest가 만든다.",
                    "plans", Json.arr(planJson), "cases", Json.arr(out));
            Files.writeString(GOLDEN, Json.canonical(golden) + "\n", StandardCharsets.UTF_8);
        }
        JSONObject golden = (JSONObject) Json.parse(Files.readString(GOLDEN, StandardCharsets.UTF_8));
        JSONArray plans = (JSONArray) golden.get("plans");
        JSONArray cases = (JSONArray) golden.get("cases");
        assertThat(cases).hasSize(cases().size());
        for (Object o : cases) {
            JSONObject spec = (JSONObject) o;
            JSONArray expected = (JSONArray) spec.get("expected");
            for (int i = 0; i < plans.size(); i++) {
                List<Long> plan = new ArrayList<>();
                for (Object v : (JSONArray) plans.get(i)) {
                    plan.add(Json.asLong(v, -1L));
                }
                JSONArray actual = scoreJson(score(problem(spec), plan));
                assertThat(Json.canonical(actual)).as("%s plan %d", spec.get("name"), i).isEqualTo(Json.canonical(expected.get(i)));
            }
        }
    }
}
