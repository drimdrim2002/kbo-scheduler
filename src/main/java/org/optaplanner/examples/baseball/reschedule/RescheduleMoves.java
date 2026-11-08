package org.optaplanner.examples.baseball.reschedule;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Random;
import org.optaplanner.core.api.score.director.ScoreDirector;
import org.optaplanner.core.impl.heuristic.selector.move.factory.MoveIteratorFactory;

/**
 * 재편성 이동 공장 5종(설계 §3). 단계마다 점유표를 한 번 만들고, 무작위로 뽑은 후보 중 규칙을 지키는 것만 낸다.
 * 고정 경기는 고르지 않고, 체인이 고정 경기에 닿으면 만들지 않는다. 경기를 비우는 이동은 만들지 않는다.
 */
public final class RescheduleMoves {

    private static final int ATTEMPTS = 40;

    private RescheduleMoves() {
    }

    /** 한 단계의 재료: 점유표, 고정되지 않은 경기(배정된 것·빈 것). */
    static final class Step {
        final RescheduleSolution solution;
        final DayGrid grid;
        final List<RGame> free = new ArrayList<>();
        final List<RGame> placed = new ArrayList<>();
        final List<RGame> empty = new ArrayList<>();
        final List<RDay> days;

        Step(RescheduleSolution solution) {
            this.solution = solution;
            this.grid = DayGrid.of(solution);
            this.days = solution.getDayList();
            for (RGame g : solution.getGameList()) {
                if (g.isPinned()) {
                    continue;
                }
                free.add(g);
                (g.getDay() == null ? empty : placed).add(g);
            }
        }

        RDay day(int d) {
            return d < 0 ? null : days.get(d);
        }
    }

    public abstract static class Factory implements MoveIteratorFactory<RescheduleSolution, GameDayMove> {

        abstract GameDayMove propose(Step step, Random random);

        @Override
        public long getSize(ScoreDirector<RescheduleSolution> scoreDirector) {
            RescheduleSolution s = scoreDirector.getWorkingSolution();
            return (long) s.getGameList().size() * Math.max(1, s.getDayList().size());
        }

        @Override
        public Iterator<GameDayMove> createOriginalMoveIterator(ScoreDirector<RescheduleSolution> scoreDirector) {
            return createRandomMoveIterator(scoreDirector, new Random(0));
        }

        @Override
        public Iterator<GameDayMove> createRandomMoveIterator(ScoreDirector<RescheduleSolution> scoreDirector, Random random) {
            Step step = new Step(scoreDirector.getWorkingSolution());
            return new Iterator<>() {
                @Override
                public boolean hasNext() {
                    return !step.free.isEmpty() && !step.days.isEmpty();
                }

                @Override
                public GameDayMove next() {
                    for (int i = 0; i < ATTEMPTS; i++) {
                        GameDayMove m = propose(step, random);
                        if (m != null) {
                            return m;
                        }
                    }
                    return GameDayMove.notDoable();
                }
            };
        }
    }

    private static int[] indices(Step step, List<RDay> targets) {
        int[] idx = new int[targets.size()];
        for (int i = 0; i < idx.length; i++) {
            idx[i] = targets.get(i) == null ? -1 : targets.get(i).getIndex();
        }
        return idx;
    }

    static GameDayMove checked(Step step, String type, List<RGame> games, List<RDay> targets) {
        boolean changes = false;
        for (int i = 0; i < games.size(); i++) {
            if (games.get(i).getDay() != targets.get(i)) {
                changes = true;
            }
        }
        if (!changes || !step.grid.doable(games, indices(step, targets))) {
            return null;
        }
        return new GameDayMove(type, games, targets, step.grid);
    }

    /** M1 옮기기: 경기 하나를 다른 날로(비어 있던 경기를 넣는 것 포함). */
    public static final class Shift extends Factory {
        @Override
        GameDayMove propose(Step step, Random random) {
            RGame g = step.free.get(random.nextInt(step.free.size()));
            RDay d = step.days.get(random.nextInt(step.days.size()));
            return checked(step, "shift", List.of(g), List.of(d));
        }
    }

    /** M2 맞바꾸기: 배정된 두 경기의 날짜를 맞바꾼다. */
    public static final class Swap extends Factory {
        @Override
        GameDayMove propose(Step step, Random random) {
            if (step.placed.size() < 2) {
                return null;
            }
            RGame a = step.placed.get(random.nextInt(step.placed.size()));
            RGame b = step.placed.get(random.nextInt(step.placed.size()));
            if (a == b || a.getDay() == b.getDay() || a.sameMatchup(b)) {
                return null;
            }
            return checked(step, "swap", List.of(a, b), List.of(b.getDay(), a.getDay()));
        }
    }

    /** M3 더블헤더 만들기: 같은 홈·원정 경기의 날로 옮겨 더블헤더로 만들고 쓰던 날을 비운다. */
    public static final class DoubleHeader extends Factory {
        @Override
        GameDayMove propose(Step step, Random random) {
            if (step.placed.isEmpty()) {
                return null;
            }
            RGame g = step.placed.get(random.nextInt(step.placed.size()));
            List<RGame> twins = new ArrayList<>();
            for (RGame x : step.solution.getGameList()) {
                if (x != g && x.sameMatchup(g) && x.getDay() != null && x.getDay() != g.getDay() && !x.isPinned()) {
                    twins.add(x);
                }
            }
            if (twins.isEmpty()) {
                return null;
            }
            RGame twin = twins.get(random.nextInt(twins.size()));
            return checked(step, "doubleHeader", List.of(g), List.of(twin.getDay()));
        }
    }

    /** M4 빼고 넣기: 빈 경기를 넣고, 막는 경기(최대 2개)를 다른 날로 옮긴다. 못 넣은 경기 수가 줄어들 때만. */
    public static final class EjectInsert extends Factory {
        @Override
        GameDayMove propose(Step step, Random random) {
            if (step.empty.isEmpty()) {
                return null;
            }
            RGame g = step.empty.get(random.nextInt(step.empty.size()));
            int d = random.nextInt(step.days.size());
            DayGrid grid = step.grid;
            List<RGame> blockers = RescheduleInitializer.blockers(grid, g, d);
            if (blockers == null || blockers.isEmpty() || blockers.size() > 2) {
                return null;
            }
            int[] before = new int[blockers.size()];
            for (int i = 0; i < blockers.size(); i++) {
                before[i] = grid.dayOf(blockers.get(i));
                grid.remove(blockers.get(i));
            }
            List<RGame> games = new ArrayList<>();
            List<RDay> targets = new ArrayList<>();
            boolean ok = grid.canPlace(g, d);
            int[] moved = new int[blockers.size()];
            java.util.Arrays.fill(moved, -1);
            if (ok) {
                grid.place(g, d);
                for (int i = 0; i < blockers.size() && ok; i++) {
                    moved[i] = RescheduleInitializer.relocate(grid, blockers.get(i), d, random);
                    ok = moved[i] >= 0;
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
            if (!ok) {
                return null;
            }
            games.add(g);
            targets.add(step.day(d));
            for (int i = 0; i < blockers.size(); i++) {
                games.add(blockers.get(i));
                targets.add(step.day(moved[i]));
            }
            return checked(step, "ejectInsert", games, targets);
        }
    }

    /** M5 두 날 사이 체인: d1과 d2에서 구단·구장이 이어지는 경기 묶음을 통째로 맞바꾼다. 묶음이 두 날 전부면 날 맞바꾸기. */
    public static final class DayChain extends Factory {
        private static final int MAX_CHAIN = 14;

        @Override
        GameDayMove propose(Step step, Random random) {
            if (step.placed.isEmpty() || step.days.size() < 2) {
                return null;
            }
            RGame seed = step.placed.get(random.nextInt(step.placed.size()));
            int d1 = seed.getDay().getIndex();
            int d2 = random.nextInt(step.days.size());
            if (d2 == d1) {
                return null;
            }
            DayGrid grid = step.grid;
            List<RGame> chain = new ArrayList<>();
            chain.add(seed);
            for (int i = 0; i < chain.size(); i++) {
                RGame x = chain.get(i);
                if (x.isPinned() || chain.size() > MAX_CHAIN) {
                    return null;
                }
                int from = grid.dayOf(x);
                int to = from == d1 ? d2 : d1;
                int[] touch = {x.getHome().getIndex(), x.getAway().getIndex(),
                        grid.stadiumHome(x.getHome().getStadiumIndex(), to)};
                for (int t : touch) {
                    if (t < 0) {
                        continue;
                    }
                    for (RGame y : new RGame[] {grid.firstGame(t, to), grid.secondGame(t, to), grid.firstGame(t, from), grid.secondGame(t, from)}) {
                        if (y != null && !chain.contains(y) && (grid.dayOf(y) == to || y.sameMatchup(x))) {
                            chain.add(y);
                        }
                    }
                }
            }
            List<RDay> targets = new ArrayList<>(chain.size());
            for (RGame x : chain) {
                targets.add(step.day(grid.dayOf(x) == d1 ? d2 : d1));
            }
            return checked(step, "dayChain", chain, targets);
        }
    }
}
