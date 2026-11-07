package org.optaplanner.examples.baseball.reschedule;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.optaplanner.examples.baseball.domain.Team;

/**
 * 못 넣은 경기와 그 이유(설계 §2.5). <b>최종 결과</b>에 부른다. 날마다 {@link DayGrid#check}로 첫 번째로 걸린 이유를 모으고,
 * 구단마다 이 기간에 할 수 있는 최대 경기 수를 센다. 문장은 브라우저 reschedule.js와 글자까지 같아야 한다(golden).
 * 「고칠 곳」(값을 바꿔 다시 넣어 보기)은 서버만 하며 여기에는 없다.
 */
public final class RescheduleDiagnosis {

    /** 이유 하나: 같은 이유·같은 구단으로 막힌 날 수. */
    public record Reason(String code, String team, int days, String text) {
    }

    public record Unplaced(String game, String home, String away, List<Reason> reasons, String text) {
    }

    /** 이 기간에 할 수 있는 최대 경기 수보다 넣어야 할 경기가 많은 구단. */
    public record TeamLimit(String team, int capacity, int need, String text) {
    }

    public record Result(List<Unplaced> unplaced, List<TeamLimit> teamLimits) {
    }

    private static final List<String> CODE_ORDER =
            List.of("RUN_LIMIT", "TEAM_BUSY", "STADIUM_BUSY", "DH_LIMIT", "PINNED_DAY", "SEARCH");

    private RescheduleDiagnosis() {
    }

    public static Result explain(RescheduleSolution solution) {
        DayGrid grid = DayGrid.of(solution);
        List<Team> teams = solution.getTeamList();
        RescheduleSettings st = solution.getSettings();
        List<TeamLimit> limits = teamLimits(solution, grid);
        List<Unplaced> out = new ArrayList<>();
        List<RGame> games = new ArrayList<>(solution.getGameList());
        games.sort(Comparator.comparing(RGame::getId));
        for (RGame g : games) {
            if (g.getDay() != null) {
                continue;
            }
            Map<String, int[]> counts = new LinkedHashMap<>();
            Map<String, String> teamOf = new LinkedHashMap<>();
            for (int d = 0; d < grid.getDayCount(); d++) {
                int r = grid.check(g, d);
                String code = switch (r) {
                    case DayGrid.OK, DayGrid.OK_DOUBLE_HEADER -> "SEARCH";
                    case DayGrid.TEAM_BUSY -> "TEAM_BUSY";
                    case DayGrid.STADIUM_BUSY -> "STADIUM_BUSY";
                    case DayGrid.RUN_LIMIT -> "RUN_LIMIT";
                    case DayGrid.DH_LIMIT -> "DH_LIMIT";
                    default -> "PINNED_DAY";
                };
                String team = "SEARCH".equals(code) || grid.blockedTeam < 0 ? "" : teams.get(grid.blockedTeam).getName();
                String key = code + "|" + team;
                counts.computeIfAbsent(key, k -> new int[1])[0]++;
                teamOf.put(key, team);
            }
            List<String> keys = new ArrayList<>(counts.keySet());
            keys.sort(Comparator.<String>comparingInt(k -> -counts.get(k)[0])
                    .thenComparingInt(k -> CODE_ORDER.indexOf(k.substring(0, k.indexOf('|'))))
                    .thenComparingInt(k -> teamIndex(teams, teamOf.get(k))));
            List<Reason> reasons = new ArrayList<>();
            boolean search = false;
            for (String k : keys) {
                String code = k.substring(0, k.indexOf('|'));
                int days = counts.get(k)[0];
                search |= "SEARCH".equals(code);
                reasons.add(new Reason(code, teamOf.get(k), days,
                        reasonText(code, teamOf.get(k), days, grid.getDayCount(), g, st)));
            }
            String matchup = g.getHome().getName() + "–" + g.getAway().getName();
            StringBuilder text = new StringBuilder(search ? matchup + " 1경기를 아직 넣지 못했습니다." : matchup + " 1경기를 넣을 날이 없습니다.");
            for (TeamLimit limit : limits) {
                if (limit.team().equals(g.getHome().getName()) || limit.team().equals(g.getAway().getName())) {
                    text.append(' ').append(limit.text());
                }
            }
            for (int i = 0; i < Math.min(2, reasons.size()); i++) {
                text.append(' ').append(reasons.get(i).text());
            }
            out.add(new Unplaced(g.getKey(), g.getHome().getName(), g.getAway().getName(), reasons, text.toString()));
        }
        return new Result(out, limits);
    }

    private static int teamIndex(List<Team> teams, String name) {
        for (Team t : teams) {
            if (t.getName().equals(name)) {
                return t.getIndex();
            }
        }
        return -1;
    }

    static String reasonText(String code, String team, int days, int dayCount, RGame g, RescheduleSettings st) {
        String when = days == dayCount ? "기간의 모든 날" : "기간 " + dayCount + "일 중 " + days + "일";
        return switch (code) {
            case "RUN_LIMIT" -> when + "은 넣으면 " + team + "의 연속 경기일이 상한(" + st.getMaxConsecutiveDays() + "일)을 넘습니다.";
            case "TEAM_BUSY" -> when + "은 " + Korean.subject(team) + " 이미 다른 경기를 합니다.";
            case "STADIUM_BUSY" -> when + "은 " + g.getHome().getStadium() + "에서 다른 경기가 열립니다.";
            case "DH_LIMIT" -> st.getMaxDoubleHeaders() == 0
                    ? when + "은 더블헤더로만 넣을 수 있는데 더블헤더를 쓰지 않게 정해 두었습니다."
                    : when + "은 더블헤더로만 넣을 수 있는데 " + team + "의 더블헤더가 이미 상한(" + st.getMaxDoubleHeaders() + "번)입니다.";
            case "PINNED_DAY" -> when + "은 더블헤더로만 넣을 수 있는데 그날 경기가 이미 발표되었습니다.";
            default -> when + "은 넣을 자리가 있는데 아직 넣지 못했습니다. 다시 실행해 보세요.";
        };
    }

    /**
     * 구단마다: 고정 경기가 있는 날은 꼭 경기하고, 나머지 날은 골라 쉬며 연속 경기일 상한을 지킬 때 할 수 있는 최대 경기일 수
     * + 남은 더블헤더 수. 이것보다 넣어야 할 경기(고정 + 배정 대상)가 많으면 그 차이만큼은 어떻게 해도 못 넣는다.
     */
    static List<TeamLimit> teamLimits(RescheduleSolution solution, DayGrid grid) {
        List<Team> teams = solution.getTeamList();
        RescheduleSettings st = solution.getSettings();
        int maxRun = st.getMaxConsecutiveDays();
        int dayCount = grid.getDayCount();
        int[] need = new int[teams.size()];
        boolean[][] forced = new boolean[teams.size()][dayCount];
        for (RGame g : solution.getGameList()) {
            need[g.getHome().getIndex()]++;
            need[g.getAway().getIndex()]++;
            if (g.isPinned() && g.getDay() != null) {
                forced[g.getHome().getIndex()][g.getDay().getIndex()] = true;
                forced[g.getAway().getIndex()][g.getDay().getIndex()] = true;
            }
        }
        List<TeamLimit> out = new ArrayList<>();
        for (Team team : teams) {
            int t = team.getIndex();
            // dp[r] = 지금까지 경기일 최대(연속 r일째로 끝남), 불가능은 -1
            int[] dp = new int[maxRun + 1];
            java.util.Arrays.fill(dp, -1);
            dp[Math.min(grid.runAtStart(t), maxRun)] = 0;
            for (int d = 0; d < dayCount; d++) {
                int[] next = new int[maxRun + 1];
                java.util.Arrays.fill(next, -1);
                for (int r = 0; r <= maxRun; r++) {
                    if (dp[r] < 0) {
                        continue;
                    }
                    if (!forced[t][d]) {
                        next[0] = Math.max(next[0], dp[r]);
                    }
                    if (r + 1 <= maxRun) {
                        next[r + 1] = Math.max(next[r + 1], dp[r] + 1);
                    }
                }
                dp = next;
            }
            int days = 0;
            for (int v : dp) {
                days = Math.max(days, v);
            }
            int capacity = days + Math.max(0, st.getMaxDoubleHeaders() - solution.getHistoryList().get(t).doubleHeadersUsed());
            if (need[t] > capacity) {
                out.add(new TeamLimit(team.getName(), capacity, need[t], Korean.topic(team.getName()) + " 이 기간에 최대 " + capacity
                        + "경기까지 할 수 있는데 넣어야 할 경기가 " + need[t] + "경기입니다."));
            }
        }
        return out;
    }
}
