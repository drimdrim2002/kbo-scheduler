package org.optaplanner.examples.baseball.reschedule;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * 재편성 손잡이. 불변이라 계획 복제 때 공유해도 안전하다.
 * 기준 5개(사용자가 순서를 고른다) 중 「이동 공정성」만 점수 단계 둘(횟수, 거리)을 붙여 쓴다. 그래서 Soft 단계는 6개다.
 */
public final class RescheduleSettings {

    /** 사용자가 고르는 기준 이름(화면·요청의 reschedule.order). */
    public static final List<String> CRITERIA = List.of("lastDay", "fairness", "addedDistance", "monday", "doubleHeader");

    public static final int LAST_DAY = 0;
    public static final int FAIR_MOVES = 1;
    public static final int FAIR_DISTANCE = 2;
    public static final int ADDED_DISTANCE = 3;
    public static final int MONDAY = 4;
    public static final int DOUBLE_HEADER = 5;
    public static final int LEVELS = 6;
    /** 점수 단계 이름(결과의 levels). 위 상수 순서와 같다. */
    public static final List<String> LEVEL_NAMES =
            List.of("lastDay", "fairMoves", "fairDistance", "addedDistance", "monday", "doubleHeader");

    public static final int DEFAULT_LAST_DAY_TOLERANCE = 3;
    public static final int DEFAULT_MAX_CONSECUTIVE = 6;
    public static final int DEFAULT_MAX_DOUBLE_HEADERS = 2;
    public static final double DEFAULT_MOVE_GAP = 4.0;
    public static final long DEFAULT_DISTANCE_GAP_TENTHS = 6_000L;

    private final int lastDayToleranceDays;
    private final int maxConsecutiveDays;
    private final int maxDoubleHeaders;
    private final int[] levels;
    private final double moveGap;
    private final long distanceGapTenths;

    private RescheduleSettings(int lastDayToleranceDays, int maxConsecutiveDays, int maxDoubleHeaders, int[] levels,
            double moveGap, long distanceGapTenths) {
        this.lastDayToleranceDays = lastDayToleranceDays;
        this.maxConsecutiveDays = maxConsecutiveDays;
        this.maxDoubleHeaders = maxDoubleHeaders;
        this.levels = levels;
        this.moveGap = moveGap;
        this.distanceGapTenths = distanceGapTenths;
    }

    public static RescheduleSettings defaults() {
        return of(CRITERIA, true, DEFAULT_LAST_DAY_TOLERANCE, DEFAULT_MAX_CONSECUTIVE, DEFAULT_MAX_DOUBLE_HEADERS,
                DEFAULT_MOVE_GAP, DEFAULT_DISTANCE_GAP_TENTHS);
    }

    /**
     * @param order 기준 5개를 순위대로({@link #CRITERIA}의 이름, 빠짐·겹침 없이)
     * @param movesFirst 이동 공정성 안에서 횟수를 거리보다 먼저 볼지(1차 버전 운영 방침의 순서)
     */
    public static RescheduleSettings of(List<String> order, boolean movesFirst, int lastDayToleranceDays,
            int maxConsecutiveDays, int maxDoubleHeaders, double moveGap, long distanceGapTenths) {
        if (order == null || order.size() != CRITERIA.size() || !order.containsAll(CRITERIA)) {
            throw new IllegalArgumentException("기준 순서에는 다섯 기준이 한 번씩 들어 있어야 합니다.");
        }
        if (lastDayToleranceDays < 0 || lastDayToleranceDays > 60) {
            throw new IllegalArgumentException("마지막 경기일 허용 일수는 0~60일이어야 합니다.");
        }
        if (maxConsecutiveDays < 1 || maxConsecutiveDays > 60) {
            throw new IllegalArgumentException("연속 경기일 상한은 1~60일이어야 합니다.");
        }
        if (maxDoubleHeaders < 0 || maxDoubleHeaders > 30) {
            throw new IllegalArgumentException("더블헤더 상한은 0~30번이어야 합니다.");
        }
        if (moveGap < 0 || distanceGapTenths < 0) {
            throw new IllegalArgumentException("이동 허용 차이는 0 이상이어야 합니다.");
        }
        List<Integer> out = new ArrayList<>(LEVELS);
        for (String name : order) {
            switch (name) {
                case "lastDay" -> out.add(LAST_DAY);
                case "fairness" -> {
                    out.add(movesFirst ? FAIR_MOVES : FAIR_DISTANCE);
                    out.add(movesFirst ? FAIR_DISTANCE : FAIR_MOVES);
                }
                case "addedDistance" -> out.add(ADDED_DISTANCE);
                case "monday" -> out.add(MONDAY);
                default -> out.add(DOUBLE_HEADER);
            }
        }
        int[] levels = out.stream().mapToInt(Integer::intValue).toArray();
        return new RescheduleSettings(lastDayToleranceDays, maxConsecutiveDays, maxDoubleHeaders, levels, moveGap,
                distanceGapTenths);
    }

    /** 같은 순서·허용 차이로 꼭 지키는 규칙만 바꾼 설정(고칠 곳 확인용). */
    public RescheduleSettings withLimits(int maxConsecutive, int maxDh) {
        return new RescheduleSettings(lastDayToleranceDays, maxConsecutive, maxDh, levels, moveGap, distanceGapTenths);
    }

    /** softLevel(0~5)번째 점수 단계가 무엇인지({@link #LAST_DAY} 등). */
    public int levelAt(int softLevel) {
        return levels[softLevel];
    }

    /** 점수 단계 이름을 순위대로. */
    public List<String> levelNames() {
        List<String> out = new ArrayList<>(LEVELS);
        for (int level : levels) {
            out.add(LEVEL_NAMES.get(level));
        }
        return out;
    }

    public int getLastDayToleranceDays() {
        return lastDayToleranceDays;
    }

    public int getMaxConsecutiveDays() {
        return maxConsecutiveDays;
    }

    public int getMaxDoubleHeaders() {
        return maxDoubleHeaders;
    }

    public double getMoveGap() {
        return moveGap;
    }

    public long getDistanceGapTenths() {
        return distanceGapTenths;
    }

    @Override
    public String toString() {
        return "RescheduleSettings{lastDay=" + lastDayToleranceDays + ", run=" + maxConsecutiveDays + ", dh="
                + maxDoubleHeaders + ", levels=" + Arrays.toString(levels) + "}";
    }
}
