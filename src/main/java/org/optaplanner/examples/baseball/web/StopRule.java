package org.optaplanner.examples.baseball.web;

import org.optaplanner.examples.baseball.bench.BenchSupport;

/**
 * 탐색을 멈추는 기준. 아래 중 하나라도 맞으면 시드 하나가 멈춘다(OR).
 * <ul>
 * <li>{@code calcLimit}: 점수 계산(엔진이 따져 본 후보 수)이 이만큼 차면. 같은 입력·같은 시드면 언제나 같은 지점에서 멈춘다</li>
 * <li>{@code timeSec}: 사용자가 고른 시간이 지나면. 편성을 시작한 때부터 세므로 시드마다 첫 일정을 만드는 시간도 들어간다.
 * 이때 멈춘 실행은 컴퓨터 속도에 따라 결과가 달라질 수 있다</li>
 * <li>{@code unimprovedSteps}: 계산을 {@link #minCalcs()}(75%) 넘게 한 뒤, 최고 점수가 이만큼의 step 동안 나아지지 않으면
 * (0이면 쓰지 않음). 2분을 골랐는데 1분도 안 돼 끝나는 일을 막는다</li>
 * </ul>
 * 계산 한 번의 비용은 거의 일정해서(시드·구간에 따라 2~3배) step보다 시간과 잘 맞는다. 자세한 근거는 {@link BenchSupport}.
 */
record StopRule(long calcLimit, long unimprovedSteps, long timeSec) {

    /** 화면이 고르는 "초"를 계산 수로 바꾸는 비율({@link BenchSupport#CALCS_PER_SECOND}, 측정 도구와 같은 값). */
    static final long CALCS_PER_SECOND = BenchSupport.CALCS_PER_SECOND;

    /**
     * 첫 일정을 만드는 데 드는 시간의 예상값(초). 계산 수는 실제로 잰 시간에 따라 바뀌면 안 되므로(그러면 결과가 달라진다)
     * 고른 시간에서 이 고정값을 빼고 계산 수로 바꾼다. 서버 실측: 보통 약 5초, 배포 직후 첫 실행은 약 25초(사용자 결정 2026-11-08).
     */
    static final long SETUP_ESTIMATE_SEC = 5;

    StopRule {
        if (calcLimit < 1 || unimprovedSteps < 0 || timeSec < 1) {
            throw new IllegalArgumentException("bad stop rule: " + calcLimit + ", " + unimprovedSteps + ", " + timeSec);
        }
    }

    /** 초 단위 요청을 바꾼다. unimprovedSec이 null이거나 0이면 개선 없음 종료를 쓰지 않는다. */
    static StopRule fromSeconds(long timeLimitSec, Long unimprovedSec) {
        long time = Math.max(1, timeLimitSec);
        long unimproved = unimprovedSec == null || unimprovedSec <= 0 ? 0 : unimprovedSec * BenchSupport.STEPS_PER_SECOND;
        return new StopRule(searchSeconds(time) * CALCS_PER_SECOND, unimproved, time);
    }

    /** 고른 시간 중 탐색에 쓸 몫(초): 준비 예상값을 뺀다. 아주 짧은 시간(10초 미만)은 절반을 탐색 몫으로 둔다. */
    static long searchSeconds(long timeSec) {
        return timeSec >= 2 * SETUP_ESTIMATE_SEC ? timeSec - SETUP_ESTIMATE_SEC : Math.max(1, (timeSec + 1) / 2);
    }

    /** 개선이 없어도 반드시 하는 계산 수. */
    long minCalcs() {
        return BenchSupport.minCalcs(calcLimit);
    }

    Long unimprovedStepsOrNull() {
        return unimprovedSteps > 0 ? unimprovedSteps : null;
    }
}
