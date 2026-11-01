package org.optaplanner.examples.baseball.domain;

import java.util.Arrays;

/**
 * 평준화 허용오차. 문제 사실(problem fact)로 해에 하나 들어간다. 불변이라 계획 복제 때 공유해도 안전하다.
 * 기본값은 {@link Constants.TOLERANCE}와 같다. 홈 구장 지정(연전 기간별 홈 의무 구단)은 {@link Calendar#getHomeObligationMask()}에 있다.
 */
public final class ScoreSettings {

    public static final int MOVES = 0;
    public static final int DISTANCE = 1;
    public static final int HOLIDAY = 2;
    public static final int TOTAL_DISTANCE = 3;
    public static final int OBJECTIVES = 4;

    public static final ScoreSettings DEFAULT = new ScoreSettings(3_000L,
            Constants.TOLERANCE.HOLIDAY.toDouble(), Constants.TOLERANCE.TOTAL_MOVE.toDouble());

    private final long distanceToleranceTenths;
    private final double holidayTolerance;
    private final double moveTolerance;
    private final int[] order;
    private final double moveGap;
    private final long distanceGapTenths;
    private final double holidayGap;

    public ScoreSettings(long distanceToleranceTenths, double holidayTolerance, double moveTolerance) {
        this(distanceToleranceTenths, holidayTolerance, moveTolerance, null, 0.0d, 0L, 0.0d);
    }

    private ScoreSettings(long distanceToleranceTenths, double holidayTolerance, double moveTolerance,
            int[] order, double moveGap, long distanceGapTenths, double holidayGap) {
        if (distanceToleranceTenths < 0 || holidayTolerance <= 0 || moveTolerance <= 0) {
            throw new IllegalArgumentException("허용오차는 양수여야 합니다.");
        }
        this.distanceToleranceTenths = distanceToleranceTenths;
        this.holidayTolerance = holidayTolerance;
        this.moveTolerance = moveTolerance;
        this.order = order;
        this.moveGap = moveGap;
        this.distanceGapTenths = distanceGapTenths;
        this.holidayGap = holidayGap;
    }

    /** 목적식 순서·허용 차이를 받았는가. 아니면 기존 방식(고정 순서, 평균 ± 허용오차)이다. */
    public boolean usesObjectives() {
        return order != null;
    }

    /** level(1~4)번째 순위의 목적식. */
    public int objectiveAt(int softLevel) {
        return order == null ? softLevel - 1 : order[softLevel - 1];
    }

    public double getMoveGap() {
        return moveGap;
    }

    public long getDistanceGapTenths() {
        return distanceGapTenths;
    }

    public double getHolidayGap() {
        return holidayGap;
    }

    /**
     * 목적식 순서와 허용 차이를 함께 준다. order[i] = i+1번째 순위 목적식({@link #MOVES} 등).
     * 허용 차이는 가장 많은 구단과 가장 적은 구단의 차이로 잰다(넘으면 줄이려 노력, 반드시는 아님).
     */
    public static ScoreSettings ofObjectives(int[] order, double moveGap, double distanceGapKm, double holidayGap) {
        boolean[] seen = new boolean[OBJECTIVES];
        if (order == null || order.length != OBJECTIVES) {
            throw new IllegalArgumentException("목적식 순서는 " + OBJECTIVES + "개여야 합니다.");
        }
        for (int objective : order) {
            if (objective < 0 || objective >= OBJECTIVES || seen[objective]) {
                throw new IllegalArgumentException("목적식 순서에 빠지거나 겹친 값이 있습니다.");
            }
            seen[objective] = true;
        }
        if (moveGap < 0 || distanceGapKm < 0 || holidayGap < 0) {
            throw new IllegalArgumentException("허용 차이는 0 이상이어야 합니다.");
        }
        return new ScoreSettings(DEFAULT.distanceToleranceTenths, DEFAULT.holidayTolerance, DEFAULT.moveTolerance,
                order.clone(), moveGap, Math.round(distanceGapKm * 10.0), holidayGap);
    }

    public static ScoreSettings ofKm(double distanceToleranceKm, double holidayTolerance, double moveTolerance) {
        return new ScoreSettings(Math.round(distanceToleranceKm * 10.0), holidayTolerance, moveTolerance);
    }

    public long getDistanceToleranceTenths() {
        return distanceToleranceTenths;
    }

    public double getDistanceToleranceKm() {
        return distanceToleranceTenths / 10.0;
    }

    public double getHolidayTolerance() {
        return holidayTolerance;
    }

    public double getMoveTolerance() {
        return moveTolerance;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof ScoreSettings s && s.distanceToleranceTenths == distanceToleranceTenths
                && Double.compare(s.holidayTolerance, holidayTolerance) == 0
                && Double.compare(s.moveTolerance, moveTolerance) == 0
                && Arrays.equals(s.order, order) && Double.compare(s.moveGap, moveGap) == 0
                && s.distanceGapTenths == distanceGapTenths && Double.compare(s.holidayGap, holidayGap) == 0;
    }

    @Override
    public int hashCode() {
        return Long.hashCode(distanceToleranceTenths) * 31 + Double.hashCode(holidayTolerance) * 7
                + Double.hashCode(moveTolerance) + Arrays.hashCode(order);
    }

    @Override
    public String toString() {
        return "ScoreSettings{distance=" + getDistanceToleranceKm() + "km, holiday=" + holidayTolerance
                + ", move=" + moveTolerance + "}";
    }
}
