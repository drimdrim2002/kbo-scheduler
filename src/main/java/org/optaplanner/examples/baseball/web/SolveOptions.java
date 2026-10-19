package org.optaplanner.examples.baseball.web;

import org.json.simple.JSONObject;

/**
 * 요청 옵션을 공개 서비스 한도 안으로 자른다.
 * UI가 보내는 값: { mode, timeLimitSec, unimprovedSec, seed, init: 'KEEP' | 'SCRATCH' }.
 * 서버 전용: seeds(병렬 시드 수).
 */
record SolveOptions(String mode, long timeLimitSec, Long unimprovedSec, long seed, int seeds, String init) {

    static SolveOptions from(JSONObject raw, ServerLimits limits) {
        JSONObject o = raw == null ? new JSONObject() : raw;
        String mode = Json.asString(o.get("mode"), "INITIAL");
        long time = clamp(Json.asLong(o.get("timeLimitSec"), limits.defaultSeconds()), 1, limits.maxSeconds());
        long unimprovedRaw = Json.asLong(o.get("unimprovedSec"), 0);
        Long unimproved = unimprovedRaw > 0 ? Math.min(unimprovedRaw, time) : null;
        long seed = Json.asLong(o.get("seed"), 0);
        int seeds = (int) clamp(Json.asLong(o.get("seeds"), limits.defaultSeeds()), 1, limits.maxSeeds());
        String init = "SCRATCH".equalsIgnoreCase(Json.asString(o.get("init"), "KEEP")) ? "SCRATCH" : "KEEP";
        return new SolveOptions(mode, time, unimproved, seed, seeds, init);
    }

    private static long clamp(long v, long lo, long hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    JSONObject toJson() {
        JSONObject o = Json.obj("mode", mode, "timeLimitSec", timeLimitSec, "seed", seed, "seeds", (long) seeds, "init", init);
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
