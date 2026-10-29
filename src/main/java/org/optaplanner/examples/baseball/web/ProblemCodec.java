package org.optaplanner.examples.baseball.web;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Constants;
import org.optaplanner.examples.baseball.domain.HomeObligations;
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

    /** 배정 없는(모든 calendar null) 문제를 만들고, settings의 손잡이(허용오차)와 홈 구장 지정을 적용한다. */
    static BaseballSolution toSolution(JSONObject problem) {
        BaseballSolution solution = BaseballApp.makeSolution(engineInput(problem));
        applySettings(solution, problem);
        return solution;
    }

    /** UI settings: distanceToleranceKm(기본 300), holidayTolerance(1.5), moveTolerance(2). 홈 구장 지정은 {@link #applyHomeDesignations}. */
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
        applyHomeDesignations(solution, problem, settings);
    }

    /**
     * 홈 구장 지정 → 연전 기간별 홈 의무 구단({@link Calendar#getHomeObligationMask()}). 브라우저 채점기 엔진 호환 기준
     * ({@code ui/core/score.js engineObligations})과 같은 규칙이다.
     * <ul>
     * <li>{@code events[]} 중 {@code mode: 'STADIUM'}의 {@code teams}(없으면 {@code pairs[].home})를, 그 날짜가 든 연전 기간에 모은다.
     * 「대진까지 고정」({@code fix: 'pairs'})도 같다 — 화면이 그 시리즈를 고정해 보내고, 서버는 그 홈 구단도 지켜졌는지 본다.</li>
     * <li>어린이날({@code type: 'CHILDREN'})은 {@code teams}가 일부(구단 수/2 미만)만 고른 것이 아니면 {@code settings.obligationTeams}가
     * 있을 때 그것을 쓴다(공유 링크·예전 화면은 obligationTeams만 고친다).</li>
     * <li>STADIUM 이벤트가 하나도 없으면 예전대로: 시즌 해 5/5가 든 연전 기간에 obligationTeams(없으면 기본 5구단).</li>
     * </ul>
     */
    static void applyHomeDesignations(BaseballSolution solution, JSONObject problem, JSONObject settings) {
        List<Team> teams = solution.getTeamList();
        List<Calendar> calendars = solution.getCalendarList();
        int half = teams.size() / 2;
        Map<String, Team> teamByName = new HashMap<>();
        for (Team t : teams) {
            teamByName.put(t.getName(), t);
        }
        List<String> obligationTeams = null;
        JSONArray obligation = Json.array(settings.get("obligationTeams"));
        if (obligation != null && !obligation.isEmpty()) {
            Set<String> names = new LinkedHashSet<>();
            for (Object o : obligation) {
                names.add(Json.asString(o, ""));
            }
            if (!teamByName.keySet().containsAll(names)) {
                throw new IllegalArgumentException("어린이날 홈 구단에 모르는 구단이 있습니다: " + names);
            }
            if (names.size() != half) {
                throw new IllegalArgumentException("어린이날 홈 구단은 " + half + "개여야 합니다(지금 " + names.size() + "개).");
            }
            obligationTeams = new ArrayList<>(names);
        }
        List<JSONObject> stadiumEvents = new ArrayList<>();
        JSONArray events = Json.array(problem.get("events"));
        if (events != null) {
            for (Object e : events) {
                JSONObject ev = Json.object(e);
                if (ev != null && "STADIUM".equals(Json.asString(ev.get("mode"), ""))) {
                    stadiumEvents.add(ev);
                }
            }
        }
        if (stadiumEvents.isEmpty()) {
            HomeObligations.applyChildrenDay(teams, calendars,
                    obligationTeams != null ? obligationTeams : Constants.HOME_OBLIGATION_CHILDREN);
            return;
        }
        HomeObligations.clear(calendars);
        Map<Calendar, Set<String>> bySlot = new LinkedHashMap<>();
        Map<Calendar, String> labelBySlot = new HashMap<>();
        for (JSONObject ev : stadiumEvents) {
            List<String> names = eventTeams(ev);
            if ("CHILDREN".equals(Json.asString(ev.get("type"), "")) && obligationTeams != null
                    && (names.isEmpty() || names.size() >= half)) {
                names = obligationTeams;
            }
            if (names.isEmpty()) {
                continue;
            }
            Calendar slot = eventSlot(ev, calendars);
            if (slot == null) {
                continue;
            }
            String label = eventLabel(ev, slot);
            for (String n : names) {
                if (!teamByName.containsKey(n)) {
                    throw new IllegalArgumentException(label + " 홈 구장 지정에 모르는 구단이 있습니다: " + n);
                }
            }
            bySlot.computeIfAbsent(slot, k -> new LinkedHashSet<>()).addAll(names);
            labelBySlot.putIfAbsent(slot, label);
        }
        List<Match> matches = solution.getMatchList();
        for (Map.Entry<Calendar, Set<String>> entry : bySlot.entrySet()) {
            Calendar slot = entry.getKey();
            Set<String> names = entry.getValue();
            String label = labelBySlot.get(slot);
            if (names.size() > half) {
                throw new IllegalArgumentException(label + " 홈 구장 지정이 " + names.size() + "구단입니다. 한 연전 기간에 홈 경기는 "
                        + half + "곳까지입니다: " + String.join("·", names));
            }
            Map<String, String> byStadium = new HashMap<>();
            for (String n : names) {
                String stadium = teamByName.get(n).getStadium();
                String other = byStadium.putIfAbsent(stadium, n);
                if (other != null) {
                    throw new IllegalArgumentException(label + " " + stadium + "을(를) " + other + "·" + n
                            + "이(가) 같이 씁니다. 한 연전 기간에 한 구장에서 홈 경기는 하나라 둘 중 한 구단만 지정할 수 있습니다.");
                }
            }
            int length = slot.getConsecutive();
            for (String n : names) {
                boolean hasHome = false;
                for (Match m : matches) {
                    if (m.getConsecutive() == length && n.equals(m.getHome().getName())) {
                        hasHome = true;
                        break;
                    }
                }
                if (!hasHome) {
                    throw new IllegalArgumentException(label + " " + n + "의 " + length + "연전 홈 시리즈가 없습니다. "
                            + length + "연전 기간은 시리즈 목록의 " + length + "연전이 대진을 정하므로, 연전 묶음을 다시 만들거나 대진을 고정해 주세요.");
                }
            }
            if (length == 3 && names.size() == half) {
                List<String> shared = sharedStadiumWithoutHome(teams, names);
                if (!shared.isEmpty()) {
                    throw new IllegalArgumentException(label + " 홈 " + half + "곳을 모두 지정할 때는 같이 쓰는 구장(" + String.join("·", shared)
                            + ") 구단 중 하나가 들어가야 합니다(그 구장은 연전 기간마다 홈 경기가 하나씩 있습니다).");
                }
            }
            slot.setHomeObligationMask(HomeObligations.maskOf(teams, names));
        }
    }

    private static List<String> eventTeams(JSONObject ev) {
        List<String> names = new ArrayList<>();
        JSONArray teams = Json.array(ev.get("teams"));
        if (teams != null) {
            for (Object t : teams) {
                String n = Json.asString(t, "");
                if (!n.isEmpty()) {
                    names.add(n);
                }
            }
        }
        if (names.isEmpty()) {
            JSONArray pairs = Json.array(ev.get("pairs"));
            if (pairs != null) {
                for (Object p : pairs) {
                    JSONObject pair = Json.object(p);
                    String n = pair == null ? "" : Json.asString(pair.get("home"), "");
                    if (!n.isEmpty()) {
                        names.add(n);
                    }
                }
            }
        }
        return names;
    }

    /** 화면 {@code Score.resolveEventSlot}과 같다: date가 든 연전 기간, 없으면 slot 번호. */
    private static Calendar eventSlot(JSONObject ev, List<Calendar> calendars) {
        String date = Json.asString(ev.get("date"), "");
        if (date.length() >= 10) {
            try {
                Calendar byDate = HomeObligations.slotContaining(calendars, LocalDate.parse(date.substring(0, 10)));
                if (byDate != null) {
                    return byDate;
                }
            } catch (DateTimeParseException ignored) {
                // 날짜가 이상하면 slot 번호로
            }
        }
        long slot = Json.asLong(ev.get("slot"), -1L);
        for (Calendar c : calendars) {
            if (c.isRegular() && c.getSlotIndex() == slot) {
                return c;
            }
        }
        return null;
    }

    private static String eventLabel(JSONObject ev, Calendar slot) {
        String name = Json.asString(ev.get("name"), "");
        String date = Json.asString(ev.get("date"), "");
        if (date.isEmpty()) {
            date = slot.getStartTime().toLocalDate().toString();
        }
        return (name.isEmpty() ? "" : name + " ") + "(" + date + ")";
    }

    /** 같이 쓰는 구장마다 그 구장 구단이 names에 하나도 없으면 그 구단들. */
    private static List<String> sharedStadiumWithoutHome(List<Team> teams, Set<String> names) {
        Map<String, List<String>> byStadium = new LinkedHashMap<>();
        for (Team t : teams) {
            byStadium.computeIfAbsent(t.getStadium(), k -> new ArrayList<>()).add(t.getName());
        }
        List<String> out = new ArrayList<>();
        for (List<String> group : byStadium.values()) {
            if (group.size() > 1 && group.stream().noneMatch(names::contains)) {
                out.addAll(group);
            }
        }
        return out;
    }

    /** 적용된 홈 구장 지정: 연전 기간 시작일 → 홈 의무 구단(구단 목록 순). 캐시 키·결과 손잡이에 쓴다. */
    static JSONObject homeDesignations(BaseballSolution solution) {
        List<Team> sorted = new ArrayList<>(solution.getTeamList());
        sorted.sort(Comparator.comparingInt(Team::getIndex));
        JSONObject out = new JSONObject();
        for (Calendar c : solution.getCalendarList()) {
            if (c.isRegular() && c.getHomeObligationMask() != 0) {
                List<String> names = new ArrayList<>();
                for (Team t : sorted) {
                    if (c.requiresHome(t)) {
                        names.add(t.getName());
                    }
                }
                out.put(c.getStartTime().toLocalDate().toString(), Json.arr(names));
            }
        }
        return out;
    }

    /** 시즌 해 5/5가 든 연전 기간의 홈 의무 구단(공유 화면의 「어린이날 홈」). 없으면 빈 배열. */
    static JSONArray childrenDayTeams(BaseballSolution solution) {
        List<Calendar> calendars = solution.getCalendarList();
        LocalDate first = null;
        for (Calendar c : calendars) {
            if (c.isRegular() && (first == null || c.getStartTime().toLocalDate().isBefore(first))) {
                first = c.getStartTime().toLocalDate();
            }
        }
        Calendar children = first == null ? null
                : HomeObligations.slotContaining(calendars, Constants.CHILDREN_DAY.atYear(first.getYear()));
        JSONObject designations = homeDesignations(solution);
        Object teams = children == null ? null : designations.get(children.getStartTime().toLocalDate().toString());
        return teams == null ? new JSONArray() : (JSONArray) teams;
    }

    /** 캐시 키·재현에 쓰는 손잡이 값만 뽑는다. */
    static JSONObject knobs(JSONObject problem) {
        JSONObject settings = Json.object(problem.get("settings"));
        JSONObject out = new JSONObject();
        if (settings != null) {
            for (String k : new String[] {"distanceToleranceKm", "holidayTolerance", "moveTolerance"}) {
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
