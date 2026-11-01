package org.optaplanner.examples.baseball.score;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.Reader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.TimeUnit;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.core.api.score.stream.ConstraintStreamImplType;
import org.optaplanner.core.api.solver.Solver;
import org.optaplanner.core.api.solver.SolverFactory;
import org.optaplanner.core.config.localsearch.LocalSearchPhaseConfig;
import org.optaplanner.core.config.score.director.ScoreDirectorFactoryConfig;
import org.optaplanner.core.config.solver.EnvironmentMode;
import org.optaplanner.core.config.solver.SolverConfig;
import org.optaplanner.core.config.solver.termination.TerminationConfig;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Constants;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.Team;
import org.optaplanner.examples.baseball.solver.BaseballSolutionInitializer;
import org.optaplanner.test.api.score.stream.ConstraintVerifier;

class BaseballScoreParityTest {

    private final ConstraintVerifier<BaseballConstraintProvider, BaseballSolution> verifier =
            ConstraintVerifier.build(new BaseballConstraintProvider(), BaseballSolution.class, Match.class)
                    .withConstraintStreamImplType(ConstraintStreamImplType.BAVET);

    @Test
    void handBuiltSolutionMatchesExpectedScore() {
        Team home = new Team(0L, "A", "사직", distances("A", "B", "10.0"));
        Team away = new Team(1L, "B", "잠실", distances("B", "A", "10.0"));
        List<Team> teams = Team.prepareIndices(List.of(home, away));

        Calendar day0 = new Calendar(0L, LocalDateTime.of(2025, 3, 22, 0, 0), 3, 0, 2);
        Calendar day1 = new Calendar(1L, LocalDateTime.of(2025, 3, 25, 0, 0), 3, 0, 0);
        Calendar dummy = new Calendar(9999L, LocalDateTime.of(2100, 12, 31, 0, 0), 0, 0, 0);
        day1.setPrev(day0);
        day0.setNext(day1);
        dummy.setPrev(day1);
        day1.setNext(dummy);

        Match first = new Match(0L, home, away, 3);
        first.setCalendar(day0);
        Match second = new Match(1L, away, home, 3);
        second.setCalendar(day1);
        Match unassigned = new Match(2L, home, away, 3);
        unassigned.setCalendar(dummy);

        BaseballSolution solution = new BaseballSolution();
        solution.setId(0L);
        solution.setTeamList(teams);
        solution.setCalendarList(List.of(day0, day1, dummy));
        solution.setMatchList(List.of(first, second, unassigned));

        // Two regular days contribute |2-10|+|1-5|+|1-5| = 16 each. Day 1 repeats the matchup.
        // The dummy series is unassigned only. Each team travels one 10 km leg.
        BendableLongScore expected = BendableLongScore.of(
                new long[] {-32L, -1L},
                new long[] {-1L, 0L, 0L, 0L, -20L});
        BendableLongScore easy = new BaseballEasyScoreCalculator().calculateScore(solution);
        assertThat(easy).isEqualTo(expected);
        verifier.verifyThat().givenSolution(solution).scores(expected);
    }

    @Test
    void unassigned2025InputScoresAgree() throws Exception {
        BaseballSolution solution = load2025();
        assertThat(solution.getMatchList()).extracting(Match::getCalendar).containsOnlyNulls();

        BendableLongScore easy = new BaseballEasyScoreCalculator().calculateScore(solution);
        assertThat(easy.hardScore(0)).isZero();
        assertThat(easy.hardScore(1)).isZero();
        assertThat(easy.softScore(0)).isEqualTo(-solution.getMatchList().size());
        assertProviderAgrees(solution, easy);
    }

    @Test
    void roundRobinThenDummy2025InputScoresAgree() throws Exception {
        BaseballSolution solution = load2025();
        List<Calendar> regular = solution.getCalendarList().stream().filter(Calendar::isRegular).toList();
        assertThat(regular).isNotEmpty();
        List<Match> matches = solution.getMatchList();
        assertThat(matches.size()).isGreaterThanOrEqualTo(30);
        for (int i = 0; i < matches.size(); i++) {
            matches.get(i).setCalendar(regular.get(i % regular.size()));
        }
        BendableLongScore assigned = new BaseballEasyScoreCalculator().calculateScore(solution);
        assertProviderAgrees(solution, assigned);

        Calendar dummy = solution.getCalendarList().stream().filter(Calendar::isDummy).findFirst().orElseThrow();
        for (int i = 0; i < 30; i++) {
            matches.get(i).setCalendar(dummy);
        }
        BendableLongScore partlyDummy = new BaseballEasyScoreCalculator().calculateScore(solution);
        assertProviderAgrees(solution, partlyDummy);
    }

    /**
     * Runs the XML move selectors (full-round pillar swap, Kempe chain, round block) under FULL_ASSERT.
     * The assertion director recalculates every move with {@link BaseballEasyScoreCalculator}.
     * Score corruption fails the solve before this method returns.
     */
    @Test
    @Timeout(value = 4, unit = TimeUnit.MINUTES)
    void fullAssertSolverOn2025InitialPlanHasNoScoreCorruption() throws Exception {
        BaseballSolution solution = load2025WithInitialPlan();
        assertThat(solution.getMatchList().stream().filter(match -> match.getCalendar() != null).count()).isPositive();

        BaseballSolution solved = solveFullAssert(solution, 100);

        BendableLongScore solvedScore = solved.getBendableLongScore();
        BendableLongScore easy = new BaseballEasyScoreCalculator().calculateScore(solved);
        assertThat(solvedScore).isNotNull();
        assertThat(solvedScore.withInitScore(0)).isEqualTo(easy);
    }

    @Test
    void constructedInitialSolutionIsFeasibleDeterministicAndPinsOpeningAndChildrensDay() throws Exception {
        BaseballSolution shuffled = load2025();
        List<Long> originalOrder = matchIds(shuffled);
        Collections.shuffle(shuffled.getMatchList(), new Random(20250322L));
        assertThat(matchIds(shuffled)).isNotEqualTo(originalOrder);

        BaseballSolution canonical = load2025();
        BaseballSolutionInitializer.initialize(shuffled);
        BaseballSolutionInitializer.initialize(canonical);

        assertFeasibleInitialSolution(shuffled);
        assertThat(calendarByMatchId(shuffled)).isEqualTo(calendarByMatchId(canonical));
        assertThat(pinnedByMatchId(shuffled)).isEqualTo(pinnedByMatchId(canonical));
    }

    /**
     * Local search starts from the constructed feasible solution. FULL_ASSERT recalculates every
     * move with {@link BaseballEasyScoreCalculator}. An improving best score shows the search can
     * move without score corruption.
     */
    @Test
    @Timeout(value = 4, unit = TimeUnit.MINUTES)
    void fullAssertSolverOnConstructedInitialSolutionImprovesSoftScore() throws Exception {
        BaseballSolution solution = load2025();
        BaseballSolutionInitializer.initialize(solution);
        BendableLongScore initial = new BaseballEasyScoreCalculator().calculateScore(solution);
        assertThat(initial.hardScore(0)).isZero();
        assertThat(initial.hardScore(1)).isZero();
        assertThat(initial.softScore(0)).isZero();
        Map<Long, Long> pinnedCalendars = new HashMap<>();
        for (Match match : solution.getMatchList()) {
            if (match.isPinned()) {
                pinnedCalendars.put(match.getId(), match.getCalendar().getId());
            }
        }
        assertThat(pinnedCalendars).hasSize(10);

        BaseballSolution solved = solveFullAssert(solution, 100);
        BendableLongScore solvedScore = solved.getBendableLongScore();
        BendableLongScore easy = new BaseballEasyScoreCalculator().calculateScore(solved);
        assertThat(solvedScore).isNotNull();
        assertThat(solvedScore.withInitScore(0)).isEqualTo(easy);
        assertThat(solvedScore.hardScore(0)).isZero();
        assertThat(solvedScore.hardScore(1)).isZero();
        assertThat(solvedScore.softScore(0)).isZero();
        assertThat(solvedScore.compareTo(initial)).isGreaterThan(0);
        for (Match match : solved.getMatchList()) {
            Long pinnedCalendarId = pinnedCalendars.get(match.getId());
            if (pinnedCalendarId != null) {
                assertThat(match.isPinned()).isTrue();
                assertThat(match.getCalendar().getId()).isEqualTo(pinnedCalendarId);
            }
        }
    }

    private void assertFeasibleInitialSolution(BaseballSolution solution) {
        List<Match> matches = solution.getMatchList();
        assertThat(matches).hasSize(225);
        assertThat(matches).allMatch(match -> match.getCalendar() != null && match.getCalendar().isRegular());

        BendableLongScore easy = new BaseballEasyScoreCalculator().calculateScore(solution);
        assertThat(easy.hardScore(0)).as("score %s", easy).isZero();
        assertThat(easy.hardScore(1)).as("score %s", easy).isZero();
        assertThat(easy.softScore(0)).as("score %s", easy).isZero();
        assertProviderAgrees(solution, easy);

        Map<Long, List<Match>> bySlot = new HashMap<>();
        for (Match match : matches) {
            bySlot.computeIfAbsent(match.getCalendar().getId(), key -> new ArrayList<>()).add(match);
        }
        assertThat(bySlot).hasSize(45);
        assertThat(bySlot.values()).allMatch(slot -> slot.size() == 5);

        List<Match> pinned = matches.stream().filter(Match::isPinned).toList();
        assertThat(pinned).hasSize(10);
        assertThat(pinned).allMatch(BaseballScoreParityTest::isOpeningOrChildrensDay);
        List<Match> opening = matches.stream().filter(BaseballScoreParityTest::isOpeningDay).toList();
        List<Match> children = matches.stream().filter(match -> match.getCalendar().getHomeObligationMask() != 0
                && match.getConsecutive() == 3).toList();
        assertThat(opening).hasSize(5).allMatch(Match::isPinned);
        assertThat(children).hasSize(5).allMatch(Match::isPinned);
        assertThat(opening).allMatch(match -> match.getCalendar().getSlotIndex() == 0 && match.getConsecutive() == 2);
        assertThat(children).allMatch(match -> match.getCalendar().getSlotIndex() == 13 && match.getConsecutive() == 3);
        assertThat(children).extracting(match -> match.getHome().getName())
                .containsExactlyInAnyOrder(Constants.HOME_OBLIGATION_CHILDREN_ARR);
        List<Match> fourGame = matches.stream().filter(match -> match.getConsecutive() == 4).toList();
        assertThat(fourGame).hasSize(5).allMatch(match -> !match.isPinned() && match.getCalendar().getSlotIndex() == 32);
    }

    private static boolean isOpeningDay(Match match) {
        return match.getCalendar().getStartTime().toLocalDate().toString().equals(Constants.MATCH_START_DATE);
    }

    private static boolean isOpeningOrChildrensDay(Match match) {
        return isOpeningDay(match) || match.getCalendar().getSlotIndex() == 13;
    }

    private static List<Long> matchIds(BaseballSolution solution) {
        return solution.getMatchList().stream().map(Match::getId).toList();
    }

    private static Map<Long, Long> calendarByMatchId(BaseballSolution solution) {
        Map<Long, Long> calendars = new HashMap<>();
        for (Match match : solution.getMatchList()) {
            calendars.put(match.getId(), match.getCalendar().getId());
        }
        return calendars;
    }

    private static Map<Long, Boolean> pinnedByMatchId(BaseballSolution solution) {
        Map<Long, Boolean> pinned = new HashMap<>();
        for (Match match : solution.getMatchList()) {
            pinned.put(match.getId(), match.isPinned());
        }
        return pinned;
    }

    private static BaseballSolution solveFullAssert(BaseballSolution solution, int stepCountLimit) {
        SolverConfig config = SolverConfig.createFromXmlResource(
                "org/optaplanner/examples/baseball/solver/baseballSolverConfig.xml");
        config.setEnvironmentMode(EnvironmentMode.FULL_ASSERT);
        boolean limitedPhase = false;
        if (config.getPhaseConfigList() != null) {
            for (var phase : config.getPhaseConfigList()) {
                if (phase instanceof LocalSearchPhaseConfig localSearch) {
                    // StepCountTermination is phase-only. Solver-level termination stays the XML limit.
                    localSearch.setTerminationConfig(new TerminationConfig().withStepCountLimit(stepCountLimit));
                    limitedPhase = true;
                }
            }
        }
        assertThat(limitedPhase).isTrue();
        config.getScoreDirectorFactoryConfig().setAssertionScoreDirectorFactory(
                new ScoreDirectorFactoryConfig().withEasyScoreCalculatorClass(BaseballEasyScoreCalculator.class));

        Solver<BaseballSolution> solver = SolverFactory.<BaseballSolution>create(config).buildSolver();
        return solver.solve(solution);
    }

    private void assertProviderAgrees(BaseballSolution solution, BendableLongScore easy) {
        int uninitialized = 0;
        for (Match match : solution.getMatchList()) {
            if (match.getCalendar() == null) {
                uninitialized++;
            }
        }
        // The director applies a negative init score for null calendars. The calculator leaves init at 0.
        verifier.verifyThat().givenSolution(solution).scores(easy.withInitScore(-uninitialized));
    }

    private static BaseballSolution load2025() throws Exception {
        return load2025(false);
    }

    private static BaseballSolution load2025WithInitialPlan() throws Exception {
        return load2025(true);
    }

    private static BaseballSolution load2025(boolean applyInitialPlan) throws Exception {
        try (Reader reader = Files.newBufferedReader(Path.of("data/baseball/input_2025.json"), StandardCharsets.UTF_8)) {
            JSONObject json = (JSONObject) new JSONParser().parse(reader);
            BaseballSolution solution = BaseballApp.makeSolution(json);
            if (applyInitialPlan) {
                BaseballApp.setInitialPlan(json, solution);
            }
            assertThat(solution.getTeamList()).isNotEmpty();
            return solution;
        }
    }

    private static HashMap<String, BigDecimal> distances(String self, String other, String kilometers) {
        HashMap<String, BigDecimal> distances = new HashMap<>();
        distances.put(self, BigDecimal.ZERO);
        distances.put(other, new BigDecimal(kilometers));
        return distances;
    }
}
