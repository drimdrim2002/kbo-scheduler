package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Random;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;
import org.optaplanner.examples.baseball.reschedule.RDay;
import org.optaplanner.examples.baseball.reschedule.RGame;
import org.optaplanner.examples.baseball.reschedule.RescheduleInitializer;
import org.optaplanner.examples.baseball.reschedule.RescheduleSolution;

/**
 * 서버와 브라우저(ui/core/reschedule-daily.js)가 같은 일정에 같은 답(점수, 평가 숫자, 규칙 위반, 못 넣은 이유 문장, 결과 일정)을
 * 내는지 맞춰 보는 사례 파일. 이 테스트가 서버의 답을 쓰고(golden.write), {@code node ui/core/test/run-tests.js}가 브라우저의 답과
 * 글자까지 비교한다. 쓰지 않을 때는 저장된 답이 지금 서버 답과 같은지 본다(규칙을 바꾸고 다시 만들지 않으면 실패).
 * 다시 만들기: {@code mvn -q test -Dtest=RescheduleGoldenTest -Dgolden.write=true}
 */
class RescheduleGoldenTest {

    static final Path GOLDEN = Path.of("ui/core/test/golden/reschedule-golden.json");
    static final Path DONE_SAMPLE = Path.of("ui/core/test/golden/reschedule-done-sample.json");

    @SuppressWarnings("unchecked")
    static JSONObject build() {
        JSONArray problems = new JSONArray();
        JSONArray cases = new JSONArray();
        Random random = new Random(20261107);

        // 0: 4주, 취소 30경기
        JSONObject p0 = RescheduleFixtures.problem(9, 30, "2025-09-01", "2025-09-28");
        // 1: 열흘(다 못 넣음)
        JSONObject p1 = RescheduleFixtures.problem(5, 30, "2025-09-01", "2025-09-10");
        // 2: 다시 짜기(치른 경기·다시 취소·발표 경기)
        JSONObject p2 = RescheduleFixtures.problem(3, 12, "2025-09-08", "2025-09-28");
        JSONObject rs2 = (JSONObject) p2.get("reschedule");
        JSONArray t2 = (JSONArray) rs2.get("targets");
        JSONArray plan2 = new JSONArray();
        plan2.add(Json.obj("game", ((JSONObject) t2.get(0)).get("id"), "date", "2025-09-03"));
        plan2.add(Json.obj("game", ((JSONObject) t2.get(1)).get("id"), "date", "2025-09-05"));
        plan2.add(Json.obj("game", ((JSONObject) t2.get(2)).get("id"), "date", "2025-09-12"));
        plan2.add(Json.obj("game", ((JSONObject) t2.get(3)).get("id"), "date", "2025-09-12"));
        rs2.put("plan", plan2);
        ((JSONArray) p2.get("games")).add(Json.obj("game", ((JSONObject) t2.get(1)).get("id"), "date", "2025-09-05", "status", "CANCELLED", "reason", "RAIN"));
        // 3: 운영 방침(거리 먼저, 허용 차이 작게) + 기준 순서 바꿈 + 허용 1일
        JSONObject p3 = RescheduleFixtures.problem(11, 20, "2025-09-01", "2025-09-24");
        JSONObject settings3 = (JSONObject) ((JSONObject) p3.get("settings")).clone();
        settings3.put("objective", Json.obj("order", Json.arr(List.of("distance", "moves", "holiday", "total")), "moveGap", 3.0, "distanceGapKm", 400.0, "holidayGap", 3.0));
        p3.put("settings", settings3);
        JSONObject rs3 = (JSONObject) p3.get("reschedule");
        rs3.put("order", Json.arr(List.of("fairness", "lastDay", "monday", "addedDistance", "doubleHeader")));
        rs3.put("lastDayToleranceDays", 1L);
        // 4: 더블헤더 없음, 연속 4일
        JSONObject p4 = RescheduleFixtures.problem(13, 25, "2025-09-01", "2025-09-20");
        JSONObject rs4 = (JSONObject) p4.get("reschedule");
        rs4.put("maxDoubleHeadersPerTeam", 0L);
        rs4.put("maxConsecutiveDays", 4L);
        List<JSONObject> ps = List.of(p0, p1, p2, p3, p4);
        String[] names = {"4주", "열흘", "다시 짜기", "운영 방침·기준 순서", "더블헤더 없음·연속 4일"};
        for (int i = 0; i < ps.size(); i++) {
            JSONObject p = ps.get(i);
            JSONObject entry = Json.obj("name", names[i], "games", p.get("games"), "reschedule", p.get("reschedule"));
            if (i == 3) {
                entry.put("settings", p.get("settings"));
            }
            problems.add(entry);
            // 첫 배정 결과
            RescheduleCodec.Parsed parsed = RescheduleCodec.parse(p);
            RescheduleInitializer.initialize(parsed.solution(), i + 1L);
            cases.add(caseOf(names[i] + " · 첫 배정", i, p, RescheduleCodec.planJson(parsed)));
            // 무작위 배정(규칙 위반·빈 경기·더블헤더)
            for (int k = 0; k < (i == 0 ? 8 : 3); k++) {
                RescheduleSolution s = parsed.solution();
                List<RDay> days = s.getDayList();
                for (RGame g : s.getGameList()) {
                    if (!g.isPinned()) {
                        g.setDay(random.nextInt(8) == 0 ? null : days.get(random.nextInt(days.size())));
                    }
                }
                for (int r = 0; r < 3; r++) {
                    RGame a = s.getGameList().get(random.nextInt(s.getGameList().size()));
                    for (RGame b : s.getGameList()) {
                        if (b != a && b.sameMatchup(a) && a.getDay() != null && !b.isPinned()) {
                            b.setDay(a.getDay());
                            break;
                        }
                    }
                }
                cases.add(caseOf(names[i] + " · 무작위 " + (k + 1), i, p, RescheduleCodec.planJson(parsed)));
            }
        }
        return Json.obj("base", "data/baseball/project_2025.json", "problems", problems, "cases", cases, "errors", errors());
    }

    /** 입력 오류: 서버가 돌려주는 문장 그대로. 브라우저 parse가 같은 문장을 내야 한다. */
    @SuppressWarnings("unchecked")
    static JSONArray errors() {
        JSONArray out = new JSONArray();
        java.util.function.BiConsumer<String, JSONObject> add = (name, p) -> {
            String message;
            try {
                RescheduleCodec.parse(p);
                throw new IllegalStateException("오류가 나야 하는 사례: " + name);
            } catch (IllegalArgumentException e) {
                message = e.getMessage();
            }
            JSONObject entry = Json.obj("name", name, "games", p.get("games"), "reschedule", p.get("reschedule"), "message", message);
            if (p.get("settings") != null && ((JSONObject) p.get("settings")).get("homeTotals") != null) {
                entry.put("settings", p.get("settings"));
            }
            out.add(entry);
        };
        add.accept("시작이 1차 편성 안", RescheduleFixtures.problem(21, 5, "2025-08-31", "2025-09-20"));
        add.accept("마감일이 시작보다 앞", RescheduleFixtures.problem(21, 5, "2025-09-05", "2025-09-03"));
        add.accept("기간이 너무 김", RescheduleFixtures.problem(21, 5, "2025-09-01", "2026-01-31"));
        JSONObject missing = RescheduleFixtures.problem(21, 5, "2025-09-01", "2025-09-20");
        ((JSONArray) ((JSONObject) missing.get("reschedule")).get("targets")).remove(0);
        add.accept("취소 경기 빠짐", missing);
        JSONObject fewer = RescheduleFixtures.problem(21, 0, "2025-09-01", "2025-09-20");
        JSONArray ft = (JSONArray) ((JSONObject) fewer.get("reschedule")).get("targets");
        ft.remove(ft.size() - 1);
        add.accept("구단쌍 15경기", fewer);
        JSONObject unmarked = RescheduleFixtures.problem(21, 3, "2025-09-01", "2025-09-20");
        ((JSONArray) unmarked.get("games")).remove(0);
        add.accept("취소 표시 없는 대상", unmarked);
        JSONObject order = RescheduleFixtures.problem(21, 0, "2025-09-01", "2025-09-20");
        ((JSONObject) order.get("reschedule")).put("order", Json.arr(List.of("lastDay", "monday")));
        add.accept("기준 순서", order);
        JSONObject run = RescheduleFixtures.problem(21, 0, "2025-09-01", "2025-09-20");
        ((JSONObject) run.get("reschedule")).put("maxConsecutiveDays", 0L);
        add.accept("연속 경기일 상한 0", run);
        JSONObject home = RescheduleFixtures.problem(21, 0, "2025-09-01", "2025-09-20");
        JSONObject hs = (JSONObject) ((JSONObject) home.get("settings")).clone();
        hs.put("homeTotals", Json.obj("moreTeams", Json.arr(List.of("SSG", "두산", "LG", "KT", "키움")),
                "more", Json.obj("total", 73L, "initial", 69L), "less", Json.obj("total", 71L, "initial", 66L)));
        home.put("settings", hs);
        add.accept("홈 73/71 안 맞음", home);
        // 발표한 일정: LG가 8/26~8/31에 이어 9/1~9/3 매일 → 연속 9일
        JSONObject streak = RescheduleFixtures.problem(21, 0, "2025-09-01", "2025-09-20");
        JSONObject rs = (JSONObject) streak.get("reschedule");
        JSONArray plan = new JSONArray();
        int day = 1;
        for (Object o : (JSONArray) rs.get("targets")) {
            JSONObject t = (JSONObject) o;
            if (day <= 3 && ("LG".equals(t.get("home")) || "LG".equals(t.get("away")))) {
                plan.add(Json.obj("game", t.get("id"), "date", "2025-09-0" + day++));
            }
        }
        rs.put("plan", plan);
        add.accept("발표 일정이 연속 경기일을 넘음", streak);
        JSONObject late = RescheduleFixtures.problem(21, 0, "2025-09-01", "2025-09-20");
        JSONObject lrs = (JSONObject) late.get("reschedule");
        JSONArray lp = new JSONArray();
        lp.add(Json.obj("game", ((JSONObject) ((JSONArray) lrs.get("targets")).get(0)).get("id"), "date", "2025-09-25"));
        lrs.put("plan", lp);
        add.accept("발표 일정이 마감일 뒤", late);
        return out;
    }

    @SuppressWarnings("unchecked")
    private static JSONObject caseOf(String name, int problem, JSONObject p, JSONArray plan) {
        JSONArray input = new JSONArray();
        for (Object o : plan) {
            JSONObject e = (JSONObject) o;
            if (!Boolean.TRUE.equals(e.get("played"))) {
                input.add(Json.obj("game", e.get("game"), "date", e.get("date")));
            }
        }
        JSONObject expect = RescheduleJobs.score(p, input);
        expect.remove("engine");
        return Json.obj("name", name, "problem", (long) problem, "plan", input, "expect", expect);
    }

    @Test
    void serverAnswersAreUpToDate() throws Exception {
        JSONObject now = build();
        if (Boolean.getBoolean("golden.write")) {
            Files.writeString(GOLDEN, Json.str(now) + "\n", StandardCharsets.UTF_8);
            JobManager jobs = new JobManager(ServerLimits.defaults(), null, Runnable::run);
            SolveOptions o = SolveOptions.from(Json.obj("mode", "RESCHEDULE", "timeLimitSec", 1L, "seeds", 1L), ServerLimits.defaults());
            SolveJob job = jobs.submit(RescheduleFixtures.problem(5, 30, "2025-09-01", "2025-09-12"), o, "golden");
            Files.writeString(DONE_SAMPLE, Json.str(Json.object(job.statusJson().get("done"))) + "\n", StandardCharsets.UTF_8);
        }
        String stored = Files.readString(GOLDEN, StandardCharsets.UTF_8).trim();
        assertThat(Json.canonical(Json.parse(stored))).as("규칙을 바꿨으면 golden을 다시 만드세요").isEqualTo(Json.canonical(Json.parse(Json.str(now))));
        assertThat(Files.exists(DONE_SAMPLE)).isTrue();
    }
}
