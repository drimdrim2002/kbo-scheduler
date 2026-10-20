package org.optaplanner.examples.baseball.web;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.Team;
import org.optaplanner.examples.baseball.score.ScoreFormulas;

/**
 * 보여주는 문이 쓰는 구단 지표. 브라우저 채점기(ui/core/score.js teamMetrics)와 같은 정의다:
 * 이동거리·이동 횟수·휴일 가중치는 엔진 합계, 주말 홈은 주말 슬롯의 홈 시리즈 수, 최장 원정은 구단 시리즈 순서상 연속 원정 수.
 */
final class Metrics {

    private Metrics() {
    }

    @SuppressWarnings("unchecked")
    static JSONObject of(BaseballSolution solution) {
        List<Team> teams = solution.getTeamList();
        List<Match> matches = solution.getMatchList();
        ScoreFormulas.TeamTotals totals = ScoreFormulas.computeTeamTotals(teams, matches);
        int n = teams.size();
        int[] weekendHome = new int[n];
        int[] homeGames = new int[n];
        int[] awayGames = new int[n];
        int[] maxHomeRun = new int[n];
        int[] maxAwayRun = new int[n];
        List<List<Match>> byTeam = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            byTeam.add(new ArrayList<>());
        }
        for (Match m : matches) {
            if (!ScoreFormulas.isRegular(m)) {
                continue;
            }
            byTeam.get(m.getHome().getIndex()).add(m);
            if (m.getAway().getIndex() != m.getHome().getIndex()) {
                byTeam.get(m.getAway().getIndex()).add(m);
            }
        }
        for (Team t : teams) {
            int i = t.getIndex();
            List<Match> list = byTeam.get(i);
            list.sort(Comparator.comparingInt((Match m) -> m.getCalendar().getSlotIndex()).thenComparingLong(Match::getId));
            int run = 0;
            Boolean side = null;
            for (Match m : list) {
                Calendar c = m.getCalendar();
                boolean home = m.getHome().getIndex() == i;
                if (side != null && side == home) {
                    run++;
                } else {
                    run = 1;
                    side = home;
                }
                if (home) {
                    homeGames[i] += m.getConsecutive();
                    maxHomeRun[i] = Math.max(maxHomeRun[i], run);
                    if (c.getWeekend() == 1) {
                        weekendHome[i]++;
                    }
                } else {
                    awayGames[i] += m.getConsecutive();
                    maxAwayRun[i] = Math.max(maxAwayRun[i], run);
                }
            }
        }
        JSONArray rows = new JSONArray();
        double minKm = Double.MAX_VALUE, maxKm = -1;
        String minTeam = "", maxTeam = "";
        long sumTenths = 0;
        int whMin = Integer.MAX_VALUE, whMax = -1;
        List<Team> ordered = new ArrayList<>(teams);
        ordered.sort(Comparator.comparingInt(Team::getIndex));
        for (Team t : ordered) {
            int i = t.getIndex();
            double km = totals.distanceTenths[i] / 10.0;
            sumTenths += totals.distanceTenths[i];
            if (km < minKm) {
                minKm = km;
                minTeam = t.getName();
            }
            if (km > maxKm) {
                maxKm = km;
                maxTeam = t.getName();
            }
            whMin = Math.min(whMin, weekendHome[i]);
            whMax = Math.max(whMax, weekendHome[i]);
            rows.add(Json.obj("name", t.getName(), "distanceKm", km, "moves", totals.moveCount[i],
                    "holidayWeight", totals.holidayWeight[i], "weekendHome", (long) weekendHome[i],
                    "maxAwayRun", (long) maxAwayRun[i], "maxHomeRun", (long) maxHomeRun[i],
                    "homeGames", (long) homeGames[i], "awayGames", (long) awayGames[i]));
        }
        long totalKm = sumTenths / 10L;
        return Json.obj("totalKm", totalKm, "meanDistanceKm", n == 0 ? 0.0 : Math.round(sumTenths / (double) n) / 10.0,
                "spreadKm", Math.round((maxKm - minKm) * 10) / 10.0, "maxTeam", maxTeam, "minTeam", minTeam,
                "weekendHomeMin", (long) whMin, "weekendHomeMax", (long) whMax, "teams", rows);
    }
}
