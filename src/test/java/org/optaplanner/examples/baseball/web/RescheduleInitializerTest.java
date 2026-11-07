package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.optaplanner.examples.baseball.reschedule.RescheduleDiagnosis;
import org.optaplanner.examples.baseball.reschedule.RescheduleInitializer;
import org.optaplanner.examples.baseball.reschedule.RescheduleScoreFormulas;
import org.optaplanner.examples.baseball.reschedule.RescheduleSolution;
import org.optaplanner.examples.baseball.reschedule.RuleCheck;

class RescheduleInitializerTest {

    @Test
    void placesEverythingWithoutBreakingARule() {
        for (long seed = 0; seed < 20; seed++) {
            RescheduleSolution s = RescheduleCodec.parse(RescheduleFixtures.problem(seed, 30, "2025-09-01", "2025-09-28")).solution();
            long t0 = System.nanoTime();
            int unplaced = RescheduleInitializer.initialize(s, seed);
            long ms = (System.nanoTime() - t0) / 1_000_000;
            RescheduleScoreFormulas.Totals t = RescheduleScoreFormulas.totals(s);
            System.out.println("seed " + seed + ": unplaced " + unplaced + ", " + ms + " ms, score " + RescheduleScoreFormulas.evaluate(s));
            assertThat(t.ruleViolations).isZero();
            assertThat(RuleCheck.violations(s)).isEmpty();
            assertThat(unplaced).isZero();
            assertThat(t.unplaced).isZero();
        }
    }

    @Test
    void explainsWhatDoesNotFit() {
        // 9/1~9/10: 열흘에 구단당 9~15경기 → 연속 경기일 6일이면 다 못 넣는다
        RescheduleSolution s = RescheduleCodec.parse(RescheduleFixtures.problem(5, 30, "2025-09-01", "2025-09-10")).solution();
        int unplaced = RescheduleInitializer.initialize(s, 5);
        assertThat(unplaced).isPositive();
        assertThat(RescheduleScoreFormulas.totals(s).ruleViolations).isZero();
        RescheduleDiagnosis.Result r = RescheduleDiagnosis.explain(s);
        assertThat(r.unplaced()).hasSize(unplaced);
        assertThat(r.teamLimits()).isNotEmpty();
        r.teamLimits().forEach(l -> System.out.println(l.text()));
        r.unplaced().stream().limit(3).forEach(u -> System.out.println(u.text()));
    }
}
