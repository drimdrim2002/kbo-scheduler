package org.optaplanner.examples.baseball.reschedule;

import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.core.api.score.calculator.EasyScoreCalculator;

/** 문제가 작아(배정 경기 약 75개, 날 20~60일) 매번 처음부터 센다. 설계 §4.6. */
public class RescheduleEasyScoreCalculator implements EasyScoreCalculator<RescheduleSolution, BendableLongScore> {

    @Override
    public BendableLongScore calculateScore(RescheduleSolution solution) {
        return RescheduleScoreFormulas.evaluate(solution);
    }
}
