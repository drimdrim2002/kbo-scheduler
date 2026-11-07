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
        return Json.obj("base", "data/baseball/project_2025.json", "problems", problems, "cases", cases);
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
