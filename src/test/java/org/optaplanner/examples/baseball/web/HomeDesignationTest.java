package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
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
 * 홈 구장 지정(problem.events[] STADIUM) → 연전 기간별 홈 의무 구단. 초기해가 지키고, 잘못된 지정은 400(IllegalArgumentException)이다.
 * 2025 입력: 개막 2연전(3/22) 홈 LG·SSG·KT·삼성·KIA, 어린이날 연전(5/5) 기본 홈 두산·키움·한화·NC·롯데.
 */
class HomeDesignationTest {

    private static final List<String> OPENING_HOMES = List.of("LG", "SSG", "KT", "삼성", "KIA");
    private static final List<String> CHILDREN_HOMES = List.of("두산", "키움", "한화", "NC", "롯데");

    private static JSONObject problem(JSONObject... events) {
        JSONObject p = BaseballApp.readJsonFile(Constants.inputFileName);
        List<JSONObject> list = new ArrayList<>(List.of(events));
        p.put("events", Json.arr(list));
        return p;
    }

    private static JSONObject stadiumEvent(String type, String date, List<String> teams, String fix) {
        return Json.obj("id", "ev-" + date, "type", type, "name", type, "date", date, "mode", "STADIUM",
                "teams", Json.arr(teams), "fix", fix);
    }

    private static List<String> homes(BaseballSolution solution, int slot) {
        List<String> out = new ArrayList<>();
        for (Match m : solution.getMatchList()) {
            if (m.getCalendar() != null && m.getCalendar().isRegular() && m.getCalendar().getSlotIndex() == slot) {
                out.add(m.getHome().getName());
            }
        }
        return out;
    }

    private static Calendar slot(BaseballSolution solution, int index) {
        return solution.getCalendarList().stream().filter(c -> c.isRegular() && c.getSlotIndex() == index).findFirst()
                .orElseThrow();
    }

    private static BendableLongScore initialize(BaseballSolution solution, long seed) {
        BaseballSolutionInitializer.initialize(solution, seed,
                new BaseballSolutionInitializer.Settings(8, 2, 2_000, 100, false));
        return ScoreFormulas.evaluate(solution.getTeamList(), solution.getCalendarList(), solution.getMatchList());
    }

    @Test
    void withoutEventsTheChildrensDaySlotGetsTheDefaultHomes() {
        BaseballSolution solution = ProblemCodec.toSolution(BaseballApp.readJsonFile(Constants.inputFileName));
        assertThat(ProblemCodec.homeDesignations(solution)).containsOnlyKeys("2025-05-05");
        assertThat(ProblemCodec.childrenDayTeams(solution)).containsExactlyInAnyOrderElementsOf(CHILDREN_HOMES);
    }

    @Test
    void legacyObligationTeamsStillWorkWithoutEvents() {
        JSONObject p = BaseballApp.readJsonFile(Constants.inputFileName);
        List<String> other = List.of("LG", "SSG", "KT", "삼성", "KIA");
        p.put("settings", Json.obj("obligationTeams", Json.arr(other)));
        BaseballSolution solution = ProblemCodec.toSolution(p);
        assertThat(ProblemCodec.childrenDayTeams(solution)).containsExactlyInAnyOrderElementsOf(other);
        assertThat(initialize(solution, 3L).hardScore(0)).isZero();
        assertThat(homes(solution, 13)).containsExactlyInAnyOrderElementsOf(other);
    }

    @Test
    void openingHomeOnlyAndChildrensDayAreBothKept() {
        JSONObject p = problem(stadiumEvent("OPENING", "2025-03-22", OPENING_HOMES, "home"),
                stadiumEvent("CHILDREN", "2025-05-05", CHILDREN_HOMES, "home"));
        BaseballSolution solution = ProblemCodec.toSolution(p);
        assertThat(ProblemCodec.homeDesignations(solution)).containsOnlyKeys("2025-03-22", "2025-05-05");
        BendableLongScore score = initialize(solution, 1L);
        assertThat(score.hardScore(0)).as("score %s", score).isZero();
        assertThat(homes(solution, 0)).containsExactlyInAnyOrderElementsOf(OPENING_HOMES);
        assertThat(homes(solution, 13)).containsExactlyInAnyOrderElementsOf(CHILDREN_HOMES);
    }

    @Test
    void anyDateInsideTheSeriesFindsTheSlot() {
        // 5/6은 5/5~7 연전 기간 안
        BaseballSolution solution = ProblemCodec.toSolution(problem(stadiumEvent("CHILDREN", "2025-05-06", CHILDREN_HOMES, null)));
        assertThat(ProblemCodec.homeDesignations(solution)).containsOnlyKeys("2025-05-05");
    }

    @Test
    void partialAndSeveralDesignatedSlotsAreKeptByTheInitializer() {
        JSONObject p = problem(stadiumEvent("CHILDREN", "2025-05-05", List.of("두산", "한화", "롯데"), "home"),
                stadiumEvent("CUSTOM", "2025-06-06", List.of("KIA", "NC"), "home"),
                stadiumEvent("CUSTOM", "2025-05-23", List.of("SSG", "LG", "KT", "삼성", "롯데"), "home"));
        BaseballSolution solution = ProblemCodec.toSolution(p);
        BendableLongScore score = initialize(solution, 7L);
        assertThat(score.hardScore(0)).as("score %s", score).isZero();
        assertThat(score.hardScore(1)).isZero();
        assertThat(homes(solution, 13)).contains("두산", "한화", "롯데");
        assertThat(homes(solution, 22)).contains("KIA", "NC");
        assertThat(homes(solution, 18)).containsExactlyInAnyOrder("SSG", "LG", "KT", "삼성", "롯데");
        for (int s : new int[] {0, 13, 18, 22}) {
            assertThat(solution.getMatchList().stream().filter(m -> m.getCalendar() == slot(solution, s)))
                    .as("slot %d pinned", s).allMatch(Match::isPinned);
        }
    }

    @Test
    void noDesignationAtAllStillInitializes() {
        JSONObject p = problem(Json.obj("id", "x", "type", "CUSTOM", "name", "빈 지정", "date", "2025-06-06",
                "mode", "STADIUM", "teams", new JSONArray()));
        BaseballSolution solution = ProblemCodec.toSolution(p);
        assertThat(ProblemCodec.homeDesignations(solution)).isEmpty();
        assertThat(ProblemCodec.childrenDayTeams(solution)).isEmpty();
        assertThat(initialize(solution, 2L).hardScore(0)).isZero();
    }

    @Test
    void childrensDayPrefersLegacyObligationTeamsUnlessPartial() {
        List<String> shared = List.of("LG", "키움", "한화", "NC", "롯데");
        JSONObject full = problem(stadiumEvent("CHILDREN", "2025-05-05", CHILDREN_HOMES, null));
        full.put("settings", Json.obj("obligationTeams", Json.arr(shared)));
        assertThat(ProblemCodec.childrenDayTeams(ProblemCodec.toSolution(full))).containsExactlyInAnyOrderElementsOf(shared);

        JSONObject partial = problem(stadiumEvent("CHILDREN", "2025-05-05", List.of("두산", "키움"), null));
        partial.put("settings", Json.obj("obligationTeams", Json.arr(shared)));
        assertThat(ProblemCodec.childrenDayTeams(ProblemCodec.toSolution(partial))).containsExactlyInAnyOrder("두산", "키움");
    }

    @Test
    void pairsFixedEventsAreObligationsToo() {
        JSONObject ev = Json.obj("id", "o", "type", "OPENING", "name", "개막전", "date", "2025-03-22", "mode", "STADIUM",
                "fix", "pairs", "pairs", Json.arr(List.of(Json.obj("home", "LG", "away", "롯데"))));
        BaseballSolution solution = ProblemCodec.toSolution(problem(ev));
        assertThat(ProblemCodec.homeDesignations(solution)).containsOnlyKeys("2025-03-22");
    }

    @Test
    void invalidDesignationsAreClearErrors() {
        assertThatThrownBy(() -> ProblemCodec.toSolution(problem(stadiumEvent("CUSTOM", "2025-06-06", List.of("LG", "없는구단"), null))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("모르는 구단").hasMessageContaining("없는구단");
        assertThatThrownBy(() -> ProblemCodec.toSolution(problem(stadiumEvent("CUSTOM", "2025-06-06",
                List.of("SSG", "LG", "KT", "삼성", "KIA", "NC"), null))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("5곳까지");
        assertThatThrownBy(() -> ProblemCodec.toSolution(problem(stadiumEvent("CUSTOM", "2025-06-06", List.of("두산", "LG"), null))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("잠실종합운동장").hasMessageContaining("같이");
        // 개막 2연전 홈은 LG·SSG·KT·삼성·KIA뿐 — 두산 홈 2연전 시리즈가 없다
        assertThatThrownBy(() -> ProblemCodec.toSolution(problem(stadiumEvent("OPENING", "2025-03-22", List.of("두산"), "home"))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("두산의 2연전 홈 시리즈가 없습니다");
        assertThatThrownBy(() -> ProblemCodec.toSolution(problem(stadiumEvent("CUSTOM", "2025-06-06",
                List.of("SSG", "KT", "삼성", "KIA", "NC"), null))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("두산·LG");
        // 두 이벤트가 한 연전 기간에 겹치면 합쳐서 본다
        assertThatThrownBy(() -> ProblemCodec.toSolution(problem(stadiumEvent("CHILDREN", "2025-05-05", CHILDREN_HOMES, null),
                stadiumEvent("CUSTOM", "2025-05-07", List.of("KIA"), null))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("6구단");
    }

    @Test
    void cacheKnobsFollowTheResolvedDesignations() {
        JSONObject a = problem(stadiumEvent("CHILDREN", "2025-05-05", CHILDREN_HOMES, null));
        JSONObject b = problem(stadiumEvent("CHILDREN", "2025-05-05", CHILDREN_HOMES, null),
                stadiumEvent("OPENING", "2025-03-22", OPENING_HOMES, "home"));
        assertThat(JobManager.knobsWithDefaults(a).get("homeDesignations"))
                .isNotEqualTo(JobManager.knobsWithDefaults(b).get("homeDesignations"));
        // 예전 입력(이벤트 없음)과 어린이날 기본값 이벤트는 같은 지정
        assertThat(JobManager.knobsWithDefaults(BaseballApp.readJsonFile(Constants.inputFileName)).get("homeDesignations"))
                .isEqualTo(JobManager.knobsWithDefaults(a).get("homeDesignations"));
    }
}
