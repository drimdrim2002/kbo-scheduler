package org.optaplanner.examples.baseball.reschedule;

/**
 * 재편성 기간 앞의 경기를 구단마다 접은 값. 탐색 중에는 바뀌지 않는다.
 * <ul>
 * <li>이동(baseMoves, baseDistanceTenths, startLocation)은 1차 편성을 <b>원래 일정대로</b> 센다. 취소 경기도 그 구장에 갔다고 본다.</li>
 * <li>연속 경기일(runAtStart)과 마지막 경기일(lastPlayedEpochDay)은 <b>실제로 치른 경기만</b> 센다. 취소된 날은 쉬는 날이다.</li>
 * </ul>
 *
 * @param startLocation 기간 첫 경기의 출발 구장 = 그 구장의 홈 구단 {@code Team.getIndex()}. 앞 경기가 없으면 -1
 * @param lastPlayedEpochDay 기간 앞 마지막 실제 경기일. 없으면 {@link Long#MIN_VALUE}
 */
public record TeamHistory(int teamIndex, long baseMoves, long baseDistanceTenths, int startLocation, int runAtStart,
        long lastPlayedEpochDay, int doubleHeadersUsed) {

    public static final long NO_DAY = Long.MIN_VALUE;
}
