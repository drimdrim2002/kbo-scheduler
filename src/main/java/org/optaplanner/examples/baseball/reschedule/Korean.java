package org.optaplanner.examples.baseball.reschedule;

/**
 * 구단 이름 뒤 조사(은/는, 이/가). 한글은 마지막 글자의 받침으로, 영문(LG, KIA, NC…)은 읽는 소리로 정한다(끝 글자가 L·M·N·R이면 받침).
 * 브라우저 reschedule.js의 josa와 같아야 한다.
 */
public final class Korean {

    private Korean() {
    }

    static boolean hasBatchim(String word) {
        if (word == null || word.isEmpty()) {
            return false;
        }
        char c = word.charAt(word.length() - 1);
        if (c >= 0xAC00 && c <= 0xD7A3) {
            return (c - 0xAC00) % 28 != 0;
        }
        char u = Character.toUpperCase(c);
        return u == 'L' || u == 'M' || u == 'N' || u == 'R' || (c >= '0' && c <= '9' && "0136789".indexOf(c) >= 0);
    }

    /** 은/는 */
    public static String topic(String word) {
        return word + (hasBatchim(word) ? "은" : "는");
    }

    /** 이/가 */
    public static String subject(String word) {
        return word + (hasBatchim(word) ? "이" : "가");
    }
}
