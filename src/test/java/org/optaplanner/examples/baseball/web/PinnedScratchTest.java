package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
 * 「처음부터 새로 짜기」도 사용자가 고정한 시리즈(matches[].pinned + plan)를 그 자리에 둔다.
 * 2025 입력: 어린이날 연전(연전 기간 13) 기본 홈 두산·키움·한화·NC·롯데.
 */
class PinnedScratchTest {

    private static final BaseballSolutionInitializer.Settings FAST = new BaseballSolutionInitializer.Settings(8, 2, 2_000, 100, false);

    /** 2025 입력과 그 입력으로 만든 위반 없는 배정(시리즈 id → 연전 기간 id). */
    private static JSONObject problem;
    private static long[] feasible;

    private static synchronized void prepare() {
        if (problem != null) {
            return;
        }
        problem = BaseballApp.readJsonFile(Constants.inputFileName);
        BaseballSolution s = ProblemCodec.toSolution(problem);
        BaseballSolutionInitializer.initialize(s, 0L, FAST);
        feasible = new long[s.getMatchList().size()];
        for (Match m : s.getMatchList()) {
            feasible[m.getId().intValue()] = m.getCalendar().getId();
        }
    }

    /** feasible 배정 + 고친 자리(overrides) + 고정할 시리즈. */
    @SuppressWarnings("unchecked")
    private static JSONObject pinned(List<Integer> pins, Map<Integer, Long> overrides) {
        prepare();
        JSONObject p = (JSONObject) problem.clone();
        JSONArray matches = new JSONArray();
        JSONArray src = (JSONArray) problem.get("matches");
        for (int i = 0; i < src.size(); i++) {
            JSONObject m = (JSONObject) ((JSONObject) src.get(i)).clone();
            m.put("pinned", pins.contains(i));
            matches.add(m);
        }
        p.put("matches", matches);
        List<JSONObject> plan = new ArrayList<>();
        for (int i = 0; i < feasible.length; i++) {
            plan.add(Json.obj("match", (long) i, "calendar", overrides.getOrDefault(i, feasible[i])));
        }
        p.put("plan", Json.arr(plan));
        return p;
    }

    private static BaseballSolution applied(JSONObject p) {
        BaseballSolution s = ProblemCodec.toSolution(p);
        ProblemCodec.applyPlan(s, p, null);
        return s;
    }

    private static List<Integer> threeGameMatches(BaseballSolution s) {
        List<Integer> out = new ArrayList<>();
        for (Match m : s.getMatchList()) {
            if (m.getConsecutive() == 3) {
                out.add(m.getId().intValue());
            }
        }
        return out;
    }

    private static Match match(BaseballSolution s, int id) {
        return s.getMatchList().stream().filter(m -> m.getId() == id).findFirst().orElseThrow();
    }

    private static Calendar slot(BaseballSolution s, int index) {
        return s.getCalendarList().stream().filter(c -> c.isRegular() && c.getSlotIndex() == index).findFirst().orElseThrow();
    }

    private static void assertKept(BaseballSolution s, List<Integer> pins, long seed) {
        BendableLongScore score = ScoreFormulas.evaluate(s.getTeamList(), s.getCalendarList(), s.getMatchList());
        assertThat(score.hardScore(0)).as("seed %d score %s", seed, score).isZero();
        assertThat(score.hardScore(1)).as("seed %d score %s", seed, score).isZero();
        for (int id : pins) {
            Match m = match(s, id);
            assertThat(m.getCalendar().getId()).as("series %d", id).isEqualTo(feasible[id]);
            assertThat(m.isPinned()).as("series %d pinned", id).isTrue();
        }
    }

    /**
     * 실제 배정에서 고른 3연전 k개를 고정하고 처음부터 짠다(그런 편성이 있다는 것은 보장된다). 흩어진 고정 60개(3연전 기간 대부분에
     * 걸침)까지는 서버 기본 설정으로 짠다. 80개쯤부터는 못 찾아 「고정을 몇 개 풀어 주세요」 오류가 난다.
     */
    @Test
    void randomPinnedSeriesStayWhereTheyWere() {
        prepare();
        List<Integer> three = threeGameMatches(applied(problem));
        for (int k : new int[] {5, 20, 40, 60}) {
            List<Integer> pool = new ArrayList<>(three);
            java.util.Collections.shuffle(pool, new Random(k));
            List<Integer> pins = pool.subList(0, k);
            for (long seed : new long[] {1L, 2L}) {
                BaseballSolution s = applied(pinned(pins, Map.of()));
                ProblemCodec.checkPinnedSeries(s);
                BaseballSolutionInitializer.initialize(s, seed, k <= 20 ? FAST : BaseballSolutionInitializer.Settings.DEFAULT);
                assertKept(s, pins, seed);
                // 고정하지 않은 시리즈는 (개막·지정 기간 밖이면) 고정되지 않는다
                assertThat(s.getMatchList().stream().filter(m -> m.getConsecutive() == 3 && !pins.contains(m.getId().intValue())
                        && m.getCalendar().getHomeObligationMask() == 0)).anyMatch(m -> !m.isPinned());
            }
        }
    }

    @Test
    void everyThreeGameSeriesPinnedGivesBackThePlan() {
        prepare();
        List<Integer> pins = threeGameMatches(applied(problem));
        BaseballSolution s = applied(pinned(pins, Map.of()));
        BaseballSolutionInitializer.initialize(s, 9L, FAST);
        assertKept(s, pins, 9L);
    }

    @Test
    void pinsInsideTheChildrensDaySlotAndNextToItAreKept() {
        prepare();
        BaseballSolution base = applied(problem);
        long childrens = slot(base, 13).getId();
        long next = slot(base, 14).getId();
        List<Integer> pins = new ArrayList<>();
        for (int i = 0; i < feasible.length && pins.size() < 3; i++) {
            if (feasible[i] == childrens && pins.size() < 2 || feasible[i] == next && pins.size() == 2) {
                pins.add(i);
            }
        }
        assertThat(pins).hasSize(3);
        BaseballSolution s = applied(pinned(pins, Map.of()));
        BaseballSolutionInitializer.initialize(s, 5L, FAST);
        assertKept(s, pins, 5L);
        assertThat(s.getMatchList().stream().filter(m -> m.getCalendar() == slot(s, 13))).allMatch(Match::isPinned);
        assertThat(s.getMatchList().stream().filter(m -> m.getCalendar() == slot(s, 14))).anyMatch(m -> !m.isPinned());
    }

    /** 3연전 기간 slot 밖에 있는, 조건에 맞는 3연전 시리즈 하나. */
    private static int find(BaseballSolution s, long notAt, java.util.function.Predicate<Match> p) {
        for (Match m : s.getMatchList()) {
            if (m.getConsecutive() == 3 && feasible[m.getId().intValue()] != notAt && p.test(m)) {
                return m.getId().intValue();
            }
        }
        throw new AssertionError("no such series");
    }

    @Test
    void conflictingPinsAreClearErrors() {
        prepare();
        BaseballSolution base = applied(problem);
        long target = slot(base, 30).getId();
        // 한 구단이 한 연전 기간에 고정 시리즈 두 개
        int a = find(base, target, m -> m.getHome().getName().equals("KIA"));
        int b = find(base, target, m -> m.getAway().getName().equals("KIA"));
        assertThatThrownBy(() -> ProblemCodec.checkPinnedSeries(applied(pinned(List.of(a, b), Map.of(a, target, b, target)))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("KIA").hasMessageContaining("두 번");
        // 잠실 홈 두 개
        int d = find(base, target, m -> m.getHome().getName().equals("두산") && !m.getAway().getName().equals("LG"));
        int l = find(base, target, m -> m.getHome().getName().equals("LG") && !m.getAway().getName().equals("두산")
                && !m.getAway().equals(match(base, d).getAway()));
        assertThatThrownBy(() -> ProblemCodec.checkPinnedSeries(applied(pinned(List.of(d, l), Map.of(d, target, l, target)))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("잠실").hasMessageContaining("둘 다");
        // 잠실 두 구단 모두 원정
        int da = find(base, target, m -> m.getAway().getName().equals("두산") && !m.getHome().getName().equals("LG"));
        int la = find(base, target, m -> m.getAway().getName().equals("LG") && !m.getHome().getName().equals("두산")
                && !m.getHome().equals(match(base, da).getHome()));
        assertThatThrownBy(() -> ProblemCodec.checkPinnedSeries(applied(pinned(List.of(da, la), Map.of(da, target, la, target)))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("모두 원정");
        // 어린이날 홈 지정 구단(롯데)을 원정으로 고정
        long childrens = slot(base, 13).getId();
        int away = find(base, childrens, m -> m.getAway().getName().equals("롯데"));
        assertThatThrownBy(() -> ProblemCodec.checkPinnedSeries(applied(pinned(List.of(away), Map.of(away, childrens)))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("롯데").hasMessageContaining("홈 구장 지정");
    }

    @Test
    void pinsThatCannotBeKeptGiveAPlainMessage() throws Exception {
        prepare();
        BaseballSolution base = applied(problem);
        // 같은 두 구단의 시리즈를 이어진 두 연전 기간에 고정: 연속 대진이라 짤 수 없다
        int first = find(base, -1, m -> true);
        Match fm = match(base, first);
        int second = find(base, -1, m -> m.getId() != first && m.getHome().equals(fm.getAway()) && m.getAway().equals(fm.getHome()));
        Map<Integer, Long> at = new HashMap<>();
        at.put(first, slot(base, 30).getId());
        at.put(second, slot(base, 31).getId());
        JSONObject p = pinned(List.of(first, second), at);
        ProblemCodec.checkPinnedSeries(applied(p));
        List<Runnable> runner = new ArrayList<>();
        JobManager jobs = new JobManager(ServerLimits.defaults(), null, runner::add);
        SolveJob job = jobs.submit(p, SolveOptions.from(Json.obj("timeLimitSec", 1L, "seed", 3L, "seeds", 1L, "init", "SCRATCH"),
                ServerLimits.defaults()), "198.51.100.9");
        runner.forEach(Runnable::run);
        JSONObject error = Json.object(job.statusJson().get("error"));
        assertThat(error).as("status %s", job.statusJson()).isNotNull();
        assertThat((String) error.get("message")).contains("고정한 3연전 시리즈 2개").contains("고정을 몇 개 풀고");
    }

    @Test
    void scratchCacheKeyFollowsThreeGamePinsOnly() {
        prepare();
        List<Runnable> runner = new ArrayList<>();
        JobManager jobs = new JobManager(ServerLimits.defaults(), null, runner::add);
        SolveOptions scratch = SolveOptions.from(Json.obj("timeLimitSec", 1L, "seed", 7L, "seeds", 1L, "init", "SCRATCH"),
                ServerLimits.defaults());
        BaseballSolution base = applied(problem);
        List<Integer> opening = new ArrayList<>();
        for (Match m : base.getMatchList()) {
            if (m.getConsecutive() == 2) {
                opening.add(m.getId().intValue());
            }
        }
        List<Integer> three = threeGameMatches(base);
        String none = jobs.submit(pinned(List.of(), Map.of()), scratch, "198.51.100.10").cacheKey;
        String openingOnly = jobs.submit(pinned(opening, Map.of()), scratch, "198.51.100.11").cacheKey;
        String one = jobs.submit(pinned(List.of(three.get(0)), Map.of()), scratch, "198.51.100.12").cacheKey;
        String other = jobs.submit(pinned(List.of(three.get(1)), Map.of()), scratch, "198.51.100.13").cacheKey;
        assertThat(openingOnly).isEqualTo(none);
        assertThat(one).isNotEqualTo(none).isNotEqualTo(other);
    }
}
