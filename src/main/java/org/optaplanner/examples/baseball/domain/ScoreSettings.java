package org.optaplanner.examples.baseball.domain;

/**
 * 평준화 허용오차. 문제 사실(problem fact)로 해에 하나 들어간다. 불변이라 계획 복제 때 공유해도 안전하다.
 * 기본값은 {@link Constants.TOLERANCE}와 같다. 어린이날 홈 구단은 {@link Team#isChildrenDayHome()}에 있다.
 */
public final class ScoreSettings {

    public static final ScoreSettings DEFAULT = new ScoreSettings(3_000L,
            Constants.TOLERANCE.HOLIDAY.toDouble(), Constants.TOLERANCE.TOTAL_MOVE.toDouble());

    private final long distanceToleranceTenths;
    private final double holidayTolerance;
    private final double moveTolerance;

    public ScoreSettings(long distanceToleranceTenths, double holidayTolerance, double moveTolerance) {
        if (distanceToleranceTenths < 0 || holidayTolerance <= 0 || moveTolerance <= 0) {
            throw new IllegalArgumentException("허용오차는 양수여야 합니다.");
        }
        this.distanceToleranceTenths = distanceToleranceTenths;
        this.holidayTolerance = holidayTolerance;
        this.moveTolerance = moveTolerance;
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
                && Double.compare(s.moveTolerance, moveTolerance) == 0;
    }

    @Override
    public int hashCode() {
        return Long.hashCode(distanceToleranceTenths) * 31 + Double.hashCode(holidayTolerance) * 7
                + Double.hashCode(moveTolerance);
    }

    @Override
    public String toString() {
        return "ScoreSettings{distance=" + getDistanceToleranceKm() + "km, holiday=" + holidayTolerance
                + ", move=" + moveTolerance + "}";
    }
}
