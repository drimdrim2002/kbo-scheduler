package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.core.api.score.director.ScoreDirector;
import org.optaplanner.core.api.solver.SolverFactory;
import org.optaplanner.core.config.solver.EnvironmentMode;
import org.optaplanner.core.impl.score.director.InnerScoreDirector;
import org.optaplanner.core.impl.solver.DefaultSolverFactory;
import org.optaplanner.examples.baseball.reschedule.GameDayMove;
import org.optaplanner.examples.baseball.reschedule.RDay;
import org.optaplanner.examples.baseball.reschedule.RGame;
import org.optaplanner.examples.baseball.reschedule.RescheduleInitializer;
import org.optaplanner.examples.baseball.reschedule.RescheduleMoves;
import org.optaplanner.examples.baseball.reschedule.RescheduleScoreFormulas;
import org.optaplanner.examples.baseball.reschedule.RescheduleSolution;
import org.optaplanner.examples.baseball.reschedule.RescheduleSolverRunner;

class RescheduleSearchTest {

    @SuppressWarnings("unchecked")
    @Test
    void movesThatPassTheCheckNeverBreakARule() {
        RescheduleSolution s = RescheduleCodec.parse(RescheduleFixtures.problem(4, 30, "2025-09-01", "2025-09-24")).solution();
        RescheduleInitializer.initialize(s, 4);
        DefaultSolverFactory<RescheduleSolution> factory =
                (DefaultSolverFactory<RescheduleSolution>) SolverFactory.<RescheduleSolution>create(RescheduleSolverRunner.config(0, 1, null));
        try (InnerScoreDirector<RescheduleSolution, BendableLongScore> director =
                     (InnerScoreDirector<RescheduleSolution, BendableLongScore>) factory.getScoreDirectorFactory().buildScoreDirector()) {
            director.setWorkingSolution(s);
            List<RescheduleMoves.Factory> factories = List.of(new RescheduleMoves.Shift(), new RescheduleMoves.Swap(),
                    new RescheduleMoves.DoubleHeader(), new RescheduleMoves.EjectInsert(), new RescheduleMoves.DayChain());
            Random random = new Random(1);
            int done = 0;
            for (int step = 0; step < 300; step++) {
                RescheduleMoves.Factory f = factories.get(step % factories.size());
                Iterator<GameDayMove> it = f.createRandomMoveIterator(director, random);
                GameDayMove m = it.next();
                if (!m.isMoveDoable(director)) {
                    continue;
                }
                m.doMoveOnly(director);
                done++;
                assertThat(RescheduleScoreFormulas.totals(s).ruleViolations).as(m.toString()).isZero();
            }
            assertThat(done).isGreaterThan(150);
            // 막은 이동은 정말로 규칙을 어긴다(지나치게 막지 않는다)
            int rejected = 0;
            for (int k = 0; k < 3000 && rejected < 200; k++) {
                List<RGame> free = new ArrayList<>(s.getGameList());
                RGame g = free.get(random.nextInt(free.size()));
                RDay d = s.getDayList().get(random.nextInt(s.getDayList().size()));
                if (g.isPinned() || g.getDay() == d) {
                    continue;
                }
                RDay before = g.getDay();
                boolean doable = org.optaplanner.examples.baseball.reschedule.DayGrid.of(s).doable(List.of(g), new int[] {d.getIndex()});
                g.setDay(d);
                long v = RescheduleScoreFormulas.totals(s).ruleViolations;
                g.setDay(before);
                assertThat(v == 0).as("%s → %s", g, d).isEqualTo(doable);
                if (!doable) {
                    rejected++;
                }
            }
            assertThat(rejected).isPositive();
        }
    }

    @Test
    void searchImprovesWithoutBreakingRules() {
        RescheduleSolution s = RescheduleCodec.parse(RescheduleFixtures.problem(6, 30, "2025-09-01", "2025-09-28")).solution();
        RescheduleInitializer.initialize(s, 6);
        BendableLongScore initial = RescheduleScoreFormulas.evaluate(s);
        RescheduleSolution solved = RescheduleSolverRunner.solve(s, 6, 4, null, EnvironmentMode.FULL_ASSERT);
        BendableLongScore end = RescheduleScoreFormulas.evaluate(solved);
        System.out.println("initial " + initial + " -> " + end);
        assertThat(end.hardScore(0)).isZero();
        assertThat(end.hardScore(1)).isZero();
        assertThat(end.compareTo(initial)).isPositive();
    }
}
