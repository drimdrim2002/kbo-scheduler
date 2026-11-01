package org.optaplanner.examples.baseball.score;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.optaplanner.examples.baseball.domain.ScoreSettings;
import org.optaplanner.examples.baseball.score.ScoreFormulas.TeamTotals;

class ObjectiveSettingsTest {

    private static final int[] MOVES_DISTANCE_HOLIDAY_TOTAL = {
            ScoreSettings.MOVES, ScoreSettings.DISTANCE, ScoreSettings.HOLIDAY, ScoreSettings.TOTAL_DISTANCE};
    private static final int[] TOTAL_HOLIDAY_DISTANCE_MOVES = {
            ScoreSettings.TOTAL_DISTANCE, ScoreSettings.HOLIDAY, ScoreSettings.DISTANCE, ScoreSettings.MOVES};

    @Test
    void gapPenaltyIsZeroExactlyWhenMaxMinusMinIsWithinGap() {
        assertThat(ScoreFormulas.scaledGapPenalty(new long[] {10, 12, 14}, 4.0d)).isZero();
        // 두 쌍(16-10, 16-12)이 넘음: 2 넘음, 0 넘음 → 2^2 * 100
        assertThat(ScoreFormulas.scaledGapPenalty(new long[] {10, 12, 16}, 4.0d)).isEqualTo(400L);
        assertThat(ScoreFormulas.distanceGapPenalty(new long[] {0, 100, 6000}, 6000L)).isZero();
        // 7000-0은 1000 넘고 7000-100은 900 넘음 → (1000^2 + 900^2) / 100
        assertThat(ScoreFormulas.distanceGapPenalty(new long[] {0, 100, 7000}, 6000L)).isEqualTo(18100L);
    }

    @Test
    void movingAMiddleTeamTowardTheOthersStillImproves() {
        long before = ScoreFormulas.scaledGapPenalty(new long[] {10, 11, 20}, 4.0d);
        long after = ScoreFormulas.scaledGapPenalty(new long[] {10, 13, 20}, 4.0d);
        assertThat(after).isLessThan(before);
    }

    @Test
    void softPenaltyFollowsTheGivenOrder() {
        TeamTotals totals = new TeamTotals(3);
        System.arraycopy(new long[] {10, 12, 16}, 0, totals.moveCount, 0, 3);
        System.arraycopy(new long[] {0, 100, 7000}, 0, totals.distanceTenths, 0, 3);
        System.arraycopy(new long[] {20, 20, 30}, 0, totals.holidayWeight, 0, 3);

        ScoreSettings fixed = ScoreSettings.ofObjectives(MOVES_DISTANCE_HOLIDAY_TOTAL, 4.0d, 600.0d, 3.0d);
        ScoreSettings reversed = ScoreSettings.ofObjectives(TOTAL_HOLIDAY_DISTANCE_MOVES, 4.0d, 600.0d, 3.0d);

        long moves = ScoreFormulas.softPenalty(1, totals, fixed);
        long distance = ScoreFormulas.softPenalty(2, totals, fixed);
        long holiday = ScoreFormulas.softPenalty(3, totals, fixed);
        long total = ScoreFormulas.softPenalty(4, totals, fixed);
        assertThat(moves).isEqualTo(400L);
        assertThat(distance).isEqualTo(18100L);
        assertThat(holiday).isEqualTo(9800L);
        assertThat(total).isEqualTo(710L);
        assertThat(new long[] {ScoreFormulas.softPenalty(1, totals, reversed), ScoreFormulas.softPenalty(2, totals, reversed),
                ScoreFormulas.softPenalty(3, totals, reversed), ScoreFormulas.softPenalty(4, totals, reversed)})
                .containsExactly(total, holiday, distance, moves);
    }

    @Test
    void withoutObjectivesTheOldFixedOrderAndToleranceStay() {
        TeamTotals totals = new TeamTotals(3);
        System.arraycopy(new long[] {10, 12, 16}, 0, totals.moveCount, 0, 3);
        System.arraycopy(new long[] {0, 100, 7000}, 0, totals.distanceTenths, 0, 3);
        System.arraycopy(new long[] {20, 20, 30}, 0, totals.holidayWeight, 0, 3);
        ScoreSettings legacy = ScoreSettings.DEFAULT;
        assertThat(legacy.usesObjectives()).isFalse();
        assertThat(ScoreFormulas.softPenalty(1, totals, legacy))
                .isEqualTo(ScoreFormulas.moveVariancePenalty(totals.moveCount, legacy.getMoveTolerance()));
        assertThat(ScoreFormulas.softPenalty(2, totals, legacy))
                .isEqualTo(ScoreFormulas.distanceVariancePenalty(totals.distanceTenths, legacy.getDistanceToleranceTenths()));
        assertThat(ScoreFormulas.softPenalty(3, totals, legacy))
                .isEqualTo(ScoreFormulas.holidayVariancePenalty(totals.holidayWeight, legacy.getHolidayTolerance()));
        assertThat(ScoreFormulas.softPenalty(4, totals, legacy)).isEqualTo(ScoreFormulas.totalDistanceKm(totals.distanceTenths));
    }

    @Test
    void orderMustNameEveryObjectiveOnce() {
        assertThatThrownBy(() -> ScoreSettings.ofObjectives(new int[] {0, 0, 1, 2}, 4.0d, 600.0d, 3.0d))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ScoreSettings.ofObjectives(new int[] {0, 1, 2}, 4.0d, 600.0d, 3.0d))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
