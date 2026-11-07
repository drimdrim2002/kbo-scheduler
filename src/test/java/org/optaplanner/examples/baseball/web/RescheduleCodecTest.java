package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Team;
import org.optaplanner.examples.baseball.reschedule.RescheduleSolution;
import org.optaplanner.examples.baseball.reschedule.TeamHistory;
import org.optaplanner.examples.baseball.score.ScoreFormulas;

class RescheduleCodecTest {

    @SuppressWarnings("unchecked")
    @Test
    void firstRoundCancellationsKeepTravelButBreakTheRun() {
        JSONObject plain = RescheduleFixtures.problem(1, 0, "2025-09-01", "2025-09-21");
        RescheduleSolution s = RescheduleCodec.parse(plain).solution();
        BaseballSolution first = ProblemCodec.toSolution(plain);
        ProblemCodec.applyPlan(first, plain, null);
        for (Team t : first.getTeamList()) {
            TeamHistory h = s.getHistoryList().get(t.getIndex());
            ScoreFormulas.TeamSummary summary = ScoreFormulas.summarizeTeam(t, first.getMatchList());
            assertThat(h.baseMoves()).isEqualTo(summary.moveCount());
            assertThat(h.baseDistanceTenths()).isEqualTo(summary.distanceTenths());
            // 8/26(화)~8/31(일) 매일 경기
            assertThat(h.runAtStart()).as(t.getName()).isEqualTo(6);
        }
        // 8/31 경기 하나를 취소: 두 구단의 이동은 그대로, 연속 경기일은 0
        JSONObject cancelled = RescheduleFixtures.problem(1, 0, "2025-09-01", "2025-09-21");
        Object[] g = RescheduleFixtures.firstRoundGames(cancelled).stream().filter(x -> "2025-08-31".equals(x[1])).findFirst().orElseThrow();
        ((JSONArray) cancelled.get("games")).add(Json.obj("match", g[0], "date", g[1], "status", "CANCELLED"));
        JSONArray targets = (JSONArray) ((JSONObject) cancelled.get("reschedule")).get("targets");
        targets.add(Json.obj("id", "M:" + g[0] + "|" + g[1], "home", g[2], "away", g[3], "source", "CANCELLED", "match", g[0], "date", g[1]));
        RescheduleSolution c = RescheduleCodec.parse(cancelled).solution();
        for (Team t : c.getTeamList()) {
            TeamHistory before = s.getHistoryList().get(t.getIndex());
            TeamHistory after = c.getHistoryList().get(t.getIndex());
            assertThat(after.baseMoves()).isEqualTo(before.baseMoves());
            assertThat(after.baseDistanceTenths()).isEqualTo(before.baseDistanceTenths());
            assertThat(after.startLocation()).isEqualTo(before.startLocation());
            boolean involved = t.getName().equals(g[2]) || t.getName().equals(g[3]);
            assertThat(after.runAtStart()).as(t.getName()).isEqualTo(involved ? 0 : 6);
        }
        assertThat(c.getGameList()).hasSize(46);
    }

    @Test
    void rejectsAStartInsideTheFirstRound() {
        assertThatThrownBy(() -> RescheduleCodec.parse(RescheduleFixtures.problem(1, 0, "2025-08-31", "2025-09-21")))
                .hasMessageContaining("1차 편성이 끝난 다음 날(9/1)부터");
    }

    @SuppressWarnings("unchecked")
    @Test
    void rejectsMissingOrUnmarkedTargets() {
        JSONObject p = RescheduleFixtures.problem(2, 3, "2025-09-01", "2025-09-21");
        JSONArray targets = (JSONArray) ((JSONObject) p.get("reschedule")).get("targets");
        targets.remove(0);
        assertThatThrownBy(() -> RescheduleCodec.parse(p)).hasMessageContaining("취소한 경기가 배정 대상에 빠져 있습니다");

        JSONObject q = RescheduleFixtures.problem(2, 0, "2025-09-01", "2025-09-21");
        JSONArray qt = (JSONArray) ((JSONObject) q.get("reschedule")).get("targets");
        qt.remove(qt.size() - 1);
        assertThatThrownBy(() -> RescheduleCodec.parse(q)).hasMessageContaining("16경기가 되지 않습니다(지금 15경기)");
    }

    @SuppressWarnings("unchecked")
    @Test
    void announcedGamesArePinnedAndCancelledOnesComeBack() {
        JSONObject p = RescheduleFixtures.problem(3, 2, "2025-09-08", "2025-09-28");
        JSONObject rs = (JSONObject) p.get("reschedule");
        JSONArray targets = (JSONArray) rs.get("targets");
        String a = Json.asString(((JSONObject) targets.get(0)).get("id"), "");
        String b = Json.asString(((JSONObject) targets.get(1)).get("id"), "");
        String c = Json.asString(((JSONObject) targets.get(2)).get("id"), "");
        JSONArray plan = new JSONArray();
        plan.add(Json.obj("game", a, "date", "2025-09-03"));     // 기간 앞, 치른 경기
        plan.add(Json.obj("game", b, "date", "2025-09-05"));     // 기간 앞, 다시 취소
        plan.add(Json.obj("game", c, "date", "2025-09-10"));     // 발표한 경기
        rs.put("plan", plan);
        ((JSONArray) p.get("games")).add(Json.obj("game", b, "date", "2025-09-05", "status", "CANCELLED"));
        RescheduleCodec.Parsed parsed = RescheduleCodec.parse(p);
        List<String> keys = parsed.solution().getGameList().stream().map(g -> g.getKey()).toList();
        assertThat(keys).doesNotContain(a).contains(b, c);
        assertThat(parsed.solution().getGameList().stream().filter(g -> g.getKey().equals(c)).findFirst().orElseThrow().isPinned()).isTrue();
        assertThat(parsed.solution().getGameList().stream().filter(g -> g.getKey().equals(b)).findFirst().orElseThrow().getDay()).isNull();
        assertThat(parsed.played()).hasSize(1);
    }
}
