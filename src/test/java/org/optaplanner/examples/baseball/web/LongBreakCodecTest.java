package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Constants;
import org.optaplanner.examples.baseball.score.ScoreFormulas;

/** 서버·스튜디오·보여주는 문이 쓰는 {@link ProblemCodec} 길로 만든 연전 기간도 올스타 휴식기 하나만 긴 휴식으로 본다. */
class LongBreakCodecTest {

    @Test
    void theCodecPathSeesExactlyOneLongBreakIn2025() {
        List<Calendar> regular = ProblemCodec.toSolution(BaseballApp.readJsonFile(Constants.inputFileName)).getCalendarList()
                .stream().filter(Calendar::isRegular).sorted(Comparator.comparingInt(Calendar::getSlotIndex)).toList();
        long breaks = 0L;
        for (int i = 1; i < regular.size(); i++) {
            if (ScoreFormulas.isLongBreak(regular.get(i - 1), regular.get(i))) {
                breaks++;
                assertThat(regular.get(i).getStartTime().toLocalDate()).hasToString("2025-07-17");
            }
        }
        assertThat(breaks).isEqualTo(1L);
    }
}
