package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;

/**
 * (b) 2025 실제 일정에서 항목마다 하나씩 일부러 어기면 정확히 그 항목만 어김으로 나와야 한다.
 * 어긴 것을 만드는 방법은 두 가지다: 정한 값을 바꾸거나(설정·이벤트), 일정을 바꾸거나(plan·시리즈). 일정을 바꾸면 다른 항목까지
 * 같이 어기기 쉬우므로, 후보를 차례로 시도해 그 항목만 어기는 변경이 하나라도 있는지 본다.
 */
class RequirementCheckerViolationTest {

    private static JSONObject project() throws Exception {
        return Json.object(Json.parse(Json.str(RequirementChecker2025Test.project2025())));
    }

    private static JSONObject settings(JSONObject p) {
        return Json.object(p.get("settings"));
    }

    private static JSONObject event(JSONObject p, String type) {
        for (Object o : Json.array(p.get("events"))) {
            JSONObject ev = (JSONObject) o;
            if (type.equals(ev.get("type"))) {
                return ev;
            }
        }
        throw new IllegalStateException("no event " + type);
    }

    private static JSONObject match(JSONObject p, int id) {
        return (JSONObject) Json.array(p.get("matches")).get(id);
    }

    private static int slotOf(JSONObject p, int seriesId) {
        return (int) Json.asLong(((JSONObject) Json.array(p.get("plan")).get(seriesId)).get("calendar"), -1);
    }

    @SuppressWarnings("unchecked")
    private static void assign(JSONObject p, int seriesId, long slot) {
        ((JSONObject) Json.array(p.get("plan")).get(seriesId)).put("calendar", slot);
    }

    private static void assertOnly(JSONObject p, String id) {
        JSONObject v = RequirementChecker.check(p, null);
        assertThat(RequirementChecker.failedIds(v)).containsExactly(id);
        assertThat(v.get("ok")).isEqualTo(Boolean.FALSE);
        assertThat(Json.array(v.get("failedTitles"))).hasSize(1);
    }

    /** 후보 변경 중 그 항목만 어기는 것이 하나라도 있어야 한다. */
    private static void assertSomeCandidateBreaksOnly(String id, List<Consumer<JSONObject>> candidates) throws Exception {
        List<String> seen = new ArrayList<>();
        for (Consumer<JSONObject> c : candidates) {
            JSONObject p = project();
            c.accept(p);
            JSONObject v = RequirementChecker.check(p, null);
            List<String> failed = new ArrayList<>(RequirementChecker.failedIds(v));
            seen.add(failed.toString());
            if (failed.equals(List.of(id))) {
                return;
            }
        }
        throw new AssertionError("no candidate breaks only " + id + "; failures seen: " + seen);
    }

    @Test
    @SuppressWarnings("unchecked")
    void opening() throws Exception {
        JSONObject p = project();
        JSONArray teams = Json.array(event(p, "OPENING").get("teams"));
        teams.set(0, "두산"); // SSG 대신 두산을 개막전 홈으로 정하면 실제 일정은 그 날 두산이 원정
        assertOnly(p, "opening");
    }

    @Test
    @SuppressWarnings("unchecked")
    void openingPairs() throws Exception {
        JSONObject p = project();
        JSONObject ev = event(p, "OPENING");
        ev.remove("teams");
        ev.put("pairs", Json.arr(List.of(Json.obj("home", "SSG", "away", "LG"), Json.obj("home", "KT", "away", "키움"),
                Json.obj("home", "삼성", "away", "NC"), Json.obj("home", "KIA", "away", "한화"), Json.obj("home", "두산", "away", "롯데"))));
        assertOnly(p, "opening");
    }

    @Test
    @SuppressWarnings("unchecked")
    void childrenDay() throws Exception {
        JSONObject p = project();
        settings(p).put("obligationTeams", Json.arr(List.of("LG", "키움", "한화", "NC", "롯데")));
        JSONArray teams = Json.array(event(p, "CHILDREN").get("teams"));
        teams.set(0, "LG");
        assertOnly(p, "children");
    }

    @Test
    @SuppressWarnings("unchecked")
    void otherStadiumEvent() throws Exception {
        JSONObject p = project();
        Json.array(p.get("events")).add(Json.obj("id", "ev-x", "type", "CUSTOM", "name", "창원 야구의 날", "date", "2025-06-06", "mode", "STADIUM",
                "teams", Json.arr(List.of("NC"))));
        JSONObject v = RequirementChecker.check(p, null);
        // 실제 6/6 NC가 홈이면 통과, 아니면 어김 — 어느 쪽이든 항목이 생기고 다른 항목은 그대로
        assertThat(RequirementChecker.verdicts(v)).containsKey("stadium-1");
        JSONObject q = project();
        Json.array(q.get("events")).add(Json.obj("id", "ev-x", "type", "CUSTOM", "name", "창원 야구의 날", "date", "2025-06-06", "mode", "STADIUM",
                "teams", Json.arr(List.of(RequirementChecker.verdicts(v).get("stadium-1").equals(RequirementChecker.PASS) ? awayOf(p, "2025-06-06", "NC") : "NC"))));
        assertOnly(q, "stadium-1");
    }

    /** 그 날 NC의 상대(NC가 홈이면 원정 구단) — 그 구단을 홈으로 지정하면 어긴다. */
    private static String awayOf(JSONObject p, String date, String home) {
        JSONObject v = RequirementChecker.check(p, null);
        for (Object d : Json.array(Json.object(v.get("tables")).get("days"))) {
            JSONObject day = (JSONObject) d;
            if (date.equals(day.get("date"))) {
                for (Object g : Json.array(day.get("games"))) {
                    JSONObject game = (JSONObject) g;
                    if (home.equals(game.get("home"))) {
                        return Json.asString(game.get("away"), "");
                    }
                }
            }
        }
        throw new IllegalStateException(home + " is not home on " + date);
    }

    @Test
    @SuppressWarnings("unchecked")
    void pairGames() throws Exception {
        JSONObject p = project();
        settings(p).put("initialGamesPerPair", 16L);
        assertOnly(p, "pair-games");
    }

    @Test
    @SuppressWarnings("unchecked")
    void homeTotals() throws Exception {
        // 2025 실제 1차 편성 홈: SSG·KT·두산·한화·롯데 69, 나머지 66 (ui/core/README.md)
        JSONObject p = project();
        settings(p).put("homeTotals", Json.obj("moreTeams", Json.arr(List.of("SSG", "KT", "두산", "한화", "롯데")),
                "more", Json.obj("total", 73L, "initial", 69L), "less", Json.obj("total", 71L, "initial", 66L)));
        JSONObject v = RequirementChecker.check(p, null);
        assertThat(RequirementChecker.failedIds(v)).isEmpty();
        assertThat(RequirementChecker.verdicts(v).get("home-totals")).isEqualTo(RequirementChecker.PASS);
        settings(p).put("homeTotals", Json.obj("moreTeams", Json.arr(List.of("SSG", "KT", "두산", "한화", "LG")),
                "more", Json.obj("total", 73L, "initial", 69L), "less", Json.obj("total", 71L, "initial", 66L)));
        assertOnly(p, "home-totals");
    }

    @Test
    @SuppressWarnings("unchecked")
    void restWeekdays() throws Exception {
        JSONObject p = project();
        settings(p).put("restWeekdays", Json.arr(List.of(1L, 2L)));
        assertOnly(p, "rest-weekdays");
    }

    @Test
    @SuppressWarnings("unchecked")
    void blackouts() throws Exception {
        JSONObject p = project();
        Json.array(settings(p).get("blackouts")).add(Json.obj("start", "2025-06-06", "end", "2025-06-06", "label", "현충일"));
        assertOnly(p, "blackouts");
    }

    @Test
    @SuppressWarnings("unchecked")
    void seasonRange() throws Exception {
        JSONObject p = project();
        settings(p).put("initialEnd", "2025-08-30");
        assertOnly(p, "season-range");
    }

    @Test
    @SuppressWarnings("unchecked")
    void seriesLength() throws Exception {
        JSONObject p = project();
        settings(p).put("seriesMinLength", 4L);
        assertOnly(p, "series-length");
    }

    @Test
    @SuppressWarnings("unchecked")
    void lengthMatch() throws Exception {
        // 같은 맞대결·같은 홈의 3연전 둘을 4연전·2연전으로 바꾸면 맞대결 경기 수·홈 경기 수는 그대로고 기간과 길이만 다르다
        JSONObject p = project();
        JSONArray matches = Json.array(p.get("matches"));
        int a = -1;
        int b = -1;
        for (int i = 0; i < matches.size() && b < 0; i++) {
            JSONObject mi = (JSONObject) matches.get(i);
            if (Json.asLong(mi.get("consecutive"), 0) != 3) {
                continue;
            }
            for (int j = i + 1; j < matches.size(); j++) {
                JSONObject mj = (JSONObject) matches.get(j);
                if (Json.asLong(mj.get("consecutive"), 0) == 3 && mi.get("home").equals(mj.get("home")) && mi.get("away").equals(mj.get("away"))) {
                    a = i;
                    b = j;
                    break;
                }
            }
        }
        match(p, a).put("consecutive", 4L);
        match(p, b).put("consecutive", 2L);
        assertOnly(p, "length-match");
    }

    @Test
    @SuppressWarnings("unchecked")
    void fourGame() throws Exception {
        JSONObject p = project();
        settings(p).put("fourGameHome", "swap");
        assertOnly(p, "four-game");
    }

    @Test
    void dailyTeams() throws Exception {
        // 3연전 하나를 다른 3연전 기간으로 옮기면 그 두 구단이 한 날은 두 번, 한 날은 한 번도 출전하지 않는다
        List<Consumer<JSONObject>> candidates = new ArrayList<>();
        JSONObject base = project();
        for (int s = 0; s < 225; s += 7) {
            int from = slotOf(base, s);
            for (int to = 1; to < 45; to += 5) {
                if (to == from) {
                    continue;
                }
                int sid = s;
                long target = to;
                candidates.add(p -> assign(p, sid, target));
            }
        }
        assertSomeCandidateBreaksOnly("daily-teams", candidates);
    }

    @Test
    void dailyStadiums() throws Exception {
        // 두산이 원정이고 LG가 홈인 연전 기간에서 두산 시리즈의 홈·원정을 바꾸면 잠실에 경기가 둘
        List<Consumer<JSONObject>> candidates = new ArrayList<>();
        JSONObject base = project();
        JSONArray matches = Json.array(base.get("matches"));
        for (int i = 0; i < matches.size(); i++) {
            JSONObject m = (JSONObject) matches.get(i);
            if (!"두산".equals(m.get("away"))) {
                continue;
            }
            int slot = slotOf(base, i);
            boolean lgHome = false;
            for (int j = 0; j < matches.size(); j++) {
                if (slotOf(base, j) == slot && "LG".equals(((JSONObject) matches.get(j)).get("home"))) {
                    lgHome = true;
                }
            }
            if (!lgHome) {
                continue;
            }
            int sid = i;
            candidates.add(p -> swapHomeAway(match(p, sid)));
        }
        assertSomeCandidateBreaksOnly("daily-stadiums", candidates);
    }

    @SuppressWarnings("unchecked")
    private static void swapHomeAway(JSONObject m) {
        Object h = m.get("home");
        m.put("home", m.get("away"));
        m.put("away", h);
    }

    @Test
    void streak() throws Exception {
        // 시리즈 하나의 홈·원정을 바꾸면 어느 구단의 홈 또는 원정이 4연속이 될 수 있다
        List<Consumer<JSONObject>> candidates = new ArrayList<>();
        for (int i = 0; i < 225; i++) {
            int sid = i;
            candidates.add(p -> swapHomeAway(match(p, sid)));
        }
        assertSomeCandidateBreaksOnly("streak", candidates);
    }

    @Test
    void repeatOpponent() throws Exception {
        // 두 연전 기간의 날짜를 맞바꾸면(길이가 같은 3연전끼리) 같은 상대가 잇달아 올 수 있다. 날짜 집합은 그대로라 날짜 항목은 그대로다
        List<Consumer<JSONObject>> candidates = new ArrayList<>();
        for (int a = 2; a < 44; a++) {
            for (int b = a + 2; b < 44; b++) {
                if (a == 32 || b == 32) {
                    continue; // 4연전
                }
                int sa = a;
                int sb = b;
                candidates.add(p -> swapSlotDates(p, sa, sb));
            }
        }
        assertSomeCandidateBreaksOnly("repeat-opponent", candidates);
    }

    @SuppressWarnings("unchecked")
    private static void swapSlotDates(JSONObject p, int a, int b) {
        JSONArray cal = Json.array(p.get("calendar"));
        JSONObject ca = (JSONObject) cal.get(a);
        JSONObject cb = (JSONObject) cal.get(b);
        Object da = ca.get("datetime");
        ca.put("datetime", cb.get("datetime"));
        cb.put("datetime", da);
    }

    @Test
    void unassigned() throws Exception {
        // 시리즈 하나를 배정에서 빼면 날짜 없는 시리즈 1 — 그 날들은 두 구단이 출전하지 않으니 「날마다 모든 구단 출전」도 함께 어긴다
        JSONObject p = project();
        assign(p, 10, -1L);
        JSONObject v = RequirementChecker.check(p, null);
        assertThat(RequirementChecker.failedIds(v)).containsExactlyInAnyOrder("unassigned", "daily-teams");
    }

    @Test
    void engineInputWithoutSettingsIsCheckedWithDefaults() throws Exception {
        // 설정이 없는 엔진 입력(input_2025.json): 정한 값이 없는 항목은 INFO, 기본값이 있는 항목(월요일 휴식 등)은 판정
        JSONObject input = org.optaplanner.examples.baseball.app.BaseballApp.readJsonFile(org.optaplanner.examples.baseball.domain.Constants.inputFileName);
        JSONObject v = RequirementChecker.check(input, Json.array(Json.object(Json.parse(Json.str(RequirementChecker2025Test.project2025()))).get("plan")));
        assertThat(RequirementChecker.verdicts(v).get("blackouts")).isEqualTo(RequirementChecker.INFO);
        assertThat(RequirementChecker.verdicts(v).get("season-range")).isEqualTo(RequirementChecker.INFO);
        assertThat(RequirementChecker.verdicts(v).get("opening")).isEqualTo(RequirementChecker.INFO);
        // 5/5(월)은 예외로 정해 두지 않았으니 휴식 요일 항목이 어김으로 나온다 — 정직한 결과
        assertThat(RequirementChecker.failedIds(v)).containsExactly("rest-weekdays");
    }
}
