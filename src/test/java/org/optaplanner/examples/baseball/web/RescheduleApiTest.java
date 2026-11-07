package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;

/** mode=RESCHEDULE: 작업 결과 모양, 캐시(같은 입력 → 같은 결과), 채점, 입력 오류. */
class RescheduleApiTest {

    private static SolveOptions options(long seed) {
        return SolveOptions.from(Json.obj("mode", "RESCHEDULE", "timeLimitSec", 2L, "unimprovedSec", 1L, "seed", seed, "seeds", 2L),
                ServerLimits.defaults());
    }

    @Test
    void solvesAndReportsTheWholeShape() throws Exception {
        JobManager jobs = new JobManager(ServerLimits.defaults(), null, Runnable::run);
        JSONObject problem = RescheduleFixtures.problem(9, 30, "2025-09-01", "2025-09-28");
        SolveJob job = jobs.submit(problem, options(1), "1.1.1.1");
        assertThat(job.status()).isEqualTo(SolveJob.Status.DONE);
        JSONObject done = Json.object(job.statusJson().get("done"));
        assertThat(done.get("mode")).isEqualTo("RESCHEDULE");
        assertThat(done.get("engine")).isEqualTo("server");
        assertThat(done).containsKeys("plan", "score", "scoreString", "levels", "metrics", "violations", "unplaced", "teamLimits",
                "fixes", "seedResults", "period");
        assertThat(Json.array(done.get("plan"))).hasSize(75);
        assertThat(Json.array(done.get("violations"))).isEmpty();
        assertThat(Json.array(done.get("unplaced"))).isEmpty();
        assertThat(Json.array(done.get("fixes"))).isEmpty();
        assertThat(Json.array(done.get("levels"))).containsExactly("lastDay", "fairMoves", "fairDistance", "addedDistance", "monday", "doubleHeader");
        JSONObject metrics = Json.object(done.get("metrics"));
        assertThat(metrics).containsKeys("lastDay", "fairness", "addedDistance", "mondayGames", "doubleHeaders", "unplaced");

        // 같은 입력은 캐시에서 같은 결과
        SolveJob again = jobs.submit(problem, options(1), "1.1.1.1");
        JSONObject cached = Json.object(again.statusJson().get("done"));
        assertThat(cached.get("cached")).isEqualTo(Boolean.TRUE);
        assertThat(cached.get("plan")).isEqualTo(done.get("plan"));

        // 결과 일정을 다시 채점하면 같은 점수
        JSONObject scored = RescheduleJobs.score(problem, Json.array(done.get("plan")));
        assertThat(scored.get("scoreString")).isEqualTo(done.get("scoreString"));
    }

    @Test
    void reportsWhatDoesNotFitAndHowToFixIt() throws Exception {
        JobManager jobs = new JobManager(ServerLimits.defaults(), null, Runnable::run);
        JSONObject problem = RescheduleFixtures.problem(5, 30, "2025-09-01", "2025-09-14");
        SolveJob job = jobs.submit(problem, options(2), "1.1.1.2");
        JSONObject done = Json.object(job.statusJson().get("done"));
        JSONArray unplaced = Json.array(done.get("unplaced"));
        assertThat(unplaced).isNotEmpty();
        assertThat(Json.array(done.get("violations"))).isEmpty();
        List<String> codes = new ArrayList<>();
        for (Object o : Json.array(done.get("fixes"))) {
            JSONObject f = (JSONObject) o;
            codes.add((String) f.get("code"));
            System.out.println(f.get("text"));
        }
        assertThat(codes).isNotEmpty();
        // 엔진은 입력 값을 바꾸지 않는다
        assertThat(Json.object(done.get("period")).get("end")).isEqualTo("2025-09-14");
        // 확인된 마감일로 다시 짜면 정말 다 들어간다
        for (Object o : Json.array(done.get("fixes"))) {
            JSONObject f = (JSONObject) o;
            if ("EXTEND_END".equals(f.get("code"))) {
                JSONObject later = RescheduleFixtures.problem(5, 30, "2025-09-01", (String) f.get("value"));
                SolveJob j2 = jobs.submit(later, options(3), "1.1.1.3");
                assertThat(Json.array(Json.object(j2.statusJson().get("done")).get("unplaced"))).isEmpty();
            }
        }
    }

    @Test
    void rejectsBadInputBeforeQueueing() {
        JobManager jobs = new JobManager(ServerLimits.defaults(), null, r -> { });
        JSONObject problem = RescheduleFixtures.problem(1, 0, "2025-08-30", "2025-09-20");
        assertThatThrownBy(() -> jobs.submit(problem, options(1), "1.1.1.4")).isInstanceOf(IllegalArgumentException.class);
        assertThat(jobs.queueLength()).isZero();
    }
}
