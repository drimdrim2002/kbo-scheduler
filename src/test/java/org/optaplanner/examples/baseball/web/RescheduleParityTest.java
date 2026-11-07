package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.optaplanner.examples.baseball.reschedule.RDay;
import org.optaplanner.examples.baseball.reschedule.RGame;
import org.optaplanner.examples.baseball.reschedule.RescheduleReferenceScorer;
import org.optaplanner.examples.baseball.reschedule.RescheduleScoreFormulas;
import org.optaplanner.examples.baseball.reschedule.RescheduleSolution;

/** 계산식(RescheduleScoreFormulas)과 따로 쓴 단순 채점기가 무작위 배정 수백 개에서 8단계 모두 같아야 한다. */
class RescheduleParityTest {

    @Test
    void formulasMatchReferenceOnRandomPlans() {
        Random random = new Random(7);
        for (int round = 0; round < 12; round++) {
            RescheduleSolution s = RescheduleCodec.parse(RescheduleFixtures.problem(round, random.nextInt(40),
                    "2025-09-0" + (1 + random.nextInt(3)), "2025-09-" + (14 + random.nextInt(14)))).solution();
            List<RDay> days = s.getDayList();
            for (int k = 0; k < 40; k++) {
                for (RGame g : s.getGameList()) {
                    int r = random.nextInt(10);
                    g.setDay(r == 0 ? null : days.get(random.nextInt(days.size())));
                }
                // 더블헤더가 생기게 같은 대진 둘을 같은 날로
                RGame a = s.getGameList().get(random.nextInt(s.getGameList().size()));
                for (RGame b : s.getGameList()) {
                    if (b != a && b.sameMatchup(a) && a.getDay() != null) {
                        b.setDay(a.getDay());
                        break;
                    }
                }
                RescheduleScoreFormulas.Totals t = RescheduleScoreFormulas.totals(s);
                long[] ref = RescheduleReferenceScorer.score(s);
                long[] got = new long[8];
                got[0] = t.ruleViolations;
                got[1] = t.unplaced;
                System.arraycopy(t.levelPenalty, 0, got, 2, 6);
                assertThat(got).as("round %d plan %d", round, k).containsExactly(ref);
            }
        }
    }
}
