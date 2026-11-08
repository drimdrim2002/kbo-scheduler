package org.optaplanner.examples.baseball.reschedule;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;

/**
 * 꼭 지키는 규칙을 지키는 첫 배정(설계 §2). 가장 막힌 경기부터, 남은 경기의 자리를 가장 덜 빼앗는 날에 넣는다.
 * 넣을 날이 없으면 막고 있는 경기 1~2개를 빼고 다시 넣어 본다. 이것을 여러 번(시드로 조금씩 다르게) 돌려
 * 못 넣은 경기가 가장 적고, 같으면 점수가 높은 배정을 고른다. 넣지 못한 경기는 비워 둔다.
 */
public final class RescheduleInitializer {

    public static final int DEFAULT_RESTARTS = 30;
    private static final int REPAIR_TRIES = 200;

    private RescheduleInitializer() {
    }

    /** @return 못 넣은 경기 수 */
    public static int initialize(RescheduleSolution solution, long seed) {
        return initialize(solution, seed, DEFAULT_RESTARTS);
    }

    public static int initialize(RescheduleSolution solution, long seed, int restarts) {
        List<RGame> free = new ArrayList<>();
        for (RGame g : solution.getGameList()) {
            if (!g.isPinned()) {
                free.add(g);
                g.setDay(null);
            }
        }
        Random random = new Random(seed);
        int[] best = null;
        int bestUnplaced = Integer.MAX_VALUE;
        BendableLongScore bestScore = null;
        for (int r = 0; r < Math.max(1, restarts); r++) {
            int[] assignment = construct(solution, free, new Random(random.nextLong()));
            int unplaced = 0;
            for (int i = 0; i < free.size(); i++) {
                RDay day = assignment[i] < 0 ? null : solution.getDayList().get(assignment[i]);
                free.get(i).setDay(day);
                if (day == null) {
                    unplaced++;
                }
            }
            BendableLongScore score = RescheduleScoreFormulas.evaluate(solution);
            if (best == null || unplaced < bestUnplaced || (unplaced == bestUnplaced && score.compareTo(bestScore) > 0)) {
                best = assignment;
                bestUnplaced = unplaced;
                bestScore = score;
            }
        }
        for (int i = 0; i < free.size(); i++) {
            free.get(i).setDay(best[i] < 0 ? null : solution.getDayList().get(best[i]));
        }
        return bestUnplaced;
    }

    /** 한 번 만들기. 결과는 free 순서의 날(index), 못 넣으면 -1. */
    static int[] construct(RescheduleSolution solution, List<RGame> free, Random random) {
        DayGrid grid = DayGrid.pinnedOnly(solution);
        int n = free.size();
        int dayCount = grid.getDayCount();
        boolean[] done = new boolean[n];
        int[] feasibleCount = new int[n];
        int remaining = n;
        while (remaining > 0) {
            // 가장 막힌 경기: 넣을 수 있는 날(보통 + 더블헤더)이 가장 적은 것
            int pick = -1;
            int pickCount = Integer.MAX_VALUE;
            int ties = 0;
            for (int i = 0; i < n; i++) {
                if (done[i]) {
                    continue;
                }
                int c = 0;
                for (int d = 0; d < dayCount; d++) {
                    if (grid.canPlace(free.get(i), d)) {
                        c++;
                    }
                }
                feasibleCount[i] = c;
                if (c < pickCount) {
                    pick = i;
                    pickCount = c;
                    ties = 1;
                } else if (c == pickCount && random.nextInt(++ties) == 0) {
                    pick = i;
                }
            }
            RGame g = free.get(pick);
            done[pick] = true;
            remaining--;
            if (pickCount == 0) {
                repair(grid, free, done, g, random);
                continue;
            }
            int day = chooseDay(grid, free, done, g, random);
            grid.place(g, day);
        }
        int[] out = new int[n];
        for (int i = 0; i < n; i++) {
            out[i] = grid.dayOf(free.get(i));
        }
        return out;
    }

    /**
     * 남은 경기에게서 가장 적은 자리를 빼앗는 날. 보통 경기 날이 있으면 더블헤더 날은 보지 않는다. 같으면 무작위.
     */
    private static int chooseDay(DayGrid grid, List<RGame> free, boolean[] done, RGame g, Random random) {
        int dayCount = grid.getDayCount();
        boolean anyNormal = false;
        for (int d = 0; d < dayCount; d++) {
            if (grid.check(g, d) == DayGrid.OK) {
                anyNormal = true;
                break;
            }
        }
        int best = -1;
        int bestLoss = Integer.MAX_VALUE;
        int ties = 0;
        for (int d = 0; d < dayCount; d++) {
            int r = grid.check(g, d);
            if (r > DayGrid.OK_DOUBLE_HEADER || (anyNormal && r != DayGrid.OK)) {
                continue;
            }
            int loss = 0;
            for (int i = 0; i < free.size(); i++) {
                RGame other = free.get(i);
                if (done[i] || other == g) {
                    continue;
                }
                boolean related = other.getHome() == g.getHome() || other.getHome() == g.getAway()
                        || other.getAway() == g.getHome() || other.getAway() == g.getAway()
                        || other.getHome().getStadiumIndex() == g.getHome().getStadiumIndex();
                if (related && grid.canPlace(other, d)) {
                    loss++;
                }
            }
            if (loss < bestLoss) {
                best = d;
                bestLoss = loss;
                ties = 1;
            } else if (loss == bestLoss && random.nextInt(++ties) == 0) {
                best = d;
            }
        }
        return best;
    }

    /**
     * 넣을 날이 없는 경기 g: 구단이나 구장을 막고 있는 고정되지 않은 경기(최대 2개)를 빼고 g를 넣은 뒤, 뺀 경기를 다른 날에 넣는다.
     * 모두 들어가면 받아들이고, 아니면 되돌린다.
     */
    private static void repair(DayGrid grid, List<RGame> free, boolean[] done, RGame g, Random random) {
        int dayCount = grid.getDayCount();
        int offset = random.nextInt(dayCount);
        int tries = 0;
        for (int k = 0; k < dayCount && tries < REPAIR_TRIES; k++) {
            int d = (offset + k) % dayCount;
            List<RGame> blockers = blockers(grid, g, d);
            if (blockers == null || blockers.isEmpty() || blockers.size() > 2) {
                continue;
            }
            tries++;
            int[] before = new int[blockers.size()];
            for (int i = 0; i < blockers.size(); i++) {
                before[i] = grid.dayOf(blockers.get(i));
                grid.remove(blockers.get(i));
            }
            if (grid.canPlace(g, d)) {
                grid.place(g, d);
                int[] moved = new int[blockers.size()];
                boolean all = true;
                for (int i = 0; i < blockers.size(); i++) {
                    moved[i] = relocate(grid, blockers.get(i), d, random);
                    if (moved[i] < 0) {
                        all = false;
                        break;
                    }
                }
                if (all) {
                    return;
                }
                for (int i = 0; i < blockers.size(); i++) {
                    if (moved[i] >= 0) {
                        grid.remove(blockers.get(i));
                    }
                }
                grid.remove(g);
            }
            for (int i = 0; i < blockers.size(); i++) {
                grid.place(blockers.get(i), before[i]);
            }
        }
    }

    /** d일에 g의 두 구단과 g의 홈 구장을 쓰는 경기들. 고정 경기가 하나라도 있으면 null. */
    static List<RGame> blockers(DayGrid grid, RGame g, int d) {
        List<RGame> out = new ArrayList<>(3);
        int[] teamsOf = {g.getHome().getIndex(), g.getAway().getIndex()};
        for (int t : teamsOf) {
            for (RGame x : new RGame[] {grid.firstGame(t, d), grid.secondGame(t, d)}) {
                if (x != null && !out.contains(x)) {
                    out.add(x);
                }
            }
        }
        int host = grid.stadiumHome(g.getHome().getStadiumIndex(), d);
        if (host >= 0) {
            for (RGame x : new RGame[] {grid.firstGame(host, d), grid.secondGame(host, d)}) {
                if (x != null && !out.contains(x)) {
                    out.add(x);
                }
            }
        }
        for (RGame x : out) {
            if (x.isPinned()) {
                return null;
            }
        }
        return out;
    }

    /** 빼낸 경기를 다른 날(except 말고)에 넣는다. 보통 경기 날을 먼저 본다. @return 넣은 날, 못 넣으면 -1 */
    static int relocate(DayGrid grid, RGame g, int except, Random random) {
        int dayCount = grid.getDayCount();
        int offset = random.nextInt(dayCount);
        int dh = -1;
        for (int k = 0; k < dayCount; k++) {
            int d = (offset + k) % dayCount;
            if (d == except) {
                continue;
            }
            int r = grid.check(g, d);
            if (r == DayGrid.OK) {
                grid.place(g, d);
                return d;
            }
            if (r == DayGrid.OK_DOUBLE_HEADER && dh < 0) {
                dh = d;
            }
        }
        if (dh >= 0) {
            grid.place(g, dh);
        }
        return dh;
    }
}
