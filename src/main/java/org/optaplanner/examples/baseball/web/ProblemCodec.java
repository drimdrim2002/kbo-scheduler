package org.optaplanner.examples.baseball.web;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.ScoreSettings;
import org.optaplanner.examples.baseball.domain.Team;

/**
 * UI 프로젝트 JSON(기준 요구사항 §8, input_2025.json 상위 호환) ↔ BaseballSolution.
 * 시리즈 id = matches 배열 위치, 슬롯 id = calendar 배열 위치. 더미 슬롯(9999)과 미배정은 -1이다.
 */
final class ProblemCodec {

    static final long UNASSIGNED = -1L;
    static final double WEB_DEFAULT_HOLIDAY_TOLERANCE = 1.0;

    private ProblemCodec() {
    }

    /** 엔진이 읽는 필드만 복사하고 숫자 형을 맞춘다(json-simple은 정수를 Long, 소수를 Double로 읽는다). */
    @SuppressWarnings("unchecked")
    static JSONObject engineInput(JSONObject problem) {
        JSONObject out = new JSONObject();
        JSONArray teams = new JSONArray();
        for (Object t : required(problem, "teams")) {
            JSONObject src = (JSONObject) t;
            teams.add(Json.obj("name", Json.asString(src.get("name"), ""), "stadium", Json.asString(src.get("stadium"), "")));
        }
        out.put("teams", teams);
        JSONArray dist = new JSONArray();
        for (Object d : required(problem, "distanceMatrix")) {
            JSONObject src = (JSONObject) d;
            dist.add(Json.obj("from", Json.asString(src.get("from"), ""), "to", Json.asString(src.get("to"), ""),
                    "distance", Json.asDouble(src.get("distance"), 0.0)));
        }
        out.put("distanceMatrix", dist);
        JSONArray calendar = new JSONArray();
        for (Object c : required(problem, "calendar")) {
            JSONObject src = (JSONObject) c;
            calendar.add(Json.obj("datetime", Json.asString(src.get("datetime"), ""),
                    "consecutive", Json.asLong(src.get("consecutive"), 3),
                    "weekend", Json.asLong(src.get("weekend"), 0),
                    "holiday", Json.asLong(src.get("holiday"), 0)));
        }
        out.put("calendar", calendar);
        JSONArray matches = new JSONArray();
        for (Object m : required(problem, "matches")) {
            JSONObject src = (JSONObject) m;
            matches.add(Json.obj("home", Json.asString(src.get("home"), ""), "away", Json.asString(src.get("away"), ""),
                    "consecutive", Json.asLong(src.get("consecutive"), 3)));
        }
        out.put("matches", matches);
        return out;
    }

    private static JSONArray required(JSONObject problem, String key) {
        JSONArray a = Json.array(problem.get(key));
        if (a == null) {
            throw new IllegalArgumentException("problem." + key + " 배열이 없습니다.");
        }
        return a;
    }

    /** 배정 없는(모든 calendar null) 문제를 만들고, settings의 손잡이(허용오차·어린이날 홈 구단)를 적용한다. */
    static BaseballSolution toSolution(JSONObject problem) {
        BaseballSolution solution = BaseballApp.makeSolution(engineInput(problem));
        applySettings(solution, problem);
        return solution;
    }

    /** UI settings: distanceToleranceKm(기본 300), holidayTolerance(1.5), moveTolerance(2), obligationTeams(어린이날 홈 5구단). */
    static void applySettings(BaseballSolution solution, JSONObject problem) {
        JSONObject settings = Json.object(problem.get("settings"));
        if (settings == null) {
            settings = new JSONObject();
        }
        ScoreSettings def = ScoreSettings.DEFAULT;
        double distanceKm = Json.asDouble(settings.get("distanceToleranceKm"), def.getDistanceToleranceKm());
        // 웹 기본값은 1.0(편차 1 이상이면 감점 → 평균이 정수면 전부 같아야 함). 엔진 상수 1.5는 편차 1까지 허용해 주말 홈이 10~13으로 벌어졌다
        double holiday = Json.asDouble(settings.get("holidayTolerance"), WEB_DEFAULT_HOLIDAY_TOLERANCE);
        double move = Json.asDouble(settings.get("moveTolerance"), def.getMoveTolerance());
        if (distanceKm < 0 || distanceKm > 5000 || holiday <= 0 || holiday > 100 || move <= 0 || move > 100) {
            throw new IllegalArgumentException("허용오차 값이 범위를 벗어났습니다(이동거리 0~5000km, 휴일·이동 횟수 0 초과 100 이하).");
        }
        solution.setSettings(ScoreSettings.ofKm(distanceKm, holiday, move));
        JSONArray obligation = Json.array(settings.get("obligationTeams"));
        if (obligation != null && !obligation.isEmpty()) {
            Set<String> names = new LinkedHashSet<>();
            for (Object o : obligation) {
                names.add(Json.asString(o, ""));
            }
            Set<String> known = new LinkedHashSet<>();
            for (Team t : solution.getTeamList()) {
                known.add(t.getName());
            }
            if (!known.containsAll(names)) {
                throw new IllegalArgumentException("어린이날 홈 구단에 모르는 구단이 있습니다: " + names);
            }
            int half = solution.getTeamList().size() / 2;
            if (names.size() != half) {
                throw new IllegalArgumentException("어린이날 홈 구단은 " + half + "개여야 합니다(지금 " + names.size() + "개).");
            }
            for (Team t : solution.getTeamList()) {
                t.setChildrenDayHome(names.contains(t.getName()));
            }
        }
    }

    /** 캐시 키·재현에 쓰는 손잡이 값만 뽑는다. */
    static JSONObject knobs(JSONObject problem) {
        JSONObject settings = Json.object(problem.get("settings"));
        JSONObject out = new JSONObject();
        if (settings != null) {
            for (String k : new String[] {"distanceToleranceKm", "holidayTolerance", "moveTolerance", "obligationTeams"}) {
                if (settings.get(k) != null) {
                    out.put(k, settings.get(k));
                }
            }
        }
        return out;
    }

    /**
     * problem.plan([{match, calendar}])과 matches[].pinned를 적용한다.
     * @return 모든 시리즈가 정규 슬롯에 배정됐으면 true (로컬서치를 바로 시작할 수 있다)
     */
    static boolean applyPlan(BaseballSolution solution, JSONObject problem, JSONArray planOverride) {
        Map<Long, Calendar> calendarById = new HashMap<>();
        for (Calendar c : solution.getCalendarList()) {
            calendarById.put(c.getId(), c);
        }
        Map<Long, Match> matchById = new HashMap<>();
        for (Match m : solution.getMatchList()) {
            matchById.put(m.getId(), m);
            m.setCalendar(null);
            m.setPinned(false);
        }
        JSONArray plan = planOverride != null ? planOverride : Json.array(problem.get("plan"));
        if (plan != null) {
            for (Object p : plan) {
                JSONObject entry = Json.object(p);
                if (entry == null) {
                    continue;
                }
                Match match = matchById.get(Json.asLong(entry.get("match"), -1));
                long slot = Json.asLong(entry.get("calendar"), UNASSIGNED);
                if (match == null || slot < 0) {
                    continue;
                }
                Calendar calendar = calendarById.get(slot);
                if (calendar != null && calendar.isRegular() && calendar.getConsecutive() == match.getConsecutive()) {
                    match.setCalendar(calendar);
                }
            }
        }
        JSONArray matches = Json.array(problem.get("matches"));
        if (matches != null) {
            for (int i = 0; i < matches.size(); i++) {
                JSONObject src = Json.object(matches.get(i));
                Match match = matchById.get((long) i);
                if (src != null && match != null && match.getCalendar() != null) {
                    match.setPinned(Json.asBool(src.get("pinned"), false));
                }
            }
        }
        for (Match m : solution.getMatchList()) {
            if (m.getCalendar() == null) {
                return false;
            }
        }
        return true;
    }

    /** [{match, calendar}] (시리즈 id 순). */
    static JSONArray planJson(BaseballSolution solution) {
        List<Match> sorted = new ArrayList<>(solution.getMatchList());
        sorted.sort(Comparator.comparingLong(Match::getId));
        List<JSONObject> out = new ArrayList<>(sorted.size());
        for (Match m : sorted) {
            Calendar c = m.getCalendar();
            long slot = c == null || !c.isRegular() ? UNASSIGNED : c.getId();
            out.add(Json.obj("match", m.getId(), "calendar", slot));
        }
        return Json.arr(out);
    }
}
