package org.optaplanner.examples.baseball.web;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.Team;
import org.optaplanner.examples.baseball.reschedule.RDay;
import org.optaplanner.examples.baseball.reschedule.RGame;
import org.optaplanner.examples.baseball.reschedule.RescheduleScoreFormulas;
import org.optaplanner.examples.baseball.reschedule.RescheduleScoreFormulas.Totals;
import org.optaplanner.examples.baseball.reschedule.RescheduleSettings;
import org.optaplanner.examples.baseball.reschedule.RescheduleSolution;
import org.optaplanner.examples.baseball.reschedule.RuleCheck;
import org.optaplanner.examples.baseball.reschedule.TeamHistory;
import org.optaplanner.examples.baseball.score.ScoreFormulas;
import org.optaplanner.examples.baseball.score.ScoreFormulas.TeamSummary;
import org.optaplanner.examples.baseball.score.ScoreFormulas.Visit;

/**
 * 날짜 단위 재편성 요청 ↔ {@link RescheduleSolution}. 설계 docs/RESCHEDULE_DAILY_ENGINE_DESIGN.md §1·§5.
 * <p>
 * problem = 고른 1차 편성 버전의 프로젝트 + {@code reschedule { start, end, lastDayToleranceDays, maxConsecutiveDays,
 * maxDoubleHeadersPerTeam, order, targets[], plan[] }}. 배정 대상(targets)은 화면이 만들고 여기서는 검사만 한다.
 * plan은 고정할(발표한) 재편성 일정이다. 그 날짜에 취소 기록({@code games[]}의 {game, date, status: CANCELLED})이 있으면 다시 배정한다.
 */
final class RescheduleCodec {

    static final int MAX_WINDOW_DAYS = 120;

    /** 해와, 기간 앞에서 이미 치른 재편성 경기(결과 plan에 고정으로 함께 돌려준다). */
    record Parsed(RescheduleSolution solution, List<JSONObject> played, LocalDate start, LocalDate end, LocalDate firstRoundLast) {
    }

    /** 고칠 곳 확인에서 바꿔 보는 값. null이면 요청 그대로. */
    record Override(LocalDate end, Integer maxConsecutive, Integer maxDoubleHeaders) {
        static final Override NONE = new Override(null, null, null);
    }

    private RescheduleCodec() {
    }

    static Parsed parse(JSONObject problem) {
        return parse(problem, Override.NONE);
    }

    static Parsed parse(JSONObject problem, Override override) {
        BaseballSolution first = ProblemCodec.toSolution(problem);
        if (!ProblemCodec.applyPlan(first, problem, null)) {
            throw new IllegalArgumentException("1차 편성이 끝난 버전을 골라 주세요. 배정되지 않은 연전이 있습니다.");
        }
        List<Team> teams = first.getTeamList();
        Map<String, Team> teamByName = new HashMap<>();
        for (Team t : teams) {
            teamByName.put(t.getName(), t);
        }
        // 1차 편성의 날짜별 경기(원래 일정)
        List<Match> matches = new ArrayList<>(first.getMatchList());
        matches.sort((a, b) -> Long.compare(a.getId(), b.getId()));
        LocalDate firstRoundLast = null;
        for (Match m : matches) {
            LocalDate s = m.getCalendar().getStartTime().toLocalDate();
            LocalDate last = s.plusDays(m.getConsecutive() - 1L);
            if (firstRoundLast == null || last.isAfter(firstRoundLast)) {
                firstRoundLast = last;
            }
        }
        // 경기 기록: 1차 {match, date, status}, 재편성 {game, date, status}
        Set<String> cancelledFirst = new HashSet<>();
        Set<String> cancelledResched = new HashSet<>();
        JSONArray records = Json.array(problem.get("games"));
        if (records != null) {
            for (Object o : records) {
                JSONObject r = Json.object(o);
                if (r == null || !"CANCELLED".equals(Json.asString(r.get("status"), ""))) {
                    continue;
                }
                String date = Json.asString(r.get("date"), "");
                if (r.get("game") != null) {
                    cancelledResched.add(Json.asString(r.get("game"), "") + "|" + date);
                } else if (r.get("match") != null) {
                    cancelledFirst.add(Json.asLong(r.get("match"), -1) + "|" + date);
                }
            }
        }
        JSONObject rs = Json.object(problem.get("reschedule"));
        if (rs == null) {
            throw new IllegalArgumentException("재편성 기간과 배정할 경기가 없습니다.");
        }
        LocalDate start = rs.get("start") == null ? firstRoundLast.plusDays(1) : date(rs.get("start"), "기간 시작일");
        LocalDate end = override.end() != null ? override.end() : date(rs.get("end"), "마감일");
        if (!start.isAfter(firstRoundLast)) {
            throw new IllegalArgumentException("재편성 기간은 1차 편성이 끝난 다음 날(" + RuleCheck.label(firstRoundLast.plusDays(1))
                    + ")부터 잡을 수 있습니다.");
        }
        if (end.isBefore(start)) {
            throw new IllegalArgumentException("마감일이 시작일보다 앞입니다.");
        }
        long windowDays = end.toEpochDay() - start.toEpochDay() + 1;
        if (windowDays > MAX_WINDOW_DAYS) {
            throw new IllegalArgumentException("재편성 기간은 " + MAX_WINDOW_DAYS + "일까지 잡을 수 있습니다.");
        }
        RescheduleSettings settings = settings(problem, rs, override);
        List<RDay> days = new ArrayList<>();
        for (int i = 0; i < windowDays; i++) {
            days.add(new RDay(i, start.plusDays(i)));
        }

        // 배정 대상 검사
        JSONArray targets = Json.array(rs.get("targets"));
        if (targets == null) {
            throw new IllegalArgumentException("배정할 경기 목록이 없습니다.");
        }
        Map<String, JSONObject> planByGame = new HashMap<>();
        JSONArray plan = Json.array(rs.get("plan"));
        if (plan != null) {
            for (Object o : plan) {
                JSONObject p = Json.object(o);
                if (p != null && p.get("game") != null && p.get("date") != null) {
                    planByGame.put(Json.asString(p.get("game"), ""), p);
                }
            }
        }
        JSONObject settingsJson = Json.object(problem.get("settings"));
        long gamesPerPair = settingsJson == null ? 16 : Json.asLong(settingsJson.get("gamesPerPair"), 16);
        int n = teams.size();
        int[][] pairGames = new int[n][n];
        int[] homeGames = new int[n];
        Map<String, Match> matchByCancelledKey = new HashMap<>();
        for (Match m : matches) {
            int h = m.getHome().getIndex();
            int a = m.getAway().getIndex();
            pairGames[Math.min(h, a)][Math.max(h, a)] += m.getConsecutive();
            homeGames[h] += m.getConsecutive();
            LocalDate s = m.getCalendar().getStartTime().toLocalDate();
            for (int i = 0; i < m.getConsecutive(); i++) {
                String key = m.getId() + "|" + s.plusDays(i);
                if (cancelledFirst.contains(key)) {
                    matchByCancelledKey.put(key, m);
                }
            }
        }
        Set<String> seenIds = new HashSet<>();
        Set<String> coveredCancelled = new HashSet<>();
        List<RGame> games = new ArrayList<>();
        List<JSONObject> played = new ArrayList<>();
        // 기간 앞에서 이미 치른 재편성 경기: 날짜 → 경기들(구단 경로를 날짜순으로 잇기 위해)
        TreeMap<LocalDate, List<Team[]>> playedByDate = new TreeMap<>();
        for (Object o : targets) {
            JSONObject t = Json.object(o);
            if (t == null) {
                throw new IllegalArgumentException("배정할 경기 목록의 항목이 올바르지 않습니다.");
            }
            String id = Json.asString(t.get("id"), "");
            Team home = teamByName.get(Json.asString(t.get("home"), ""));
            Team away = teamByName.get(Json.asString(t.get("away"), ""));
            String source = Json.asString(t.get("source"), "");
            if (id.isEmpty() || !seenIds.add(id)) {
                throw new IllegalArgumentException("배정할 경기의 이름이 비어 있거나 겹칩니다: " + id);
            }
            if (home == null || away == null || home == away) {
                throw new IllegalArgumentException("배정할 경기의 구단이 올바르지 않습니다: " + id);
            }
            if (RGame.CANCELLED.equals(source)) {
                String key = Json.asLong(t.get("match"), -1) + "|" + Json.asString(t.get("date"), "");
                Match m = matchByCancelledKey.get(key);
                if (m == null || !("M:" + key).equals(id)) {
                    throw new IllegalArgumentException("취소 표시가 없는 경기가 배정 대상에 들어 있습니다: " + home.getName() + "–"
                            + away.getName() + " " + shortDate(Json.asString(t.get("date"), "")));
                }
                if (m.getHome() != home || m.getAway() != away) {
                    throw new IllegalArgumentException("취소 경기의 홈·원정이 1차 편성과 다릅니다: " + id);
                }
                coveredCancelled.add(key);
            } else if (RGame.REMAINING.equals(source)) {
                int h = home.getIndex();
                int a = away.getIndex();
                pairGames[Math.min(h, a)][Math.max(h, a)]++;
                homeGames[h]++;
            } else {
                throw new IllegalArgumentException("배정할 경기의 종류가 올바르지 않습니다: " + id);
            }
            RGame game = new RGame(games.size(), id, home, away, source);
            JSONObject entry = planByGame.get(id);
            if (entry != null) {
                LocalDate d = date(entry.get("date"), "발표한 일정의 날짜");
                boolean cancelled = cancelledResched.contains(id + "|" + d);
                if (!cancelled && d.isBefore(start)) {
                    if (!d.isAfter(firstRoundLast)) {
                        throw new IllegalArgumentException("발표한 일정의 날짜가 1차 편성 기간 안에 있습니다: " + id);
                    }
                    played.add(Json.obj("game", id, "date", d.toString()));
                    playedByDate.computeIfAbsent(d, k -> new ArrayList<>()).add(new Team[] {home, away});
                    continue;
                }
                if (!cancelled) {
                    if (d.isAfter(end)) {
                        throw new IllegalArgumentException("발표한 일정이 마감일(" + RuleCheck.label(end) + ") 뒤에 있습니다: "
                                + home.getName() + "–" + away.getName() + " " + RuleCheck.label(d) + ". 마감일을 늦춰 주세요.");
                    }
                    game.setDay(days.get((int) (d.toEpochDay() - start.toEpochDay())));
                    game.setPinned(true);
                }
            }
            games.add(game);
        }
        for (String key : matchByCancelledKey.keySet()) {
            if (!coveredCancelled.contains(key)) {
                Match m = matchByCancelledKey.get(key);
                throw new IllegalArgumentException("취소한 경기가 배정 대상에 빠져 있습니다: " + m.getHome().getName() + "–"
                        + m.getAway().getName() + " " + shortDate(key.substring(key.indexOf('|') + 1)));
            }
        }
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                if (pairGames[i][j] != gamesPerPair) {
                    throw new IllegalArgumentException(teams.get(i).getName() + "–" + teams.get(j).getName() + "의 경기 수가 "
                            + gamesPerPair + "경기가 되지 않습니다(지금 " + pairGames[i][j] + "경기).");
                }
            }
        }
        checkHomeTotals(settingsJson, teams, homeGames);

        List<TeamHistory> histories = histories(first, matches, cancelledFirst, playedByDate, start);
        RescheduleSolution solution = new RescheduleSolution(teams, days, games, histories, settings);
        // 발표한 일정이 이미 규칙을 어기면 실행하지 않는다
        List<RuleCheck.Violation> broken = RuleCheck.violations(solution);
        if (!broken.isEmpty()) {
            throw new IllegalArgumentException("발표한 일정이 꼭 지키는 규칙을 어깁니다. " + broken.get(0).text()
                    + " 설정을 바꾸거나 발표 일정을 확인해 주세요.");
        }
        return new Parsed(solution, played, start, end, firstRoundLast);
    }

    private static RescheduleSettings settings(JSONObject problem, JSONObject rs, Override override) {
        JSONObject settingsJson = Json.object(problem.get("settings"));
        JSONObject objective = settingsJson == null ? null : Json.object(settingsJson.get("objective"));
        double moveGap = objective == null ? ProblemCodec.DEFAULT_MOVE_GAP
                : Json.asDouble(objective.get("moveGap"), ProblemCodec.DEFAULT_MOVE_GAP);
        double distanceGapKm = objective == null ? ProblemCodec.DEFAULT_DISTANCE_GAP_KM
                : Json.asDouble(objective.get("distanceGapKm"), ProblemCodec.DEFAULT_DISTANCE_GAP_KM);
        boolean movesFirst = true;
        JSONArray firstOrder = objective == null ? null : Json.array(objective.get("order"));
        if (firstOrder != null && firstOrder.contains("moves") && firstOrder.contains("distance")) {
            movesFirst = firstOrder.indexOf("moves") < firstOrder.indexOf("distance");
        }
        List<String> order = new ArrayList<>(RescheduleSettings.CRITERIA);
        JSONArray orderJson = Json.array(rs.get("order"));
        if (orderJson != null) {
            order = new ArrayList<>();
            for (Object o : orderJson) {
                order.add(String.valueOf(o));
            }
        }
        int tolerance = (int) Json.asLong(rs.get("lastDayToleranceDays"), RescheduleSettings.DEFAULT_LAST_DAY_TOLERANCE);
        int run = override.maxConsecutive() != null ? override.maxConsecutive()
                : (int) Json.asLong(rs.get("maxConsecutiveDays"), RescheduleSettings.DEFAULT_MAX_CONSECUTIVE);
        int dh = override.maxDoubleHeaders() != null ? override.maxDoubleHeaders()
                : (int) Json.asLong(rs.get("maxDoubleHeadersPerTeam"), RescheduleSettings.DEFAULT_MAX_DOUBLE_HEADERS);
        return RescheduleSettings.of(order, movesFirst, tolerance, run, dh, moveGap, Math.round(distanceGapKm * 10.0));
    }

    /** settings.homeTotals { moreTeams, more: { total }, less: { total } }가 있으면 구단마다 1차 홈 + 잔여 홈 = 목표여야 한다(정할 것 2). */
    private static void checkHomeTotals(JSONObject settingsJson, List<Team> teams, int[] homeGames) {
        JSONObject ht = settingsJson == null ? null : Json.object(settingsJson.get("homeTotals"));
        if (ht == null) {
            return;
        }
        JSONArray moreTeams = Json.array(ht.get("moreTeams"));
        JSONObject more = Json.object(ht.get("more"));
        JSONObject less = Json.object(ht.get("less"));
        if (more == null || less == null || more.get("total") == null || less.get("total") == null) {
            return;
        }
        List<String> off = new ArrayList<>();
        for (Team t : teams) {
            boolean isMore = moreTeams != null && moreTeams.contains(t.getName());
            long target = Json.asLong((isMore ? more : less).get("total"), -1);
            if (target >= 0 && homeGames[t.getIndex()] != target) {
                off.add(t.getName() + " 목표 " + target + " · 지금 " + homeGames[t.getIndex()]);
            }
        }
        if (!off.isEmpty()) {
            throw new IllegalArgumentException("잔여 경기의 홈을 목표대로 나눌 수 없습니다. " + String.join(", ", off)
                    + ". 1차 편성 홈 경기 수를 확인해 주세요.");
        }
    }

    /**
     * 기간 앞을 구단마다 접는다. 이동은 1차 원래 일정(취소 포함, 올스타 휴식기 0km)을 ScoreFormulas로 세고, 이미 치른 재편성 경기는
     * 재편성 규칙(쉬어도 거리를 셈)으로 잇는다. 연속 경기일·마지막 경기일은 실제로 치른 경기만 센다.
     */
    private static List<TeamHistory> histories(BaseballSolution first, List<Match> matches, Set<String> cancelledFirst,
            TreeMap<LocalDate, List<Team[]>> playedByDate, LocalDate start) {
        List<TeamHistory> out = new ArrayList<>();
        for (Team team : first.getTeamList()) {
            TeamSummary summary = ScoreFormulas.summarizeTeam(team, first.getMatchList());
            List<Visit> visits = ScoreFormulas.visitsFor(team, first.getMatchList());
            int location = visits.isEmpty() ? -1 : visits.get(visits.size() - 1).locationTeamIndex();
            Set<Long> playedDays = new HashSet<>();
            for (Match m : matches) {
                if (m.getHome() != team && m.getAway() != team) {
                    continue;
                }
                LocalDate s = m.getCalendar().getStartTime().toLocalDate();
                for (int i = 0; i < m.getConsecutive(); i++) {
                    LocalDate d = s.plusDays(i);
                    if (!cancelledFirst.contains(m.getId() + "|" + d)) {
                        playedDays.add(d.toEpochDay());
                    }
                }
            }
            long moves = summary.moveCount();
            long distance = summary.distanceTenths();
            int dh = 0;
            for (Map.Entry<LocalDate, List<Team[]>> e : playedByDate.entrySet()) {
                int count = 0;
                Team at = null;
                for (Team[] pair : e.getValue()) {
                    if (pair[0] == team || pair[1] == team) {
                        count++;
                        if (at == null) {
                            at = pair[0];
                        }
                    }
                }
                if (count == 0) {
                    continue;
                }
                dh += count - 1;
                playedDays.add(e.getKey().toEpochDay());
                if (location >= 0) {
                    Team prev = first.getTeamList().get(location);
                    distance += prev.getDistanceTenthsTo(at.getIndex());
                    if (prev.getStadiumIndex() != at.getStadiumIndex()) {
                        moves++;
                    }
                }
                location = at.getIndex();
            }
            int run = 0;
            for (long d = start.toEpochDay() - 1; playedDays.contains(d); d--) {
                run++;
            }
            long last = playedDays.stream().mapToLong(Long::longValue).max().orElse(TeamHistory.NO_DAY);
            out.add(new TeamHistory(team.getIndex(), moves, distance, location, run, last, dh));
        }
        return out;
    }

    /** 2025-08-27 → 8/27(읽을 수 없으면 그대로). */
    static String shortDate(String iso) {
        try {
            return RuleCheck.label(LocalDate.parse(iso));
        } catch (DateTimeParseException e) {
            return iso;
        }
    }

    private static LocalDate date(Object v, String what) {
        String s = Json.asString(v, "");
        try {
            return LocalDate.parse(s.length() >= 10 ? s.substring(0, 10) : s);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(org.optaplanner.examples.baseball.reschedule.Korean.subject(what) + " 올바른 날짜가 아닙니다: " + s);
        }
    }

    /** 화면에서 고친 일정 [{game, date}]을 고정되지 않은 경기에 적용한다(/score). 날짜가 없거나 기간 밖이면 비운다. */
    static void applyPlan(Parsed parsed, JSONArray plan) {
        Map<String, RDay> dayByDate = new HashMap<>();
        for (RDay d : parsed.solution().getDayList()) {
            dayByDate.put(d.getDate().toString(), d);
        }
        Map<String, String> dateByGame = new HashMap<>();
        if (plan != null) {
            for (Object o : plan) {
                JSONObject p = Json.object(o);
                if (p != null && p.get("game") != null) {
                    dateByGame.put(Json.asString(p.get("game"), ""), p.get("date") == null ? null : Json.asString(p.get("date"), null));
                }
            }
        }
        for (RGame g : parsed.solution().getGameList()) {
            if (!g.isPinned()) {
                String d = dateByGame.get(g.getKey());
                g.setDay(d == null ? null : dayByDate.get(d));
            }
        }
    }

    /** 결과 plan: 대상 순서. 이미 치른 재편성 경기는 고정으로 끝에 붙인다. */
    static JSONArray planJson(Parsed parsed) {
        RescheduleSolution s = parsed.solution();
        List<JSONObject> out = new ArrayList<>();
        Map<String, Integer> perMatchupDay = new HashMap<>();
        for (RGame g : s.getGameList()) {
            if (g.getDay() != null) {
                perMatchupDay.merge(g.getHome().getName() + "-" + g.getAway().getName() + "|" + g.getDay().getIndex(), 1, Integer::sum);
            }
        }
        for (RGame g : s.getGameList()) {
            RDay d = g.getDay();
            boolean dh = d != null && perMatchupDay.getOrDefault(g.getHome().getName() + "-" + g.getAway().getName() + "|" + d.getIndex(), 0) > 1;
            out.add(Json.obj("game", g.getKey(), "date", d == null ? null : d.getDate().toString(), "doubleHeader", dh,
                    "fixed", g.isPinned()));
        }
        for (JSONObject p : parsed.played()) {
            JSONObject e = (JSONObject) p.clone();
            e.put("doubleHeader", Boolean.FALSE);
            e.put("fixed", Boolean.TRUE);
            e.put("played", Boolean.TRUE);
            out.add(e);
        }
        return Json.arr(out);
    }

    /** 평가 숫자(요구 §10의 3). km는 0.1km 단위를 소수 한 자리로. */
    static JSONObject metrics(Parsed parsed) {
        RescheduleSolution s = parsed.solution();
        Totals t = RescheduleScoreFormulas.totals(s);
        RescheduleSettings st = s.getSettings();
        List<Team> teams = s.getTeamList();
        List<JSONObject> lastDays = new ArrayList<>();
        List<JSONObject> fairness = new ArrayList<>();
        List<JSONObject> added = new ArrayList<>();
        List<JSONObject> dh = new ArrayList<>();
        long[] baseMoves = new long[teams.size()];
        long[] baseDistance = new long[teams.size()];
        for (Team team : teams) {
            int i = team.getIndex();
            TeamHistory h = s.getHistoryList().get(i);
            baseMoves[i] = h.baseMoves();
            baseDistance[i] = h.baseDistanceTenths();
            lastDays.add(Json.obj("team", team.getName(), "date",
                    t.lastDay[i] == TeamHistory.NO_DAY ? null : LocalDate.ofEpochDay(t.lastDay[i]).toString()));
            fairness.add(Json.obj("team", team.getName(), "moves", t.moves[i], "distanceKm", km(t.distanceTenths[i]),
                    "firstRoundMoves", h.baseMoves(), "firstRoundDistanceKm", km(h.baseDistanceTenths())));
            added.add(Json.obj("team", team.getName(), "km", km(t.addedTenths[i]), "moves", t.addedMoves[i]));
            dh.add(Json.obj("team", team.getName(), "count", (long) t.doubleHeaders[i]));
        }
        long spread = RescheduleScoreFormulas.lastDaySpread(t.lastDay);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("lastDay", Json.obj("byTeam", Json.arr(lastDays), "spreadDays", spread, "toleranceDays",
                (long) st.getLastDayToleranceDays(), "within", spread <= st.getLastDayToleranceDays()));
        m.put("fairness", Json.obj("byTeam", Json.arr(fairness), "movesSpread", spread(t.moves), "moveGap", st.getMoveGap(),
                "distanceSpreadKm", km(spread(t.distanceTenths)), "distanceGapKm", km(st.getDistanceGapTenths()),
                "firstRoundMovesSpread", spread(baseMoves), "firstRoundDistanceSpreadKm", km(spread(baseDistance))));
        m.put("addedDistance", Json.obj("totalKm", km(t.addedTenthsTotal), "byTeam", Json.arr(added)));
        m.put("mondayGames", t.mondayGames);
        m.put("doubleHeaders", Json.obj("total", t.doubleHeaderTotal, "byTeam", Json.arr(dh)));
        m.put("unplaced", t.unplaced);
        JSONObject out = new JSONObject();
        out.putAll(m);
        return out;
    }

    static double km(long tenths) {
        return tenths / 10.0;
    }

    private static long spread(long[] values) {
        long min = Long.MAX_VALUE;
        long max = Long.MIN_VALUE;
        for (long v : values) {
            min = Math.min(min, v);
            max = Math.max(max, v);
        }
        return values.length == 0 ? 0L : max - min;
    }
}
