package org.optaplanner.examples.baseball.web;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;

/** json-simple 위의 얇은 도우미. 숫자 형 변환과 점수 직렬화를 한곳에 모은다. */
final class Json {

    private Json() {
    }

    static Object parse(String text) throws ParseException {
        return new JSONParser().parse(text);
    }

    static String str(Object value) {
        return JSONValue.toJSONString(value);
    }

    /** 키·값 쌍으로 JSONObject를 만든다. */
    @SuppressWarnings("unchecked")
    static JSONObject obj(Object... keyValues) {
        JSONObject o = new JSONObject();
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            o.put(String.valueOf(keyValues[i]), keyValues[i + 1]);
        }
        return o;
    }

    @SuppressWarnings("unchecked")
    static JSONArray arr(List<?> items) {
        JSONArray a = new JSONArray();
        a.addAll(items);
        return a;
    }

    static JSONObject object(Object v) {
        return v instanceof JSONObject o ? o : null;
    }

    static JSONArray array(Object v) {
        return v instanceof JSONArray a ? a : null;
    }

    static long asLong(Object v, long def) {
        if (v instanceof Number n) {
            return n.longValue();
        }
        if (v instanceof String s) {
            try {
                return Long.parseLong(s.trim());
            } catch (NumberFormatException e) {
                return def;
            }
        }
        return def;
    }

    static double asDouble(Object v, double def) {
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        if (v instanceof String s) {
            try {
                return Double.parseDouble(s.trim());
            } catch (NumberFormatException e) {
                return def;
            }
        }
        return def;
    }

    static String asString(Object v, String def) {
        return v == null ? def : String.valueOf(v);
    }

    static boolean asBool(Object v, boolean def) {
        if (v instanceof Boolean b) {
            return b;
        }
        if (v instanceof String s) {
            return "true".equalsIgnoreCase(s);
        }
        return def;
    }

    /** UI 점수 형식 {hard:[h0,h1], soft:[s0..s4]}. */
    static JSONObject score(BendableLongScore score) {
        List<Long> hard = new ArrayList<>();
        for (long h : score.getHardScores()) {
            hard.add(h);
        }
        List<Long> soft = new ArrayList<>();
        for (long s : score.getSoftScores()) {
            soft.add(s);
        }
        return obj("hard", arr(hard), "soft", arr(soft));
    }

    /** 키를 정렬한 결정적 직렬화. 캐시 키에 쓴다. */
    static String canonical(Object v) {
        return str(sortKeys(v));
    }

    @SuppressWarnings("unchecked")
    private static Object sortKeys(Object v) {
        if (v instanceof Map<?, ?> m) {
            TreeMap<String, Object> sorted = new TreeMap<>();
            for (Map.Entry<?, ?> e : m.entrySet()) {
                sorted.put(String.valueOf(e.getKey()), sortKeys(e.getValue()));
            }
            JSONObject o = new JSONObject();
            o.putAll(sorted);
            return o;
        }
        if (v instanceof List<?> l) {
            JSONArray a = new JSONArray();
            for (Object item : l) {
                a.add(sortKeys(item));
            }
            return a;
        }
        return v;
    }
}
