package org.optaplanner.examples.baseball.web;

import org.optaplanner.examples.baseball.bench.BenchSupport;

/**
 * 탐색을 멈추는 기준. 아래 중 하나라도 맞으면 시드 하나가 멈춘다(OR).
 * <ul>
 * <li>{@code calcLimit}: 점수 계산(엔진이 따져 본 후보 수)이 이만큼 차면. 같은 입력·같은 시드면 언제나 같은 지점에서 멈춘다</li>
 * <li>{@code timeSec}: 사용자가 고른 시간이 지나면. 이때 멈춘 실행은 컴퓨터 속도에 따라 결과가 달라질 수 있다</li>
 * <li>{@code unimprovedSteps}: 계산을 {@link #minCalcs()}(75%) 넘게 한 뒤, 최고 점수가 이만큼의 step 동안 나아지지 않으면
 * (0이면 쓰지 않음). 2분을 골랐는데 1분도 안 돼 끝나는 일을 막는다</li>
 * </ul>
 * 계산 한 번의 비용은 거의 일정해서(시드·구간에 따라 2~3배) step보다 시간과 잘 맞는다. 자세한 근거는 {@link BenchSupport}.
 */
record StopRule(long calcLimit, long unimprovedSteps, long timeSec) {

    /** 화면이 고르는 "초"를 계산 수로 바꾸는 비율({@link BenchSupport#CALCS_PER_SECOND}, 측정 도구와 같은 값). */
    static final long CALCS_PER_SECOND = BenchSupport.CALCS_PER_SECOND;

    StopRule {
        if (calcLimit < 1 || unimprovedSteps < 0 || timeSec < 1) {
            throw new IllegalArgumentException("bad stop rule: " + calcLimit + ", " + unimprovedSteps + ", " + timeSec);
        }
    }

    /** 초 단위 요청을 바꾼다. unimprovedSec이 null이거나 0이면 개선 없음 종료를 쓰지 않는다. */
    static StopRule fromSeconds(long timeLimitSec, Long unimprovedSec) {
        long time = Math.max(1, timeLimitSec);
        long unimproved = unimprovedSec == null || unimprovedSec <= 0 ? 0 : unimprovedSec * BenchSupport.STEPS_PER_SECOND;
        return new StopRule(time * CALCS_PER_SECOND, unimproved, time);
    }

    /** 개선이 없어도 반드시 하는 계산 수. */
    long minCalcs() {
        return BenchSupport.minCalcs(calcLimit);
    }

    Long unimprovedStepsOrNull() {
        return unimprovedSteps > 0 ? unimprovedSteps : null;
    }
}
