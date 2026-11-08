package org.optaplanner.examples.baseball.web;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

/** 재편성 테스트 입력: 2025 실제 1차 일정(project_2025.json) + 무작위 취소 + 잔여 45경기. */
final class RescheduleFixtures {

    private RescheduleFixtures() {
    }

    static JSONObject project2025() {
        try {
            return Json.object(Json.parse(Files.readString(Path.of("data/baseball/project_2025.json"), StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** 1차 편성 날짜별 경기: [match, date, home, away] */
    static List<Object[]> firstRoundGames(JSONObject project) {
        JSONArray matches = Json.array(project.get("matches"));
        JSONArray calendar = Json.array(project.get("calendar"));
        Map<Long, Long> slotByMatch = new HashMap<>();
        for (Object o : Json.array(project.get("plan"))) {
            JSONObject p = (JSONObject) o;
            slotByMatch.put(Json.asLong(p.get("match"), -1), Json.asLong(p.get("calendar"), -1));
        }
        List<Object[]> out = new ArrayList<>();
        for (int i = 0; i < matches.size(); i++) {
            JSONObject m = (JSONObject) matches.get(i);
            JSONObject c = (JSONObject) calendar.get(slotByMatch.get((long) i).intValue());
            LocalDate s = LocalDate.parse(Json.asString(c.get("datetime"), "").substring(0, 10));
            for (int k = 0; k < Json.asLong(m.get("consecutive"), 3); k++) {
                out.add(new Object[] {(long) i, s.plusDays(k).toString(), Json.asString(m.get("home"), ""), Json.asString(m.get("away"), "")});
            }
        }
        return out;
    }

    /**
     * @param cancel 1차 편성에서 무작위로 취소할 경기 수(뒤쪽 6주 중에서 고른다)
     */
    @SuppressWarnings("unchecked")
    static JSONObject problem(long seed, int cancel, String start, String end) {
        JSONObject p = project2025();
        Random random = new Random(seed);
        List<Object[]> games = firstRoundGames(p);
        List<Object[]> late = new ArrayList<>();
        for (Object[] g : games) {
            if (((String) g[1]).compareTo("2025-07-20") >= 0) {
                late.add(g);
            }
        }
        JSONArray records = new JSONArray();
        JSONArray targets = new JSONArray();
        for (int i = 0; i < cancel && !late.isEmpty(); i++) {
            Object[] g = late.remove(random.nextInt(late.size()));
            records.add(Json.obj("match", g[0], "date", g[1], "status", "CANCELLED", "reason", "RAIN"));
            targets.add(Json.obj("id", "M:" + g[0] + "|" + g[1], "home", g[2], "away", g[3], "source", "CANCELLED",
                    "match", g[0], "date", g[1], "reason", "RAIN"));
        }
        // 잔여 경기: 구단쌍마다 1경기, 그 쌍에서 1차 홈이 적은 쪽이 홈(같으면 목록 앞 구단)
        List<String> names = new ArrayList<>();
        for (Object o : Json.array(p.get("teams"))) {
            names.add(Json.asString(((JSONObject) o).get("name"), ""));
        }
        Map<String, Integer> home = new HashMap<>();
        for (Object[] g : games) {
            home.merge(g[2] + ">" + g[3], 1, Integer::sum);
        }
        for (int i = 0; i < names.size(); i++) {
            for (int j = i + 1; j < names.size(); j++) {
                String a = names.get(i);
                String b = names.get(j);
                boolean aHome = home.getOrDefault(a + ">" + b, 0) <= home.getOrDefault(b + ">" + a, 0);
                String h = aHome ? a : b;
                String w = aHome ? b : a;
                targets.add(Json.obj("id", "R:" + h + "-" + w, "home", h, "away", w, "source", "REMAINING"));
            }
        }
        p.put("games", records);
        p.put("reschedule", Json.obj("start", start, "end", end, "targets", targets, "plan", new JSONArray()));
        return p;
    }
}
