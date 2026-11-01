package org.optaplanner.examples.baseball.web;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;

/**
 * 공개 서버에서 저장을 막는 관리자 비밀번호. 값은 환경 변수 {@code KBO_ADMIN_PASSWORD}(로컬 .env → scripts/run-server.sh,
 * 공개 서버 /etc/kbo-scheduler/env → systemd EnvironmentFile)로만 갖고, 응답·로그 어디에도 내보내지 않는다.
 * 없으면 저장은 꺼진다. 방문자 주소당 10분에 {@value #MAX_FAILS}번 틀리면 잠시 막는다.
 */
final class AdminPassword {

    static final int MAX_FAILS = 5;
    static final long WINDOW_MS = 10 * 60_000L;
    private static final int MAX_TRACKED = 10_000;

    private final byte[] expected;
    private final Map<String, long[]> fails = new HashMap<>(); // ip → [창 시작 ms, 틀린 횟수]

    AdminPassword(String password) {
        String p = password == null ? "" : password.trim();
        this.expected = p.getBytes(StandardCharsets.UTF_8);
    }

    static AdminPassword fromEnv() {
        return new AdminPassword(System.getenv("KBO_ADMIN_PASSWORD"));
    }

    boolean configured() {
        return expected.length > 0;
    }

    /** 맞으면 그대로 돌아오고, 아니면 RejectedException: 설정 없음 503 · 시도 초과 429 · 틀림 403. */
    synchronized void check(String password, String ip) {
        if (!configured()) {
            throw new JobManager.RejectedException(503, "서버에 관리자 비밀번호가 설정되어 있지 않아 저장할 수 없습니다.");
        }
        long now = System.currentTimeMillis();
        String who = ip == null ? "?" : ip;
        long[] w = fails.get(who);
        if (w != null && now - w[0] > WINDOW_MS) {
            fails.remove(who);
            w = null;
        }
        if (w != null && w[1] >= MAX_FAILS) {
            throw new JobManager.RejectedException(429, "비밀번호를 여러 번 틀렸습니다. 10분 뒤에 다시 해 주세요.");
        }
        byte[] given = (password == null ? "" : password.trim()).getBytes(StandardCharsets.UTF_8);
        if (MessageDigest.isEqual(expected, given)) {
            fails.remove(who);
            return;
        }
        if (w == null) {
            if (fails.size() >= MAX_TRACKED) {
                fails.values().removeIf((x) -> now - x[0] > WINDOW_MS);
            }
            w = new long[] { now, 0 };
            fails.put(who, w);
        }
        w[1]++;
        throw new JobManager.RejectedException(403, "관리자 비밀번호가 맞지 않습니다.");
    }
}
