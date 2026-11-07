package org.optaplanner.examples.baseball.web;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

/**
 * 요구 사항 점검기. 완성된 일정을 시리즈 → 연전 기간 → 날짜별 경기로 풀어서, 프로젝트가 정한 값(settings·events)과 직접 비교한다.
 * <p>
 * 엔진 점수 공식({@code ScoreFormulas}·{@code BaseballConstraintProvider}·{@code ui/core/score.js})을 <b>쓰지 않는다</b>.
 * 점수 공식에 빠진 규칙이나 틀린 규칙이 있어도 여기서 따로 잡히도록, 요구 사항 문장을 보고 다시 센다. 어긴 항목이 있어도
 * 결과를 막지 않는다 — 판정과 근거를 돌려주고 화면이 보여 준다.
 * <p>
 * 입력은 UI 프로젝트 JSON(teams·calendar·matches·settings·events)과 plan([{match, calendar}])이다. 시리즈 id = matches 위치,
 * 연전 기간 id = calendar 위치({@link ProblemCodec}과 같다). 출력은 항목마다 {@code verdict}(PASS·FAIL·INFO), 기준(standard·source),
 * 결과 한 줄(result), 근거 표(columns·rows; 줄에 date가 있으면 화면이 그 날로 이동)다. INFO = 그 항목의 정한 값이 없어 판정하지 않고
 * 센 값만 보여 준다.
 */
public final class RequirementChecker {

    static final String PASS = "PASS";
    static final String FAIL = "FAIL";
    static final String INFO = "INFO";

    private static final String[] WEEKDAY_KO = {"일", "월", "화", "수", "목", "금", "토"};
    private static final int DEFAULT_GAMES_PER_PAIR = 15;
    private static final int DEFAULT_SERIES_MIN = 3;
    private static final int MAX_STREAK = 3;

    private RequirementChecker() {
    }

    // ───────────── 자료 ─────────────

    record Slot(int id, LocalDate start, int length) {
        LocalDate end() {
            return start.plusDays(length - 1L);
        }
    }

    record Series(int id, String home, String away, int length) {
    }

    /** 날짜 하나의 경기 하나. */
    record Game(LocalDate date, String home, String away, String stadium, int series, int slot) {
    }

    /** 한 구단이 치르는 시리즈 하나(날짜순 흐름에 쓴다). */
    record Visit(int slot, LocalDate start, LocalDate end, String opponent, boolean home, String stadium, int series) {
    }

    private static final class Input {
        final Map<String, String> stadiumOf = new LinkedHashMap<>();
        final List<String> teams = new ArrayList<>();
        final List<Slot> slots = new ArrayList<>();
        final List<Series> series = new ArrayList<>();
        final Map<Integer, Integer> slotOfSeries = new HashMap<>();
        final JSONObject settings;
        final List<JSONObject> events = new ArrayList<>();
        final List<Game> games = new ArrayList<>();
        final TreeMap<LocalDate, List<Game>> byDate = new TreeMap<>();
        final Map<String, List<Visit>> flow = new LinkedHashMap<>();
        final int half;

        Input(JSONObject problem, JSONArray planOverride) {
            JSONArray teamArr = Json.array(problem.get("teams"));
            if (teamArr == null) {
                throw new IllegalArgumentException("problem.teams 배열이 없습니다.");
            }
            for (Object t : teamArr) {
                JSONObject o = Json.object(t);
                if (o == null) {
                    throw new IllegalArgumentException("problem.teams 항목이 객체가 아닙니다.");
                }
                String name = Json.asString(o.get("name"), "");
                teams.add(name);
                stadiumOf.put(name, Json.asString(o.get("stadium"), ""));
            }
            half = teams.size() / 2;
            JSONArray cal = Json.array(problem.get("calendar"));
            if (cal == null) {
                throw new IllegalArgumentException("problem.calendar 배열이 없습니다.");
            }
            for (int i = 0; i < cal.size(); i++) {
                JSONObject c = Json.object(cal.get(i));
                LocalDate d = c == null ? null : parseDate(Json.asString(c.get("datetime"), ""));
                if (d == null) {
                    throw new IllegalArgumentException("연전 기간 " + i + "의 날짜를 읽지 못했습니다.");
                }
                slots.add(new Slot(i, d, (int) Json.asLong(c.get("consecutive"), 3)));
            }
            JSONArray matches = Json.array(problem.get("matches"));
            if (matches == null) {
                throw new IllegalArgumentException("problem.matches 배열이 없습니다.");
            }
            for (int i = 0; i < matches.size(); i++) {
                JSONObject m = Json.object(matches.get(i));
                if (m == null) {
                    throw new IllegalArgumentException("시리즈 " + i + "이(가) 객체가 아닙니다.");
                }
                series.add(new Series(i, Json.asString(m.get("home"), ""), Json.asString(m.get("away"), ""),
                        (int) Json.asLong(m.get("consecutive"), 3)));
            }
            JSONArray plan = planOverride != null ? planOverride : Json.array(problem.get("plan"));
            if (plan != null) {
                for (Object p : plan) {
                    JSONObject e = Json.object(p);
                    if (e == null) {
                        continue;
                    }
                    int s = (int) Json.asLong(e.get("match"), -1);
                    int slot = (int) Json.asLong(e.get("calendar"), -1);
                    if (s >= 0 && s < series.size() && slot >= 0 && slot < slots.size()) {
                        slotOfSeries.put(s, slot);
                    }
                }
            }
            JSONObject st = Json.object(problem.get("settings"));
            settings = st == null ? new JSONObject() : st;
            JSONArray ev = Json.array(problem.get("events"));
            if (ev != null) {
                for (Object e : ev) {
                    JSONObject o = Json.object(e);
                    if (o != null && "STADIUM".equals(Json.asString(o.get("mode"), ""))) {
                        events.add(o);
                    }
                }
            }
            expand();
        }

        /** 시리즈 → 연전 기간의 날짜마다 경기 하나. 날짜는 연전 기간의 길이로 센다(시리즈 길이와 다른지는 따로 본다). */
        private void expand() {
            for (Series s : series) {
                Integer slotId = slotOfSeries.get(s.id());
                if (slotId == null) {
                    continue;
                }
                Slot slot = slots.get(slotId);
                for (int k = 0; k < slot.length(); k++) {
                    Game g = new Game(slot.start().plusDays(k), s.home(), s.away(), stadiumOf.getOrDefault(s.home(), ""), s.id(), slotId);
                    games.add(g);
                    byDate.computeIfAbsent(g.date(), d -> new ArrayList<>()).add(g);
                }
                for (int i = 0; i < 2; i++) {
                    String me = i == 0 ? s.home() : s.away();
                    String opp = i == 0 ? s.away() : s.home();
                    flow.computeIfAbsent(me, t -> new ArrayList<>())
                            .add(new Visit(slotId, slot.start(), slot.end(), opp, i == 0, stadiumOf.getOrDefault(s.home(), ""), s.id()));
                }
            }
            for (String t : teams) {
                flow.computeIfAbsent(t, k -> new ArrayList<>())
                        .sort(Comparator.comparing(Visit::start).thenComparingInt(Visit::series));
            }
            for (List<Game> list : byDate.values()) {
                list.sort(Comparator.comparingInt(Game::series));
            }
        }

        /**
         * 점검한 일정의 지문: 시리즈 목록(홈>원정/연전) · 연전 기간(시작일/연전) · 배정(시리즈 id 순 기간 id, 미배정 -1)을 한 줄로 잇고
         * FNV-1a 32비트로 줄인 8자리 16진수. 화면({@code ui/core/engine-adapter.js planSignature})이 같은 식으로 지금 일정의 지문을 만들어
         * 견주고, 다르면 「다른 일정의 점검표」라고 알린다 — 점검표가 보이는 일정의 것인지 서버가 아니라 지문이 증명한다.
         */
        String signature() {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < series.size(); i++) {
                Series s = series.get(i);
                sb.append(i > 0 ? "," : "").append(s.home()).append('>').append(s.away()).append('/').append(s.length());
            }
            sb.append('|');
            for (int i = 0; i < slots.size(); i++) {
                Slot s = slots.get(i);
                sb.append(i > 0 ? "," : "").append(s.start()).append('/').append(s.length());
            }
            sb.append('|');
            for (int i = 0; i < series.size(); i++) {
                sb.append(i > 0 ? "," : "").append(slotOfSeries.getOrDefault(i, -1));
            }
            return fnv1a(sb.toString());
        }

        Slot slotContaining(LocalDate d) {
            for (Slot s : slots) {
                if (!d.isBefore(s.start()) && !d.isAfter(s.end())) {
                    return s;
                }
            }
            return null;
        }

        List<Series> seriesIn(int slotId) {
            List<Series> out = new ArrayList<>();
            for (Series s : series) {
                if (slotOfSeries.containsKey(s.id()) && slotOfSeries.get(s.id()) == slotId) {
                    out.add(s);
                }
            }
            return out;
        }

        int seasonYear() {
            LocalDate d = parseDate(Json.asString(settings.get("seasonStart"), ""));
            return d != null ? d.getYear() : slots.isEmpty() ? LocalDate.now().getYear() : slots.get(0).start().getYear();
        }
    }

    /** 항목 하나를 모으는 그릇. */
    private static final class Item {
        final String id;
        final String group;
        final String title;
        final String desc;
        String verdict = PASS;
        String standard = "";
        String source = "";
        String result = "";
        final List<String[]> columns = new ArrayList<>();
        final List<JSONObject> rows = new ArrayList<>();

        Item(String id, String group, String title, String desc) {
            this.id = id;
            this.group = group;
            this.title = title;
            this.desc = desc;
        }

        Item columns(String... keyLabelPairs) {
            for (int i = 0; i + 1 < keyLabelPairs.length; i += 2) {
                columns.add(new String[] {keyLabelPairs[i], keyLabelPairs[i + 1]});
            }
            return this;
        }

        JSONObject row(Object... keyValues) {
            JSONObject r = Json.obj(keyValues);
            rows.add(r);
            return r;
        }

        void standard(String text, String src) {
            standard = text;
            source = src;
        }

        void fail(String text) {
            verdict = FAIL;
            result = text;
        }

        void info(String text) {
            verdict = INFO;
            result = text;
        }

        void pass(String text) {
            verdict = PASS;
            result = text;
        }

        JSONObject toJson() {
            List<JSONObject> cols = new ArrayList<>();
            for (String[] c : columns) {
                cols.add(Json.obj("key", c[0], "label", c[1]));
            }
            return Json.obj("id", id, "group", group, "title", title, "desc", desc, "verdict", verdict, "standard", standard,
                    "source", source, "result", result, "columns", Json.arr(cols), "rows", Json.arr(rows));
        }
    }

    private static final String[][] GROUPS = {
            {"special", "특별 경기", "개막전·어린이날처럼 날짜와 홈 구단을 정해 둔 경기"},
            {"count", "경기 수", "맞대결마다, 구단마다 정한 경기 수"},
            {"dates", "날짜", "쉬는 날과 시즌 기간"},
            {"length", "연전 길이", "연전 묶음의 길이"},
            {"second", "후반기 첫 4연전", "올스타 휴식기 뒤 첫 4연전의 대진"},
            {"daily", "하루 단위", "날마다 모든 구단이 한 번씩, 구장마다 한 경기"},
            {"flow", "흐름", "구단별 홈·원정 흐름"},
            {"assign", "배정", "모든 시리즈에 날짜가 있는지"}};

    // ───────────── 점검 ─────────────

    /** 프로젝트 JSON과 plan(없으면 problem.plan)을 점검한다. 예외 대신 항목마다 판정을 돌려준다. */
    public static JSONObject check(JSONObject problem, JSONArray plan) {
        Input in = new Input(problem, plan);
        List<Item> items = new ArrayList<>();
        checkOpening(in, items);
        checkChildrenDay(in, items);
        checkOtherStadiumEvents(in, items);
        checkPairGames(in, items);
        checkHomeTotals(in, items);
        checkRestWeekdays(in, items);
        checkBlackouts(in, items);
        checkSeasonRange(in, items);
        checkSeriesLengths(in, items);
        checkLengthMatch(in, items);
        checkFourGameSeries(in, items);
        checkDailyTeams(in, items);
        checkDailyStadiums(in, items);
        checkStreaks(in, items);
        checkRepeatOpponent(in, items);
        checkUnassigned(in, items);
        return toJson(in, items);
    }

    private static JSONObject toJson(Input in, List<Item> items) {
        long passed = 0;
        long failed = 0;
        long info = 0;
        List<JSONObject> groups = new ArrayList<>();
        for (String[] g : GROUPS) {
            List<JSONObject> list = new ArrayList<>();
            long groupFailed = 0;
            for (Item it : items) {
                if (it.group.equals(g[0])) {
                    list.add(it.toJson());
                    if (FAIL.equals(it.verdict)) {
                        groupFailed++;
                    }
                }
            }
            groups.add(Json.obj("id", g[0], "title", g[1], "desc", g[2], "failed", groupFailed, "items", Json.arr(list)));
        }
        List<String> failedTitles = new ArrayList<>();
        for (Item it : items) {
            switch (it.verdict) {
                case FAIL -> {
                    failed++;
                    failedTitles.add(it.title);
                }
                case INFO -> info++;
                default -> passed++;
            }
        }
        return Json.obj("checkedAt", Instant.now().toString(), "method", "서버가 완성된 일정을 날짜별 경기로 풀어 다시 셈(엔진 점수와 따로)",
                "planSig", in.signature(),
                "total", passed + failed, "passed", passed, "failed", failed, "info", info, "ok", failed == 0,
                "failedTitles", Json.arr(failedTitles), "groups", Json.arr(groups), "tables", tables(in));
    }

    /** 근거 원자료: 날짜별 경기(시즌 전체), 구단별 홈/원정 흐름. */
    private static JSONObject tables(Input in) {
        List<JSONObject> days = new ArrayList<>();
        for (Map.Entry<LocalDate, List<Game>> e : in.byDate.entrySet()) {
            List<JSONObject> gs = new ArrayList<>();
            for (Game g : e.getValue()) {
                gs.add(Json.obj("home", g.home(), "away", g.away(), "stadium", g.stadium(), "slot", (long) g.slot(), "series", (long) g.series()));
            }
            days.add(Json.obj("date", e.getKey().toString(), "weekday", weekdayKo(e.getKey()), "games", Json.arr(gs)));
        }
        JSONObject flow = new JSONObject();
        for (String t : in.teams) {
            List<JSONObject> vs = new ArrayList<>();
            for (Visit v : in.flow.getOrDefault(t, List.of())) {
                vs.add(Json.obj("slot", (long) v.slot(), "date", v.start().toString(), "end", v.end().toString(), "opponent", v.opponent(),
                        "home", v.home(), "stadium", v.stadium(), "series", (long) v.series()));
            }
            flow.put(t, Json.arr(vs));
        }
        return Json.obj("days", Json.arr(days), "flow", flow, "teams", Json.arr(in.teams));
    }

    // ───── 특별 경기 ─────

    private static JSONObject findEvent(Input in, String type) {
        for (JSONObject ev : in.events) {
            if (type.equals(Json.asString(ev.get("type"), ""))) {
                return ev;
            }
        }
        return null;
    }

    private static Slot eventSlot(Input in, JSONObject ev) {
        LocalDate d = parseDate(Json.asString(ev.get("date"), ""));
        if (d != null) {
            Slot s = in.slotContaining(d);
            if (s != null) {
                return s;
            }
        }
        long slot = Json.asLong(ev.get("slot"), -1);
        return slot >= 0 && slot < in.slots.size() ? in.slots.get((int) slot) : null;
    }

    private static List<String> names(Object arr) {
        List<String> out = new ArrayList<>();
        JSONArray a = Json.array(arr);
        if (a != null) {
            for (Object o : a) {
                String s = Json.asString(o, "");
                if (!s.isEmpty()) {
                    out.add(s);
                }
            }
        }
        return out;
    }

    /** [{home, away}] → "원정@홈" 목록. */
    private static List<String[]> pairs(Object arr) {
        List<String[]> out = new ArrayList<>();
        JSONArray a = Json.array(arr);
        if (a != null) {
            for (Object o : a) {
                JSONObject p = Json.object(o);
                if (p != null) {
                    out.add(new String[] {Json.asString(p.get("home"), ""), Json.asString(p.get("away"), "")});
                }
            }
        }
        return out;
    }

    private static void checkOpening(Input in, List<Item> items) {
        Item it = new Item("opening", "special", "개막전", "개막일 연전의 홈 구단(또는 대진)이 정한 대로인지");
        it.columns("date", "날짜", "away", "원정", "home", "홈", "stadium", "구장", "judge", "판정");
        items.add(it);
        JSONObject ev = findEvent(in, "OPENING");
        Slot slot = ev == null ? null : eventSlot(in, ev);
        if (slot == null) {
            slot = in.slots.isEmpty() ? null : in.slots.get(0);
        }
        if (slot == null) {
            it.info("연전 기간이 없어 볼 수 없습니다.");
            return;
        }
        LocalDate day = slot.start();
        List<Game> games = in.byDate.getOrDefault(day, List.of());
        List<String[]> wantPairs = ev == null ? List.of() : pairs(ev.get("pairs"));
        List<String> wantHomes = ev == null ? List.of() : names(ev.get("teams"));
        if (wantHomes.isEmpty()) {
            for (String[] p : wantPairs) {
                wantHomes.add(p[0]);
            }
        }
        Set<String> homes = new LinkedHashSet<>();
        Map<String, String> awayOfHome = new HashMap<>();
        for (Game g : games) {
            homes.add(g.home());
            awayOfHome.put(g.home(), g.away());
        }
        int bad = 0;
        for (Game g : games) {
            String judge = "";
            if (!wantPairs.isEmpty()) {
                boolean ok = false;
                for (String[] p : wantPairs) {
                    if (p[0].equals(g.home()) && p[1].equals(g.away())) {
                        ok = true;
                    }
                }
                judge = ok ? "정한 대진" : "정한 대진 아님";
                if (!ok) {
                    bad++;
                }
            } else if (!wantHomes.isEmpty()) {
                boolean ok = wantHomes.contains(g.home());
                judge = ok ? "정한 홈" : "정한 홈 아님";
                if (!ok) {
                    bad++;
                }
            }
            it.row("date", g.date().toString(), "away", g.away(), "home", g.home(), "stadium", g.stadium(), "judge", judge);
        }
        if (!wantPairs.isEmpty()) {
            List<String> text = new ArrayList<>();
            for (String[] p : wantPairs) {
                text.add(p[1] + "@" + p[0]);
                if (!p[1].equals(awayOfHome.get(p[0]))) {
                    bad++;
                    it.row("date", day.toString(), "away", p[1], "home", p[0], "stadium", in.stadiumOf.getOrDefault(p[0], ""), "judge", "정한 대진이 없음");
                }
            }
            it.standard(fmt(day) + " 대진 " + String.join(" · ", text), "개막전 설정(대진까지 고정)");
        } else if (!wantHomes.isEmpty()) {
            for (String h : wantHomes) {
                if (!homes.contains(h)) {
                    bad++;
                    it.row("date", day.toString(), "away", "", "home", h, "stadium", in.stadiumOf.getOrDefault(h, ""), "judge", "홈 경기가 없음");
                }
            }
            it.standard(fmt(day) + " 홈 구단 " + String.join("·", wantHomes), "개막전 설정(홈 구장 지정)");
        } else {
            it.standard("정한 값 없음", "개막전 설정이 없음");
            it.info(fmt(day) + " 경기 " + games.size() + "개를 보여 줍니다(정한 홈 구단이 없어 판정하지 않음).");
            return;
        }
        if (bad == 0) {
            it.pass(fmt(day) + " 경기 " + games.size() + "개 모두 정한 대로입니다.");
        } else {
            it.fail(fmt(day) + " 경기 중 " + bad + "개가 정한 것과 다릅니다.");
        }
    }

    private static void checkChildrenDay(Input in, List<Item> items) {
        Item it = new Item("children", "special", "어린이날", "어린이날이 든 연전의 홈 구단이 정한 5곳인지");
        it.columns("date", "날짜", "away", "원정", "home", "홈", "stadium", "구장", "judge", "판정");
        items.add(it);
        JSONObject ev = findEvent(in, "CHILDREN");
        LocalDate day = ev == null ? null : parseDate(Json.asString(ev.get("date"), ""));
        if (day == null) {
            day = LocalDate.of(in.seasonYear(), 5, 5);
        }
        Slot slot = ev == null ? in.slotContaining(day) : eventSlot(in, ev);
        if (slot == null) {
            slot = in.slotContaining(day);
        }
        List<String> want = ev == null ? List.of() : names(ev.get("teams"));
        List<String> obligation = names(in.settings.get("obligationTeams"));
        // ProblemCodec.applyHomeDesignations와 같은 우선순위: 일부만 고른 teams가 아니면 obligationTeams
        if (!obligation.isEmpty() && (want.size() >= in.half || (want.isEmpty() && (ev == null || ev.get("teams") == null)))) {
            want = obligation;
        }
        if (slot == null) {
            it.standard(want.isEmpty() ? "정한 값 없음" : "홈 구단 " + String.join("·", want), "어린이날 설정");
            it.info(fmt(day) + "은 경기일이 아닙니다.");
            return;
        }
        LocalDate shown = day.isBefore(slot.start()) || day.isAfter(slot.end()) ? slot.start() : day;
        List<Game> games = in.byDate.getOrDefault(shown, List.of());
        if (want.isEmpty()) {
            for (Game g : games) {
                it.row("date", g.date().toString(), "away", g.away(), "home", g.home(), "stadium", g.stadium(), "judge", "");
            }
            it.standard("정한 값 없음", "어린이날 홈 구단 설정이 없음");
            it.info(fmt(shown) + " 경기 " + games.size() + "개를 보여 줍니다(정한 홈 구단이 없어 판정하지 않음).");
            return;
        }
        Set<String> homes = new LinkedHashSet<>();
        int bad = 0;
        for (Game g : games) {
            homes.add(g.home());
            boolean ok = want.contains(g.home());
            if (!ok) {
                bad++;
            }
            it.row("date", g.date().toString(), "away", g.away(), "home", g.home(), "stadium", g.stadium(), "judge", ok ? "정한 홈" : "정한 홈 아님");
        }
        for (String h : want) {
            if (!homes.contains(h)) {
                bad++;
                it.row("date", shown.toString(), "away", "", "home", h, "stadium", in.stadiumOf.getOrDefault(h, ""), "judge", "홈 경기가 없음");
            }
        }
        it.standard(fmt(shown) + " 홈 구단 " + String.join("·", want), ev != null && want != obligation ? "어린이날 설정(홈 구장 지정)" : "어린이날 홈 구단 설정");
        if (bad == 0) {
            it.pass(fmt(shown) + " 홈 구단 " + homes.size() + "곳 모두 정한 대로입니다.");
        } else {
            it.fail(fmt(shown) + " 홈 구단 중 " + bad + "곳이 정한 것과 다릅니다.");
        }
    }

    private static void checkOtherStadiumEvents(Input in, List<Item> items) {
        int n = 0;
        for (JSONObject ev : in.events) {
            String type = Json.asString(ev.get("type"), "");
            if ("OPENING".equals(type) || "CHILDREN".equals(type)) {
                continue;
            }
            n++;
            String name = Json.asString(ev.get("name"), "구장 지정 " + n);
            Item it = new Item("stadium-" + n, "special", name, "직접 더한 구장 지정: 그 날 연전의 홈 구단(또는 대진)이 정한 대로인지");
            it.columns("date", "날짜", "away", "원정", "home", "홈", "stadium", "구장", "judge", "판정");
            items.add(it);
            Slot slot = eventSlot(in, ev);
            List<String[]> wantPairs = pairs(ev.get("pairs"));
            List<String> wantHomes = names(ev.get("teams"));
            if (wantHomes.isEmpty()) {
                for (String[] p : wantPairs) {
                    wantHomes.add(p[0]);
                }
            }
            if (slot == null) {
                it.standard(wantHomes.isEmpty() ? "정한 값 없음" : "홈 구단 " + String.join("·", wantHomes), "직접 더한 구장 지정");
                it.info("그 날짜가 경기일이 아니라 볼 수 없습니다.");
                continue;
            }
            LocalDate d = parseDate(Json.asString(ev.get("date"), ""));
            LocalDate shown = d == null || d.isBefore(slot.start()) || d.isAfter(slot.end()) ? slot.start() : d;
            List<Game> games = in.byDate.getOrDefault(shown, List.of());
            if (wantHomes.isEmpty()) {
                it.standard("정한 값 없음", "직접 더한 구장 지정(구단 없음)");
                it.info(fmt(shown) + " 경기 " + games.size() + "개를 보여 줍니다(정한 구단이 없어 판정하지 않음).");
                for (Game g : games) {
                    it.row("date", g.date().toString(), "away", g.away(), "home", g.home(), "stadium", g.stadium(), "judge", "");
                }
                continue;
            }
            int bad = 0;
            Set<String> homes = new LinkedHashSet<>();
            Map<String, String> awayOfHome = new HashMap<>();
            for (Game g : games) {
                homes.add(g.home());
                awayOfHome.put(g.home(), g.away());
                boolean ok = wantHomes.contains(g.home()) || wantHomes.isEmpty();
                it.row("date", g.date().toString(), "away", g.away(), "home", g.home(), "stadium", g.stadium(), "judge", ok ? "정한 홈" : "");
            }
            for (String h : wantHomes) {
                if (!homes.contains(h)) {
                    bad++;
                    it.row("date", shown.toString(), "away", "", "home", h, "stadium", in.stadiumOf.getOrDefault(h, ""), "judge", "홈 경기가 없음");
                }
            }
            for (String[] p : wantPairs) {
                if (!p[1].equals(awayOfHome.get(p[0]))) {
                    bad++;
                    it.row("date", shown.toString(), "away", p[1], "home", p[0], "stadium", in.stadiumOf.getOrDefault(p[0], ""), "judge", "정한 대진이 없음");
                }
            }
            it.standard(fmt(shown) + (wantPairs.isEmpty() ? " 홈 구단 " + String.join("·", wantHomes) : " 대진 " + pairText(wantPairs)), "직접 더한 구장 지정");
            if (bad == 0) {
                it.pass(fmt(shown) + " 정한 구단 " + wantHomes.size() + "곳 모두 홈입니다.");
            } else {
                it.fail(fmt(shown) + " 정한 것 중 " + bad + "개가 지켜지지 않았습니다.");
            }
        }
    }

    private static String pairText(List<String[]> ps) {
        List<String> t = new ArrayList<>();
        for (String[] p : ps) {
            t.add(p[1] + "@" + p[0]);
        }
        return String.join(" · ", t);
    }

    // ───── 경기 수 ─────

    private static String pairKey(String a, String b) {
        return a.compareTo(b) <= 0 ? a + "|" + b : b + "|" + a;
    }

    private static void checkPairGames(Input in, List<Item> items) {
        Item it = new Item("pair-games", "count", "맞대결 경기 수", "구단 두 곳이 맞붙는 경기 수가 모두 같은지(배정 여부와 상관없이 시리즈 길이의 합)");
        it.columns("a", "구단", "b", "상대", "games", "경기", "homeA", "구단 홈", "homeB", "상대 홈", "judge", "판정");
        items.add(it);
        Object raw = in.settings.get("initialGamesPerPair");
        int want = (int) Json.asLong(raw, DEFAULT_GAMES_PER_PAIR);
        it.standard("맞대결마다 " + want + "경기", raw == null ? "기본값(KBO 1차 편성 15경기)" : "경기 수 설정");
        Map<String, int[]> count = new TreeMap<>();
        for (int i = 0; i < in.teams.size(); i++) {
            for (int j = i + 1; j < in.teams.size(); j++) {
                count.put(pairKey(in.teams.get(i), in.teams.get(j)), new int[2]);
            }
        }
        for (Series s : in.series) {
            int[] c = count.computeIfAbsent(pairKey(s.home(), s.away()), k -> new int[2]);
            if (s.home().compareTo(s.away()) <= 0) {
                c[0] += s.length();
            } else {
                c[1] += s.length();
            }
        }
        int bad = 0;
        for (Map.Entry<String, int[]> e : count.entrySet()) {
            String[] ab = e.getKey().split("\\|");
            int total = e.getValue()[0] + e.getValue()[1];
            boolean ok = total == want;
            if (!ok) {
                bad++;
            }
            it.row("a", ab[0], "b", ab[1], "games", (long) total, "homeA", (long) e.getValue()[0], "homeB", (long) e.getValue()[1],
                    "judge", ok ? "" : want + "경기가 아님");
        }
        if (bad == 0) {
            it.pass("맞대결 " + count.size() + "쌍 모두 " + want + "경기입니다.");
        } else {
            it.fail("맞대결 " + count.size() + "쌍 중 " + bad + "쌍이 " + want + "경기가 아닙니다.");
        }
    }

    private static void checkHomeTotals(Input in, List<Item> items) {
        Item it = new Item("home-totals", "count", "구단별 홈 경기 수", "구단마다 1차 편성 홈 경기 수가 정한 값인지");
        it.columns("team", "구단", "home", "홈", "away", "원정", "want", "정한 값", "judge", "판정");
        items.add(it);
        Map<String, int[]> count = new LinkedHashMap<>();
        for (String t : in.teams) {
            count.put(t, new int[2]);
        }
        for (Series s : in.series) {
            count.computeIfAbsent(s.home(), k -> new int[2])[0] += s.length();
            count.computeIfAbsent(s.away(), k -> new int[2])[1] += s.length();
        }
        JSONObject ht = Json.object(in.settings.get("homeTotals"));
        JSONObject more = ht == null ? null : Json.object(ht.get("more"));
        JSONObject less = ht == null ? null : Json.object(ht.get("less"));
        Set<String> moreTeams = ht == null ? Set.of() : new LinkedHashSet<>(names(ht.get("moreTeams")));
        long moreInitial = more == null ? -1 : Json.asLong(more.get("initial"), -1);
        long lessInitial = less == null ? -1 : Json.asLong(less.get("initial"), -1);
        boolean defined = ht != null && moreInitial >= 0 && lessInitial >= 0;
        int bad = 0;
        for (Map.Entry<String, int[]> e : count.entrySet()) {
            long want = defined ? (moreTeams.contains(e.getKey()) ? moreInitial : lessInitial) : -1;
            boolean ok = !defined || e.getValue()[0] == want;
            if (!ok) {
                bad++;
            }
            it.row("team", e.getKey(), "home", (long) e.getValue()[0], "away", (long) e.getValue()[1], "want", defined ? (Object) want : "",
                    "judge", defined ? (ok ? "" : "정한 값과 다름") : "");
        }
        if (!defined) {
            it.standard("정한 값 없음", "홈 경기 수(1차 편성) 설정이 없음");
            it.info("구단별 홈·원정 경기 수를 보여 줍니다(정한 값이 없어 판정하지 않음).");
            return;
        }
        it.standard("홈 " + moreInitial + "경기 구단 " + String.join("·", moreTeams) + " · 나머지 " + lessInitial + "경기", "홈 경기 수 설정(1차 편성분)");
        if (bad == 0) {
            it.pass("구단 " + count.size() + "곳 모두 정한 홈 경기 수입니다.");
        } else {
            it.fail("구단 " + count.size() + "곳 중 " + bad + "곳이 정한 홈 경기 수와 다릅니다.");
        }
    }

    // ───── 날짜 ─────

    private static Set<LocalDate> dateSet(Object arr) {
        Set<LocalDate> out = new LinkedHashSet<>();
        JSONArray a = Json.array(arr);
        if (a != null) {
            for (Object o : a) {
                LocalDate d = parseDate(o instanceof JSONObject jo ? Json.asString(jo.get("date"), "") : Json.asString(o, ""));
                if (d != null) {
                    out.add(d);
                }
            }
        }
        return out;
    }

    record Range(LocalDate start, LocalDate end, String label) {
    }

    private static List<Range> ranges(Object arr) {
        List<Range> out = new ArrayList<>();
        JSONArray a = Json.array(arr);
        if (a != null) {
            for (Object o : a) {
                JSONObject r = Json.object(o);
                if (r == null) {
                    continue;
                }
                LocalDate s = parseDate(Json.asString(r.get("start"), Json.asString(r.get("date"), "")));
                LocalDate e = parseDate(Json.asString(r.get("end"), ""));
                if (s == null) {
                    continue;
                }
                if (e == null || e.isBefore(s)) {
                    e = s;
                }
                out.add(new Range(s, e, Json.asString(r.get("label"), "")));
            }
        }
        return out;
    }

    private static LocalDate[] seasonRange(Input in) {
        LocalDate a = parseDate(Json.asString(in.settings.get("seasonStart"), ""));
        LocalDate b = parseDate(Json.asString(in.settings.get("initialEnd"), ""));
        if (a == null || b == null || a.isAfter(b)) {
            return null;
        }
        return new LocalDate[] {a, b};
    }

    private static void checkRestWeekdays(Input in, List<Item> items) {
        Item it = new Item("rest-weekdays", "dates", "휴식 요일", "휴식 요일(보통 월요일)에 경기가 없는지. 예외로 정한 날은 뺀다");
        it.columns("date", "날짜", "weekday", "요일", "games", "경기 수", "judge", "판정");
        items.add(it);
        Object raw = in.settings.get("restWeekdays");
        Set<Integer> rest = new LinkedHashSet<>();
        JSONArray ra = Json.array(raw);
        if (ra != null) {
            for (Object o : ra) {
                rest.add((int) Json.asLong(o, -1));
            }
        } else {
            rest.add(1);
        }
        Set<LocalDate> exceptions = dateSet(in.settings.get("restExceptions"));
        LocalDate[] range = seasonRange(in);
        LocalDate from = range != null ? range[0] : in.byDate.isEmpty() ? null : in.byDate.firstKey();
        LocalDate to = range != null ? range[1] : in.byDate.isEmpty() ? null : in.byDate.lastKey();
        List<String> restNames = new ArrayList<>();
        for (int w : rest) {
            if (w >= 0 && w < 7) {
                restNames.add(WEEKDAY_KO[w] + "요일");
            }
        }
        List<String> exText = new ArrayList<>();
        for (LocalDate d : exceptions) {
            exText.add(fmt(d));
        }
        it.standard(String.join("·", restNames) + " 경기 없음" + (exText.isEmpty() ? "" : " (예외: " + String.join(", ", exText) + ")"),
                raw == null ? "기본값(월요일 휴식)" : "휴식 요일 설정");
        if (from == null) {
            it.info("경기가 없어 볼 수 없습니다.");
            return;
        }
        int bad = 0;
        int days = 0;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            int w = d.getDayOfWeek().getValue() % 7;
            if (!rest.contains(w)) {
                continue;
            }
            days++;
            int n = in.byDate.getOrDefault(d, List.of()).size();
            boolean exception = exceptions.contains(d);
            boolean ok = n == 0 || exception;
            if (!ok) {
                bad++;
            }
            it.row("date", d.toString(), "weekday", weekdayKo(d), "games", (long) n, "judge", exception ? "예외로 정한 날(경기 " + n + ")" : ok ? "" : "휴식 요일에 경기");
        }
        if (bad == 0) {
            it.pass("휴식 요일 " + days + "일 모두 경기가 없습니다" + (exText.isEmpty() ? "." : "(예외 " + exceptions.size() + "일 제외)."));
        } else {
            it.fail("휴식 요일 " + days + "일 중 " + bad + "일에 경기가 있습니다.");
        }
    }

    private static void checkBlackouts(Input in, List<Item> items) {
        Item it = new Item("blackouts", "dates", "휴식기", "올스타 휴식기처럼 경기 없는 기간에 경기가 없는지");
        it.columns("date", "날짜", "weekday", "요일", "label", "기간", "games", "경기 수", "judge", "판정");
        items.add(it);
        Object raw = in.settings.get("blackouts");
        List<Range> ranges = ranges(raw);
        if (raw == null || ranges.isEmpty()) {
            it.standard("정한 값 없음", "경기 없는 기간 설정이 없음");
            it.info("경기 없는 기간을 정하지 않아 판정하지 않습니다.");
            return;
        }
        List<String> text = new ArrayList<>();
        int bad = 0;
        int days = 0;
        for (Range r : ranges) {
            String label = r.label();
            text.add((label.isEmpty() ? "" : label + " ") + fmt(r.start()) + (r.end().equals(r.start()) ? "" : "~" + fmt(r.end())));
            for (LocalDate d = r.start(); !d.isAfter(r.end()); d = d.plusDays(1)) {
                days++;
                int n = in.byDate.getOrDefault(d, List.of()).size();
                if (n > 0) {
                    bad++;
                }
                it.row("date", d.toString(), "weekday", weekdayKo(d), "label", label, "games", (long) n, "judge", n > 0 ? "휴식기에 경기" : "");
            }
        }
        it.standard(String.join(" · ", text) + " 경기 없음", "경기 없는 기간 설정");
        if (bad == 0) {
            it.pass("휴식기 " + days + "일 모두 경기가 없습니다.");
        } else {
            it.fail("휴식기 " + days + "일 중 " + bad + "일에 경기가 있습니다.");
        }
    }

    private static void checkSeasonRange(Input in, List<Item> items) {
        Item it = new Item("season-range", "dates", "시즌 기간", "모든 경기가 개막일부터 1차 편성 종료일 사이에 있는지");
        it.columns("what", "구분", "date", "날짜", "games", "경기 수", "judge", "판정");
        items.add(it);
        LocalDate[] range = seasonRange(in);
        if (in.byDate.isEmpty()) {
            it.info("경기가 없어 볼 수 없습니다.");
            return;
        }
        LocalDate first = in.byDate.firstKey();
        LocalDate last = in.byDate.lastKey();
        if (range == null) {
            it.standard("정한 값 없음", "개막일·1차 편성 종료일 설정이 없음");
            it.row("what", "첫 경기", "date", first.toString(), "games", (long) in.byDate.get(first).size(), "judge", "");
            it.row("what", "마지막 경기", "date", last.toString(), "games", (long) in.byDate.get(last).size(), "judge", "");
            it.info("첫 경기 " + fmt(first) + ", 마지막 경기 " + fmt(last) + "(정한 기간이 없어 판정하지 않음).");
            return;
        }
        it.standard(fmt(range[0]) + " ~ " + fmt(range[1]), "개막일·1차 편성 종료일 설정");
        int bad = 0;
        for (Map.Entry<LocalDate, List<Game>> e : in.byDate.entrySet()) {
            if (e.getKey().isBefore(range[0]) || e.getKey().isAfter(range[1])) {
                bad++;
                it.row("what", "기간 밖", "date", e.getKey().toString(), "games", (long) e.getValue().size(), "judge", "시즌 기간 밖 경기");
            }
        }
        it.row("what", "첫 경기", "date", first.toString(), "games", (long) in.byDate.get(first).size(), "judge", first.isBefore(range[0]) ? "개막일보다 앞" : "");
        it.row("what", "마지막 경기", "date", last.toString(), "games", (long) in.byDate.get(last).size(), "judge", last.isAfter(range[1]) ? "종료일보다 뒤" : "");
        if (bad == 0) {
            it.pass("경기일 " + in.byDate.size() + "일 모두 기간 안입니다(" + fmt(first) + " ~ " + fmt(last) + ").");
        } else {
            it.fail("경기일 " + bad + "일이 시즌 기간 밖입니다.");
        }
    }

    // ───── 연전 길이 ─────

    private static void checkSeriesLengths(Input in, List<Item> items) {
        Item it = new Item("series-length", "length", "연전 길이", "첫 연전만 짧을 수 있고(2연전), 나머지는 정한 길이 이상인지");
        it.columns("slot", "연전 기간", "date", "시작", "end", "끝", "length", "연전", "judge", "판정");
        items.add(it);
        Object raw = in.settings.get("seriesMinLength");
        int min = (int) Json.asLong(raw, DEFAULT_SERIES_MIN);
        it.standard("첫 연전 말고는 " + min + "연전 이상", raw == null ? "기본값(3연전)" : "연전 길이 설정");
        int bad = 0;
        for (int i = 0; i < in.slots.size(); i++) {
            Slot s = in.slots.get(i);
            boolean ok = i == 0 || s.length() >= min;
            if (!ok) {
                bad++;
            }
            it.row("slot", (long) i, "date", s.start().toString(), "end", s.end().toString(), "length", (long) s.length(),
                    "judge", i == 0 ? "개막 연전" : ok ? "" : min + "연전보다 짧음");
        }
        if (bad == 0) {
            it.pass("연전 기간 " + in.slots.size() + "개 모두 맞습니다(개막 " + (in.slots.isEmpty() ? "-" : in.slots.get(0).length()) + "연전).");
        } else {
            it.fail("연전 기간 " + bad + "개가 " + min + "연전보다 짧습니다.");
        }
    }

    private static void checkLengthMatch(Input in, List<Item> items) {
        Item it = new Item("length-match", "length", "시리즈와 기간의 길이", "시리즈의 연전 수가 배정된 연전 기간의 연전 수와 같은지");
        it.columns("date", "시작", "away", "원정", "home", "홈", "series", "시리즈 연전", "slot", "기간 연전", "judge", "판정");
        items.add(it);
        it.standard("시리즈 연전 수 = 연전 기간 연전 수", "시리즈 목록과 연전 기간");
        int bad = 0;
        int n = 0;
        for (Series s : in.series) {
            Integer slotId = in.slotOfSeries.get(s.id());
            if (slotId == null) {
                continue;
            }
            n++;
            Slot slot = in.slots.get(slotId);
            if (s.length() != slot.length()) {
                bad++;
                it.row("date", slot.start().toString(), "away", s.away(), "home", s.home(), "series", (long) s.length(), "slot", (long) slot.length(), "judge", "길이가 다름");
            }
        }
        if (bad == 0) {
            it.pass("배정된 시리즈 " + n + "개 모두 기간과 길이가 같습니다.");
        } else {
            it.fail("배정된 시리즈 " + n + "개 중 " + bad + "개가 기간과 길이가 다릅니다.");
        }
    }

    // ───── 후반기 첫 4연전 ─────

    private static void checkFourGameSeries(Input in, List<Item> items) {
        Item it = new Item("four-game", "second", "4연전 대진", "후반기 첫 4연전이 개막 2연전과 같은 두 구단의 맞대결인지, 홈은 정한 대로인지");
        it.columns("date", "4연전 시작", "away", "원정", "home", "홈", "opening", "개막 2연전", "judge", "판정");
        items.add(it);
        Slot opening = in.slots.isEmpty() ? null : in.slots.get(0);
        Slot four = null;
        for (Slot s : in.slots) {
            if (s.length() == 4 && (four == null || s.start().isBefore(four.start()))) {
                four = s;
            }
        }
        if (opening == null || opening.length() != 2 || four == null) {
            it.standard("정한 값 없음", "개막 2연전과 4연전이 있는 묶음에서만 봄");
            it.info(four == null ? "4연전 기간이 없어 판정하지 않습니다." : "개막 연전이 2연전이 아니라 판정하지 않습니다.");
            return;
        }
        String mode = Json.asString(in.settings.get("fourGameHome"), "same");
        boolean same = !"swap".equals(mode);
        it.standard("개막 2연전의 두 구단이 " + (same ? "같은 홈 구장에서" : "홈을 바꿔") + " 4연전", "후반기 4연전 설정(" + (same ? "같은 홈" : "홈 바꿈") + ")" + (in.settings.get("fourGameHome") == null ? " · 기본값" : ""));
        Map<String, Series> openingByPair = new HashMap<>();
        for (Series s : in.seriesIn(opening.id())) {
            openingByPair.put(pairKey(s.home(), s.away()), s);
        }
        int bad = 0;
        Set<String> seen = new LinkedHashSet<>();
        for (Series s : in.seriesIn(four.id())) {
            Series o = openingByPair.get(pairKey(s.home(), s.away()));
            seen.add(pairKey(s.home(), s.away()));
            String judge;
            if (o == null) {
                judge = "개막 2연전에 없는 대진";
                bad++;
            } else if (same ? !o.home().equals(s.home()) : !o.home().equals(s.away())) {
                judge = same ? "홈이 바뀜" : "홈이 같음";
                bad++;
            } else {
                judge = "";
            }
            it.row("date", four.start().toString(), "away", s.away(), "home", s.home(), "opening", o == null ? "없음" : o.away() + "@" + o.home(), "judge", judge);
        }
        for (Map.Entry<String, Series> e : openingByPair.entrySet()) {
            if (!seen.contains(e.getKey())) {
                bad++;
                it.row("date", opening.start().toString(), "away", "", "home", "", "opening", e.getValue().away() + "@" + e.getValue().home(), "judge", "4연전에 없음");
            }
        }
        if (bad == 0) {
            it.pass(fmt(four.start()) + " 4연전 " + seen.size() + "경기 모두 개막 대진이고 홈도 정한 대로입니다.");
        } else {
            it.fail(fmt(four.start()) + " 4연전에서 " + bad + "개가 개막 대진·홈과 다릅니다.");
        }
    }

    // ───── 하루 단위 ─────

    private static void checkDailyTeams(Input in, List<Item> items) {
        Item it = new Item("daily-teams", "daily", "날마다 모든 구단 출전", "경기가 있는 날마다 모든 구단이 꼭 한 번 출전하는지");
        it.columns("date", "날짜", "weekday", "요일", "games", "경기 수", "missing", "출전 없음", "double", "두 번 출전", "judge", "판정");
        items.add(it);
        it.standard("경기일마다 " + in.teams.size() + "구단이 한 번씩(" + in.half + "경기)", "구단 목록");
        int bad = 0;
        for (Map.Entry<LocalDate, List<Game>> e : in.byDate.entrySet()) {
            Map<String, Integer> count = new LinkedHashMap<>();
            for (String t : in.teams) {
                count.put(t, 0);
            }
            for (Game g : e.getValue()) {
                count.merge(g.home(), 1, Integer::sum);
                count.merge(g.away(), 1, Integer::sum);
            }
            List<String> missing = new ArrayList<>();
            List<String> twice = new ArrayList<>();
            for (Map.Entry<String, Integer> c : count.entrySet()) {
                if (c.getValue() == 0) {
                    missing.add(c.getKey());
                } else if (c.getValue() > 1) {
                    twice.add(c.getKey());
                }
            }
            boolean ok = missing.isEmpty() && twice.isEmpty();
            if (!ok) {
                bad++;
                it.row("date", e.getKey().toString(), "weekday", weekdayKo(e.getKey()), "games", (long) e.getValue().size(),
                        "missing", String.join("·", missing), "double", String.join("·", twice), "judge", "출전이 한 번씩이 아님");
            }
        }
        if (bad == 0) {
            it.pass("경기일 " + in.byDate.size() + "일 모두 " + in.teams.size() + "구단이 한 번씩 출전합니다(날짜별 출전표 참고).");
        } else {
            it.fail("경기일 " + in.byDate.size() + "일 중 " + bad + "일은 출전이 한 번씩이 아닙니다.");
        }
    }

    private static void checkDailyStadiums(Input in, List<Item> items) {
        Item it = new Item("daily-stadiums", "daily", "구장마다 한 경기", "같은 날 한 구장에서 경기가 둘 이상 잡히지 않았는지(같이 쓰는 구장은 두 구단을 합쳐서)");
        it.columns("date", "날짜", "weekday", "요일", "stadium", "구장", "games", "경기", "judge", "판정");
        items.add(it);
        Map<String, List<String>> shared = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : in.stadiumOf.entrySet()) {
            shared.computeIfAbsent(e.getValue(), k -> new ArrayList<>()).add(e.getKey());
        }
        List<String> sharedText = new ArrayList<>();
        for (Map.Entry<String, List<String>> e : shared.entrySet()) {
            if (e.getValue().size() > 1) {
                sharedText.add(e.getKey() + "(" + String.join("·", e.getValue()) + ")");
            }
        }
        it.standard("날마다 구장마다 경기 하나" + (sharedText.isEmpty() ? "" : " · 같이 쓰는 구장 " + String.join(", ", sharedText)), "구단별 홈 구장");
        int bad = 0;
        for (Map.Entry<LocalDate, List<Game>> e : in.byDate.entrySet()) {
            Map<String, List<String>> byStadium = new LinkedHashMap<>();
            for (Game g : e.getValue()) {
                byStadium.computeIfAbsent(g.stadium(), k -> new ArrayList<>()).add(g.away() + "@" + g.home());
            }
            for (Map.Entry<String, List<String>> s : byStadium.entrySet()) {
                if (s.getValue().size() > 1) {
                    bad++;
                    it.row("date", e.getKey().toString(), "weekday", weekdayKo(e.getKey()), "stadium", s.getKey(), "games", String.join(" · ", s.getValue()), "judge", "한 구장에 경기 " + s.getValue().size());
                }
            }
        }
        if (bad == 0) {
            it.pass("경기일 " + in.byDate.size() + "일 모두 구장마다 경기가 하나입니다.");
        } else {
            it.fail(bad + "건이 같은 날 같은 구장에 둘 이상 잡혔습니다.");
        }
    }

    // ───── 흐름 ─────

    private static void checkStreaks(Input in, List<Item> items) {
        Item it = new Item("streak", "flow", "홈·원정 연속", "구단마다 홈 또는 원정 연전이 " + (MAX_STREAK + 1) + "번 넘게 이어지지 않는지");
        it.columns("team", "구단", "date", "시작", "run", "연속", "kind", "홈/원정", "judge", "판정");
        items.add(it);
        it.standard("홈 또는 원정 연전 " + (MAX_STREAK + 1) + "연속 없음(최대 " + MAX_STREAK + "연속)", "편성 원칙");
        int bad = 0;
        for (String t : in.teams) {
            List<Visit> vs = in.flow.getOrDefault(t, List.of());
            int run = 0;
            for (int i = 0; i < vs.size(); i++) {
                run = i > 0 && vs.get(i).home() == vs.get(i - 1).home() ? run + 1 : 1;
                if (run == MAX_STREAK + 1) {
                    bad++;
                    it.row("team", t, "date", vs.get(i - MAX_STREAK).start().toString(), "run", (long) run, "kind", vs.get(i).home() ? "홈" : "원정",
                            "judge", (vs.get(i).home() ? "홈" : "원정") + " " + run + "연속");
                }
            }
        }
        if (bad == 0) {
            it.pass("구단 " + in.teams.size() + "곳 모두 " + (MAX_STREAK + 1) + "연속이 없습니다(구단별 흐름 참고).");
        } else {
            it.fail(bad + "건이 " + (MAX_STREAK + 1) + "연속입니다.");
        }
    }

    private static void checkRepeatOpponent(Input in, List<Item> items) {
        Item it = new Item("repeat-opponent", "flow", "같은 상대 연속", "바로 앞 연전과 같은 상대를 잇달아 만나지 않는지");
        it.columns("team", "구단", "date", "앞 연전", "next", "다음 연전", "opponent", "상대", "judge", "판정");
        items.add(it);
        it.standard("잇단 두 연전의 상대가 다름", "편성 원칙");
        int bad = 0;
        Set<String> seenPairs = new LinkedHashSet<>();
        for (String t : in.teams) {
            List<Visit> vs = in.flow.getOrDefault(t, List.of());
            for (int i = 1; i < vs.size(); i++) {
                if (vs.get(i).opponent().equals(vs.get(i - 1).opponent()) && seenPairs.add(pairKey(t, vs.get(i).opponent()) + "|" + vs.get(i).start())) {
                    bad++;
                    it.row("team", t, "date", vs.get(i - 1).start().toString(), "next", vs.get(i).start().toString(), "opponent", vs.get(i).opponent(), "judge", "같은 상대 연속");
                }
            }
        }
        if (bad == 0) {
            it.pass("구단 " + in.teams.size() + "곳 모두 같은 상대를 잇달아 만나지 않습니다.");
        } else {
            it.fail(bad + "건이 같은 상대를 잇달아 만납니다.");
        }
    }

    // ───── 배정 ─────

    private static void checkUnassigned(Input in, List<Item> items) {
        Item it = new Item("unassigned", "assign", "날짜 없는 시리즈", "모든 시리즈가 연전 기간에 배정되었는지");
        it.columns("series", "시리즈", "away", "원정", "home", "홈", "length", "연전", "judge", "판정");
        items.add(it);
        it.standard("시리즈 " + in.series.size() + "개 모두 배정", "시리즈 목록");
        int bad = 0;
        for (Series s : in.series) {
            if (!in.slotOfSeries.containsKey(s.id())) {
                bad++;
                it.row("series", (long) s.id(), "away", s.away(), "home", s.home(), "length", (long) s.length(), "judge", "날짜 없음");
            }
        }
        if (bad == 0) {
            it.pass("시리즈 " + in.series.size() + "개 모두 날짜가 있습니다.");
        } else {
            it.fail("시리즈 " + in.series.size() + "개 중 " + bad + "개에 날짜가 없습니다.");
        }
    }

    // ───────────── 공통 ─────────────

    /** 시험·도구용: 이 문제·배정의 지문({@link Input#signature()}). */
    static String planSignature(JSONObject problem, JSONArray plan) {
        return new Input(problem, plan).signature();
    }

    /** FNV-1a 32비트(UTF-8 바이트) → 8자리 16진수. 화면의 같은 함수와 값이 같아야 한다. */
    static String fnv1a(String text) {
        int h = 0x811c9dc5;
        for (byte b : text.getBytes(java.nio.charset.StandardCharsets.UTF_8)) {
            h ^= (b & 0xff);
            h *= 0x01000193;
        }
        return String.format("%08x", h);
    }

    static LocalDate parseDate(String s) {
        if (s == null || s.length() < 10) {
            return null;
        }
        try {
            return LocalDate.parse(s.substring(0, 10));
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String weekdayKo(LocalDate d) {
        return WEEKDAY_KO[d.getDayOfWeek().getValue() % 7];
    }

    private static String fmt(LocalDate d) {
        return d.getMonthValue() + "/" + d.getDayOfMonth() + "(" + weekdayKo(d) + ")";
    }

    /** 시험·도구용: 항목 id → 판정. */
    static Map<String, String> verdicts(JSONObject verification) {
        Map<String, String> out = new LinkedHashMap<>();
        for (Object g : Json.array(verification.get("groups"))) {
            for (Object i : Json.array(((JSONObject) g).get("items"))) {
                JSONObject item = (JSONObject) i;
                out.put(Json.asString(item.get("id"), ""), Json.asString(item.get("verdict"), ""));
            }
        }
        return out;
    }

    static Collection<String> failedIds(JSONObject verification) {
        List<String> out = new ArrayList<>();
        for (Map.Entry<String, String> e : verdicts(verification).entrySet()) {
            if (FAIL.equals(e.getValue())) {
                out.add(e.getKey());
            }
        }
        return out;
    }
}
