package org.optaplanner.examples.baseball.reschedule;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.optaplanner.examples.baseball.domain.Team;

/**
 * 따로 쓴 단순 채점기. RescheduleScoreFormulas와 계산식을 나누지 않고, 요구 문서 §4~§6 문장을 그대로 옮긴다.
 * 배열·캐시 없이 구단마다 날짜순 지도(TreeMap)로 센다. 두 결과가 같아야 한다(RescheduleParityTest).
 * <p>규칙을 어긴 일정의 셈도 정해 둔다: 구단 하루 n경기(2경기 같은 대진이 아니면) n−1, 구장 하루 대진 k개면 k−1,
 * 연속 경기일 상한을 넘은 날마다 1, 더블헤더 수(하루 n경기면 n−1) 합이 상한을 넘은 만큼.
 */
public final class RescheduleReferenceScorer {

    /** [ruleViolations, unplaced, levelPenalty[0..5]] */
    public static long[] score(RescheduleSolution s) {
        RescheduleSettings st = s.getSettings();
        List<Team> teams = s.getTeamList();
        long unplaced = 0;
        long monday = 0;
        // 구단 → 날짜(일 번호) → 그날 경기(id 순)
        List<TreeMap<Integer, List<RGame>>> byTeam = new ArrayList<>();
        for (int i = 0; i < teams.size(); i++) {
            byTeam.add(new TreeMap<>());
        }
        Map<Integer, Map<Integer, Set<String>>> stadiumMatchups = new HashMap<>();
        Map<String, Integer> matchupDay = new HashMap<>();
        List<RGame> games = new ArrayList<>(s.getGameList());
        games.sort((a, b) -> Long.compare(a.getId(), b.getId()));
        for (RGame g : games) {
            if (g.getDay() == null) {
                unplaced++;
                continue;
            }
            int d = g.getDay().getIndex();
            if (g.getDay().getDate().getDayOfWeek() == java.time.DayOfWeek.MONDAY) {
                monday++;
            }
            byTeam.get(g.getHome().getIndex()).computeIfAbsent(d, k -> new ArrayList<>()).add(g);
            byTeam.get(g.getAway().getIndex()).computeIfAbsent(d, k -> new ArrayList<>()).add(g);
            String matchup = g.getHome().getName() + ">" + g.getAway().getName();
            stadiumMatchups.computeIfAbsent(d, k -> new HashMap<>())
                    .computeIfAbsent(g.getHome().getStadiumIndex(), k -> new HashSet<>()).add(matchup);
            matchupDay.merge(matchup + "@" + d, 1, Integer::sum);
        }
        long violations = 0;
        for (Map<Integer, Set<String>> perStadium : stadiumMatchups.values()) {
            for (Set<String> set : perStadium.values()) {
                violations += set.size() - 1;
            }
        }
        long dhTotal = 0;
        for (int n : matchupDay.values()) {
            dhTotal += Math.max(0, n - 1);
        }
        long[] moves = new long[teams.size()];
        long[] dist = new long[teams.size()];
        long[] last = new long[teams.size()];
        long added = 0;
        for (int t = 0; t < teams.size(); t++) {
            TeamHistory h = s.getHistoryList().get(t);
            TreeMap<Integer, List<RGame>> days = byTeam.get(t);
            int dh = h.doubleHeadersUsed();
            for (List<RGame> list : days.values()) {
                if (list.size() >= 2) {
                    dh += list.size() - 1;
                    boolean doubleHeader = list.size() == 2 && list.get(0).getHome() == list.get(1).getHome()
                            && list.get(0).getAway() == list.get(1).getAway();
                    if (!doubleHeader) {
                        violations += list.size() - 1;
                    }
                }
            }
            if (dh > st.getMaxDoubleHeaders()) {
                violations += dh - st.getMaxDoubleHeaders();
            }
            // 연속 경기일: 기간 첫날 앞의 실제 경기일부터 이어 센다
            int run = h.runAtStart();
            int prevDay = -1;
            for (int d : days.keySet()) {
                run = (d == prevDay + 1) ? run + 1 : 1;
                if (prevDay == -1 && d != 0) {
                    run = 1;
                }
                if (run > st.getMaxConsecutiveDays()) {
                    violations++;
                }
                prevDay = d;
            }
            // 이동: 출발 구장에서 경기한 날마다 그날 구장(그날 첫 경기의 홈)으로
            Team at = h.startLocation() < 0 ? null : teams.get(h.startLocation());
            long km = 0;
            long mv = 0;
            for (List<RGame> list : days.values()) {
                Team where = list.get(0).getHome();
                if (at != null) {
                    km += at.getDistanceTenthsTo(where.getIndex());
                    if (!at.getStadium().equals(where.getStadium())) {
                        mv++;
                    }
                }
                at = where;
            }
            added += km;
            moves[t] = h.baseMoves() + mv;
            dist[t] = h.baseDistanceTenths() + km;
            last[t] = days.isEmpty() ? h.lastPlayedEpochDay() : s.getDayList().get(days.lastKey()).getDate().toEpochDay();
        }
        long lastPenalty = 0;
        for (int i = 0; i < last.length; i++) {
            for (int j = i + 1; j < last.length; j++) {
                if (last[i] == TeamHistory.NO_DAY || last[j] == TeamHistory.NO_DAY) {
                    continue;
                }
                long over = Math.abs(last[i] - last[j]) - st.getLastDayToleranceDays();
                lastPenalty += over > 0 ? over * over : 0;
            }
        }
        double moveSum = 0;
        long distSum = 0;
        for (int i = 0; i < moves.length; i++) {
            for (int j = i + 1; j < moves.length; j++) {
                double mo = Math.abs(moves[i] - moves[j]) - st.getMoveGap();
                if (mo > 0) {
                    moveSum += mo * mo;
                }
                long dOver = Math.abs(dist[i] - dist[j]) - st.getDistanceGapTenths();
                if (dOver > 0) {
                    distSum += dOver * dOver;
                }
            }
        }
        return new long[] {violations, unplaced, lastPenalty, Math.round(moveSum * 100.0), distSum, added, monday, dhTotal};
    }

    private RescheduleReferenceScorer() {
    }
}
