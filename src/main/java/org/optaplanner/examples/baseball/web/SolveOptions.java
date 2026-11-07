package org.optaplanner.examples.baseball.web;

import org.json.simple.JSONObject;

/**
 * 요청 옵션을 공개 서비스 한도 안으로 자른다.
 * UI가 보내는 값: { mode, timeLimitSec, unimprovedSec, seed, init: 'KEEP' | 'SCRATCH' }.
 * 서버 전용: seeds(병렬 시드 수), calcLimit·unimprovedSteps(계산 수·개선 없는 step 수를 직접 줄 때. 없으면 초에서 바꾼다).
 * 엔진은 계산 수, 고른 시간, (75% 뒤) 개선 없음 중 먼저 닿는 것에서 멈춘다({@link StopRule}).
 * 계산 수나 개선 없음으로 끝나면 같은 옵션은 언제나 같은 결과를 낸다.
 */
record SolveOptions(String mode, long timeLimitSec, Long unimprovedSec, long seed, int seeds, String init, StopRule stop) {

    static SolveOptions from(JSONObject raw, ServerLimits limits) {
        JSONObject o = raw == null ? new JSONObject() : raw;
        String mode = Json.asString(o.get("mode"), "INITIAL");
        long time = clamp(Json.asLong(o.get("timeLimitSec"), limits.defaultSeconds()), 1, limits.maxSeconds());
        long unimprovedRaw = Json.asLong(o.get("unimprovedSec"), 0);
        Long unimproved = unimprovedRaw > 0 ? Math.min(unimprovedRaw, time) : null;
        long seed = Json.asLong(o.get("seed"), 0);
        int seeds = (int) clamp(Json.asLong(o.get("seeds"), limits.defaultSeeds()), 1, limits.maxSeeds());
        String init = "SCRATCH".equalsIgnoreCase(Json.asString(o.get("init"), "KEEP")) ? "SCRATCH" : "KEEP";
        StopRule stop = StopRule.fromSeconds(time, unimproved);
        long calcLimit = Json.asLong(o.get("calcLimit"), 0);
        long unimprovedSteps = Json.asLong(o.get("unimprovedSteps"), -1);
        if (calcLimit > 0 || unimprovedSteps >= 0) {
            long calcs = calcLimit > 0 ? Math.min(calcLimit, limits.maxSeconds() * StopRule.CALCS_PER_SECOND * 4) : stop.calcLimit();
            long idle = unimprovedSteps >= 0 ? unimprovedSteps : stop.unimprovedSteps();
            stop = new StopRule(calcs, idle, time);
        }
        return new SolveOptions(mode, time, unimproved, seed, seeds, init, stop);
    }

    private static long clamp(long v, long lo, long hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    /** 결과 저장 키에도 들어간다. 멈추는 기준이 다르면 다른 결과로 친다. */
    JSONObject toJson() {
        JSONObject o = Json.obj("mode", mode, "timeLimitSec", timeLimitSec, "seed", seed, "seeds", (long) seeds, "init", init,
                "calcLimit", stop.calcLimit(), "minCalcs", stop.minCalcs(), "unimprovedSteps", stop.unimprovedSteps());
        if (unimprovedSec != null) {
            o.put("unimprovedSec", unimprovedSec);
        }
        return o;
    }

    long[] seedList() {
        long[] out = new long[seeds];
        for (int i = 0; i < seeds; i++) {
            out[i] = seed + i;
        }
        return out;
    }
}
