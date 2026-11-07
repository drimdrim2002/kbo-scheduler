package org.optaplanner.examples.baseball.reschedule;

import java.util.List;
import org.optaplanner.examples.baseball.domain.Team;

/**
 * 구단 × 날, 구장 × 날 점유표. 초기해·이동 검사(isMoveDoable)·못 넣은 이유가 함께 쓴다. 엔티티의 날짜와 따로 상태를 들고 있어
 * 시험 삼아 놓았다 되돌리기가 싸다. 규칙을 지킨 일정을 전제로 한다(구단 하루 최대 2경기).
 * <p>
 * {@link #check}의 검사 순서는 브라우저 reschedule.js와 같아야 한다(못 넣은 이유 문장이 같아지도록).
 */
public final class DayGrid {

    public static final int OK = 0;
    public static final int OK_DOUBLE_HEADER = 1;
    public static final int TEAM_BUSY = 2;
    public static final int STADIUM_BUSY = 3;
    public static final int RUN_LIMIT = 4;
    public static final int DH_LIMIT = 5;
    public static final int PINNED_DAY = 6;

    final RescheduleSolution solution;
    final List<Team> teams;
    final List<RDay> days;
    final int teamCount;
    final int dayCount;
    final int maxRun;
    final int maxDh;
    final int[] runAtStart;
    final int[][] count;
    final RGame[][] first;
    final RGame[][] second;
    final int[][] stadiumGames;
    final int[][] stadiumHome;
    final int[] doubleHeaders;
    /** 경기 id → 이 표에서의 날(index), 없으면 -1. */
    final int[] dayOf;
    /** 마지막 검사에서 걸린 구단(Team.getIndex()). */
    int blockedTeam = -1;

    private DayGrid(RescheduleSolution solution) {
        this.solution = solution;
        this.teams = solution.getTeamList();
        this.days = solution.getDayList();
        this.teamCount = teams.size();
        this.dayCount = days.size();
        this.maxRun = solution.getSettings().getMaxConsecutiveDays();
        this.maxDh = solution.getSettings().getMaxDoubleHeaders();
        this.runAtStart = new int[teamCount];
        this.doubleHeaders = new int[teamCount];
        for (TeamHistory h : solution.getHistoryList()) {
            runAtStart[h.teamIndex()] = h.runAtStart();
            doubleHeaders[h.teamIndex()] = h.doubleHeadersUsed();
        }
        int stadiums = 0;
        for (Team t : teams) {
            stadiums = Math.max(stadiums, t.getStadiumIndex() + 1);
        }
        this.count = new int[teamCount][dayCount];
        this.first = new RGame[teamCount][dayCount];
        this.second = new RGame[teamCount][dayCount];
        this.stadiumGames = new int[stadiums][dayCount];
        this.stadiumHome = new int[stadiums][dayCount];
        for (int[] row : stadiumHome) {
            java.util.Arrays.fill(row, -1);
        }
        this.dayOf = new int[solution.getGameList().size()];
        java.util.Arrays.fill(dayOf, -1);
    }

    /** 해의 지금 배정으로 만든다. */
    public static DayGrid of(RescheduleSolution solution) {
        DayGrid grid = new DayGrid(solution);
        for (RGame g : solution.getGameList()) {
            if (g.getDay() != null) {
                grid.place(g, g.getDay().getIndex());
            }
        }
        return grid;
    }

    /** 고정 경기만 놓은 빈 표. */
    public static DayGrid pinnedOnly(RescheduleSolution solution) {
        DayGrid grid = new DayGrid(solution);
        for (RGame g : solution.getGameList()) {
            if (g.isPinned() && g.getDay() != null) {
                grid.place(g, g.getDay().getIndex());
            }
        }
        return grid;
    }

    public int dayOf(RGame g) {
        return dayOf[g.getId().intValue()];
    }

    public void place(RGame g, int d) {
        int h = g.getHome().getIndex();
        int a = g.getAway().getIndex();
        add(h, d, g);
        add(a, d, g);
        if (count[h][d] == 2 && count[a][d] == 2 && first[h][d].sameMatchup(second[h][d])) {
            doubleHeaders[h]++;
            doubleHeaders[a]++;
        }
        int s = g.getHome().getStadiumIndex();
        stadiumGames[s][d]++;
        stadiumHome[s][d] = h;
        dayOf[g.getId().intValue()] = d;
    }

    public void remove(RGame g) {
        int d = dayOf[g.getId().intValue()];
        if (d < 0) {
            return;
        }
        int h = g.getHome().getIndex();
        int a = g.getAway().getIndex();
        if (count[h][d] == 2 && count[a][d] == 2 && first[h][d].sameMatchup(second[h][d])) {
            doubleHeaders[h]--;
            doubleHeaders[a]--;
        }
        drop(h, d, g);
        drop(a, d, g);
        int s = g.getHome().getStadiumIndex();
        if (--stadiumGames[s][d] <= 0) {
            stadiumGames[s][d] = 0;
            stadiumHome[s][d] = -1;
        }
        dayOf[g.getId().intValue()] = -1;
    }

    private void add(int t, int d, RGame g) {
        int c = count[t][d]++;
        if (c == 0) {
            first[t][d] = g;
        } else if (c == 1) {
            if (g.getId() < first[t][d].getId()) {
                second[t][d] = first[t][d];
                first[t][d] = g;
            } else {
                second[t][d] = g;
            }
        }
    }

    private void drop(int t, int d, RGame g) {
        int c = count[t][d];
        if (c <= 0) {
            return;
        }
        if (first[t][d] == g) {
            first[t][d] = second[t][d];
            second[t][d] = null;
        } else if (second[t][d] == g) {
            second[t][d] = null;
        }
        count[t][d] = c - 1;
    }

    /** d일을 경기일로 하면 그 날이 든 연속 경기일 수(기간 앞에서 이어진 날 포함). */
    public int runThrough(int t, int d) {
        int left = 0;
        int i = d - 1;
        while (i >= 0 && count[t][i] > 0) {
            left++;
            i--;
        }
        if (i < 0) {
            left += runAtStart[t];
        }
        int right = 0;
        for (int j = d + 1; j < dayCount && count[t][j] > 0; j++) {
            right++;
        }
        return left + 1 + right;
    }

    /**
     * 경기 g를 d일에 넣을 수 있는가. 걸린 구단은 {@link #blockedTeam}.
     * 순서: 두 구단 다 비었으면 구장 → 홈 연속 → 원정 연속, 둘 다 같은 대진 하나뿐이면 발표 경기 → 홈 더블헤더 → 원정 더블헤더,
     * 그 밖은 구단이 바쁨(홈 먼저).
     */
    public int check(RGame g, int d) {
        int h = g.getHome().getIndex();
        int a = g.getAway().getIndex();
        int hc = count[h][d];
        int ac = count[a][d];
        blockedTeam = -1;
        if (hc == 0 && ac == 0) {
            int sh = stadiumHome[g.getHome().getStadiumIndex()][d];
            if (sh >= 0) {
                blockedTeam = sh;
                return STADIUM_BUSY;
            }
            if (runThrough(h, d) > maxRun) {
                blockedTeam = h;
                return RUN_LIMIT;
            }
            if (runThrough(a, d) > maxRun) {
                blockedTeam = a;
                return RUN_LIMIT;
            }
            return OK;
        }
        if (hc == 1 && ac == 1 && first[h][d] == first[a][d] && first[h][d].sameMatchup(g)) {
            if (first[h][d].isPinned()) {
                blockedTeam = h;
                return PINNED_DAY;
            }
            if (doubleHeaders[h] >= maxDh) {
                blockedTeam = h;
                return DH_LIMIT;
            }
            if (doubleHeaders[a] >= maxDh) {
                blockedTeam = a;
                return DH_LIMIT;
            }
            return OK_DOUBLE_HEADER;
        }
        blockedTeam = hc > 0 ? h : a;
        return TEAM_BUSY;
    }

    public boolean canPlace(RGame g, int d) {
        return check(g, d) <= OK_DOUBLE_HEADER;
    }

    /**
     * 경기들을 새 날로(-1이면 비움) 옮기면 규칙을 지키는가. 표는 원래대로 되돌린다. 고정 경기가 들어 있으면 false.
     */
    public boolean doable(List<RGame> games, int[] targets) {
        int n = games.size();
        int[] before = new int[n];
        for (int i = 0; i < n; i++) {
            RGame g = games.get(i);
            if (g.isPinned()) {
                return false;
            }
            before[i] = dayOf(g);
        }
        for (RGame g : games) {
            remove(g);
        }
        boolean ok = true;
        int placed = 0;
        for (; placed < n; placed++) {
            int d = targets[placed];
            if (d < 0) {
                continue;
            }
            if (!canPlace(games.get(placed), d)) {
                ok = false;
                break;
            }
            place(games.get(placed), d);
        }
        for (int i = 0; i < Math.min(placed, n); i++) {
            if (targets[i] >= 0) {
                remove(games.get(i));
            }
        }
        for (int i = 0; i < n; i++) {
            if (before[i] >= 0) {
                place(games.get(i), before[i]);
            }
        }
        return ok;
    }

    public int getDayCount() {
        return dayCount;
    }

    public int count(int t, int d) {
        return count[t][d];
    }

    public RGame firstGame(int t, int d) {
        return first[t][d];
    }

    public RGame secondGame(int t, int d) {
        return second[t][d];
    }

    public int stadiumHome(int stadium, int d) {
        return stadiumHome[stadium][d];
    }

    public int doubleHeaders(int t) {
        return doubleHeaders[t];
    }

    public int runAtStart(int t) {
        return runAtStart[t];
    }
}
