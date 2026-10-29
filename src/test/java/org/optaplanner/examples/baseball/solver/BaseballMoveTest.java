package org.optaplanner.examples.baseball.solver;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Random;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.core.api.solver.SolverFactory;
import org.optaplanner.core.config.score.director.ScoreDirectorFactoryConfig;
import org.optaplanner.core.config.solver.SolverConfig;
import org.optaplanner.core.config.solver.termination.TerminationConfig;
import org.optaplanner.core.impl.heuristic.move.Move;
import org.optaplanner.core.impl.score.director.InnerScoreDirector;
import org.optaplanner.core.impl.solver.DefaultSolverFactory;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.Team;
import org.optaplanner.examples.baseball.score.BaseballConstraintProvider;
import org.optaplanner.examples.baseball.score.BaseballEasyScoreCalculator;

class BaseballMoveTest {

    @Test
    void orOptInsertsABlockAndLeavesAReversalOfTheEndsToPillarSwap() {
        int[] segment = {1, 2, 3, 4, 5};
        assertThat(RoundNeighborhood.orOpt(segment, 1, 1, 4)).containsExactly(1, 3, 4, 5, 2);
        assertThat(RoundNeighborhood.orOpt(segment, 0, 2, 0)).containsExactly(1, 2, 3, 4, 5);
        assertThat(RoundNeighborhood.reversed(segment, 0, 3)).containsExactly(4, 3, 2, 1, 5);
    }

    @Test
    void kempeCycleKeepsOneSharedStadiumAndRejectsADouble() {
        BaseballSolution solution = twoCycleFixture();
        BendableLongScore initial = new BaseballEasyScoreCalculator().calculateScore(solution);
        assertThat(initial.hardScore(0)).as("score %s", initial).isZero();
        assertThat(initial.hardScore(1)).as("score %s", initial).isZero();

        RoundNeighborhood neighborhood = RoundNeighborhood.of(solution);
        List<SeriesReassignmentMove> betweenEnds = neighborhood.structuralKempe(0, 2);
        assertThat(betweenEnds).hasSize(3);

        int preserved = 0;
        int rejected = 0;
        for (SeriesReassignmentMove move : betweenEnds) {
            boolean filter = move.preserves(solution);
            BendableLongScore after = scoreApplied(solution, move);
            boolean feasible = after.hardScore(0) == 0L && after.hardScore(1) == 0L;
            assertThat(filter).as("%s -> %s", move, after).isEqualTo(feasible);
            if (feasible) {
                preserved++;
            } else {
                rejected++;
            }
        }
        assertThat(preserved).isEqualTo(1);
        assertThat(rejected).isEqualTo(2);
    }

    @Test
    @Timeout(120)
    void constructedMovesMatchTheHardScoreAndUndoRestoresIt() throws Exception {
        BaseballSolution solution = load2025();
        BaseballSolutionInitializer.initialize(solution, 0L,
                new BaseballSolutionInitializer.Settings(8, 2, 0, 1, true));
        RoundNeighborhood neighborhood = RoundNeighborhood.of(solution);
        assertThat(neighborhood.segments.length).isEqualTo(3);
        assertThat(neighborhood.segments[0]).containsExactly(range(1, 12));
        assertThat(neighborhood.segments[1]).containsExactly(range(14, 31));
        assertThat(neighborhood.segments[2]).containsExactly(range(33, 44));

        List<SeriesReassignmentMove> kempe = neighborhood.structuralKempeMoves();
        List<SeriesReassignmentMove> blocks = neighborhood.structuralBlockMoves();
        assertFilterAgrees(solution, kempe, true);
        assertFilterAgrees(solution, blocks, false);

        SeriesReassignmentMove kempeMove = neighborhood.feasibleKempeMoves().get(0);
        SeriesReassignmentMove blockMove = neighborhood.feasibleBlockMoves().get(0);
        assertPinnedSlotsStay(kempeMove);
        assertPinnedSlotsStay(blockMove);
        assertDirectorUndoRestores(solution, kempeMove);
        assertDirectorUndoRestores(solution, blockMove);

        KempeChainMoveIteratorFactory kempeFactory = new KempeChainMoveIteratorFactory();
        RoundBlockMoveIteratorFactory blockFactory = new RoundBlockMoveIteratorFactory();
        try (InnerScoreDirector<BaseballSolution, BendableLongScore> director = director(solution)) {
            assertThat(kempeFactory.getSize(director)).isPositive();
            assertThat(blockFactory.getSize(director)).isPositive();
            SeriesReassignmentMove sampled = kempeFactory.createRandomMoveIterator(director, new Random(1)).next();
            assertThat(sampled.isMoveDoable(director)).isTrue();
            sampled = blockFactory.createRandomMoveIterator(director, new Random(1)).next();
            assertThat(sampled.isMoveDoable(director)).isTrue();
        }
    }

    /** 홈 구장 지정 기간(어린이날)을 고정하지 않고 보내면 그 기간도 움직이되, 지정 구단을 원정으로 보내는 이동은 거른다. */
    @Test
    @Timeout(120)
    void unpinnedHomeDesignatedSlotMovesOnlyWhileTheDesignatedTeamsStayHome() throws Exception {
        BaseballSolution solution = load2025();
        BaseballSolutionInitializer.initialize(solution, 0L,
                new BaseballSolutionInitializer.Settings(8, 2, 0, 1, true));
        Calendar children = solution.getCalendarList().get(13);
        assertThat(children.getHomeObligationMask()).isNotZero();
        for (Match match : solution.getMatchList()) {
            if (match.getCalendar() == children) {
                match.setPinned(false);
            }
        }
        RoundNeighborhood neighborhood = RoundNeighborhood.of(solution);
        assertThat(neighborhood.movable[13]).isTrue();
        List<SeriesReassignmentMove> touching = new ArrayList<>();
        for (int other : neighborhood.movableSlots) {
            if (other != 13) {
                touching.addAll(neighborhood.structuralKempe(Math.min(13, other), Math.max(13, other)));
            }
        }
        assertFilterAgrees(solution, touching, true);
        int obligationRejected = 0;
        for (SeriesReassignmentMove move : touching) {
            List<Match> moved = move.matches();
            long designatedAway = 0L;
            for (int i = 0; i < moved.size(); i++) {
                if (move.targets().get(i) == children && children.requiresHome(moved.get(i).getAway())) {
                    designatedAway++;
                }
            }
            if (designatedAway > 0) {
                assertThat(move.preserves(solution)).as("%s", move).isFalse();
                obligationRejected++;
            }
        }
        assertThat(obligationRejected).isPositive();
    }

    private static void assertFilterAgrees(BaseballSolution solution, List<SeriesReassignmentMove> moves,
            boolean expectRejections) {
        BaseballEasyScoreCalculator calculator = new BaseballEasyScoreCalculator();
        int accepted = 0;
        int rejected = 0;
        for (SeriesReassignmentMove move : moves) {
            boolean filter = move.preserves(solution);
            BendableLongScore after = scoreApplied(solution, move);
            boolean feasible = after.hardScore(0) == 0L && after.hardScore(1) == 0L && after.softScore(0) == 0L;
            assertThat(filter).as("%s -> %s", move, after).isEqualTo(feasible);
            if (feasible) {
                accepted++;
            } else {
                rejected++;
            }
        }
        assertThat(accepted).isPositive();
        if (expectRejections) {
            assertThat(rejected).isPositive();
        }
    }

    private static BendableLongScore scoreApplied(BaseballSolution solution, SeriesReassignmentMove move) {
        List<Match> matches = move.matches();
        Calendar[] previous = new Calendar[matches.size()];
        for (int i = 0; i < matches.size(); i++) {
            previous[i] = matches.get(i).getCalendar();
        }
        try {
            for (int i = 0; i < matches.size(); i++) {
                matches.get(i).setCalendar(move.targets().get(i));
            }
            return new BaseballEasyScoreCalculator().calculateScore(solution);
        } finally {
            for (int i = 0; i < matches.size(); i++) {
                matches.get(i).setCalendar(previous[i]);
            }
        }
    }

    private static void assertPinnedSlotsStay(SeriesReassignmentMove move) {
        for (Match match : move.matches()) {
            assertThat(match.isPinned()).isFalse();
            assertThat(match.getCalendar().getSlotIndex()).isNotIn(0, 13, 32);
        }
        for (Calendar target : move.targets()) {
            assertThat(target.getSlotIndex()).isNotIn(0, 13, 32);
        }
    }

    private static void assertDirectorUndoRestores(BaseballSolution solution, SeriesReassignmentMove move) {
        BendableLongScore easyBefore = new BaseballEasyScoreCalculator().calculateScore(solution);
        try (InnerScoreDirector<BaseballSolution, BendableLongScore> director = director(solution)) {
            BendableLongScore before = director.calculateScore();
            assertThat(before.withInitScore(0)).isEqualTo(easyBefore);
            assertThat(move.isMoveDoable(director)).isTrue();
            Move<BaseballSolution> undo = move.doMove(director);
            BendableLongScore after = director.calculateScore();
            BendableLongScore easyAfter = new BaseballEasyScoreCalculator().calculateScore(solution);
            assertThat(after.withInitScore(0)).isEqualTo(easyAfter);
            assertThat(after.hardScore(0)).isZero();
            assertThat(after.hardScore(1)).isZero();
            undo.doMove(director);
            BendableLongScore restored = director.calculateScore();
            assertThat(restored).isEqualTo(before);
        }
        assertThat(new BaseballEasyScoreCalculator().calculateScore(solution)).isEqualTo(easyBefore);
    }

    private static InnerScoreDirector<BaseballSolution, BendableLongScore> director(BaseballSolution solution) {
        SolverConfig config = new SolverConfig()
                .withSolutionClass(BaseballSolution.class)
                .withEntityClasses(Match.class)
                .withScoreDirectorFactory(new ScoreDirectorFactoryConfig()
                        .withConstraintProviderClass(BaseballConstraintProvider.class))
                .withTerminationConfig(new TerminationConfig().withMillisecondsSpentLimit(1L));
        DefaultSolverFactory<BaseballSolution> factory =
                (DefaultSolverFactory<BaseballSolution>) SolverFactory.<BaseballSolution>create(config);
        InnerScoreDirector<BaseballSolution, BendableLongScore> director =
                factory.<BendableLongScore>getScoreDirectorFactory().buildScoreDirector();
        director.setWorkingSolution(solution);
        return director;
    }

    /**
     * Three 3-game rounds. Slots 0 and 2 share one pair, so their union has a 2-cycle, a 4-cycle that
     * stacks both shared-stadium homes, and a 4-cycle that does not.
     */
    private static BaseballSolution twoCycleFixture() {
        List<Team> created = new ArrayList<>();
        for (int index = 0; index < 10; index++) {
            String stadium = index <= 1 ? "잠실" : "구장" + index;
            created.add(new Team(index, "T" + index, stadium, new HashMap<>()));
        }
        List<Team> teams = Team.prepareIndices(created);
        Team[] byIndex = new Team[10];
        for (Team team : teams) {
            byIndex[team.getIndex()] = team;
        }
        Calendar[] days = new Calendar[3];
        for (int slot = 0; slot < days.length; slot++) {
            days[slot] = new Calendar((long) slot, LocalDateTime.of(2025, 3, 22, 0, 0).plusDays(slot * 3L), 3, 0, 0);
        }
        days[1].setPrev(days[0]);
        days[0].setNext(days[1]);
        days[2].setPrev(days[1]);
        days[1].setNext(days[2]);

        int[][][] rounds = {
                {{0, 2}, {3, 1}, {4, 5}, {6, 7}, {8, 9}},
                {{0, 1}, {2, 3}, {4, 7}, {5, 8}, {6, 9}},
                {{2, 0}, {1, 4}, {3, 5}, {6, 8}, {7, 9}}
        };
        List<Match> matches = new ArrayList<>();
        long id = 0L;
        for (int slot = 0; slot < rounds.length; slot++) {
            for (int[] edge : rounds[slot]) {
                Match match = new Match(id++, byIndex[edge[0]], byIndex[edge[1]], 3);
                match.setCalendar(days[slot]);
                match.setPossibleCalendars(List.of(days));
                matches.add(match);
            }
        }
        BaseballSolution solution = new BaseballSolution();
        solution.setId(0L);
        solution.setTeamList(teams);
        solution.setCalendarList(List.of(days));
        solution.setMatchList(matches);
        return solution;
    }

    private static int[] range(int from, int to) {
        int[] slots = new int[to - from + 1];
        for (int index = 0; index < slots.length; index++) {
            slots[index] = from + index;
        }
        return slots;
    }

    private static BaseballSolution load2025() throws Exception {
        try (Reader reader = Files.newBufferedReader(Path.of("data/baseball/input_2025.json"), StandardCharsets.UTF_8)) {
            JSONObject json = (JSONObject) new JSONParser().parse(reader);
            return BaseballApp.makeSolution(json);
        }
    }
}
