package org.optaplanner.examples.baseball.reschedule;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.optaplanner.core.api.score.director.ScoreDirector;
import org.optaplanner.core.impl.heuristic.move.AbstractMove;

/**
 * 경기들을 새 날로 옮긴다(null이면 비움). 모든 재편성 이동(옮기기, 맞바꾸기, 더블헤더 만들기, 빼고 넣기, 두 날 체인)이 이 꼴이다.
 * {@link #isMoveDoable}은 꼭 지키는 규칙(DH-1·2·4·5)과 고정 경기를 점수 계산 전에 거른다.
 */
public final class GameDayMove extends AbstractMove<RescheduleSolution> {

    private final String type;
    private final List<RGame> games;
    private final List<RDay> targets;
    /** 이 단계의 점유표. 엔티티 날짜와 어긋나면 새로 만든다. */
    private DayGrid grid;

    GameDayMove(String type, List<RGame> games, List<RDay> targets, DayGrid grid) {
        if (games.size() != targets.size()) {
            throw new IllegalArgumentException("games and targets differ in size");
        }
        this.type = type;
        this.games = games;
        this.targets = targets;
        this.grid = grid;
    }

    static GameDayMove notDoable() {
        return new GameDayMove("none", List.of(), List.of(), null);
    }

    public List<RGame> games() {
        return games;
    }

    public List<RDay> targets() {
        return targets;
    }

    @Override
    public boolean isMoveDoable(ScoreDirector<RescheduleSolution> scoreDirector) {
        if (games.isEmpty()) {
            return false;
        }
        boolean changes = false;
        for (int i = 0; i < games.size(); i++) {
            if (games.get(i).getDay() != targets.get(i)) {
                changes = true;
            }
        }
        if (!changes) {
            return false;
        }
        DayGrid g = grid;
        if (g == null || g.solution != scoreDirector.getWorkingSolution() || stale(g)) {
            g = DayGrid.of(scoreDirector.getWorkingSolution());
            grid = g;
        }
        int[] idx = new int[targets.size()];
        for (int i = 0; i < idx.length; i++) {
            idx[i] = targets.get(i) == null ? -1 : targets.get(i).getIndex();
        }
        return g.doable(games, idx);
    }

    private boolean stale(DayGrid g) {
        for (RGame game : games) {
            int now = game.getDay() == null ? -1 : game.getDay().getIndex();
            if (g.dayOf(game) != now) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected GameDayMove createUndoMove(ScoreDirector<RescheduleSolution> scoreDirector) {
        List<RDay> back = new ArrayList<>(games.size());
        for (RGame game : games) {
            back.add(game.getDay());
        }
        return new GameDayMove(type, games, back, grid);
    }

    @Override
    protected void doMoveOnGenuineVariables(ScoreDirector<RescheduleSolution> scoreDirector) {
        for (int i = 0; i < games.size(); i++) {
            RGame game = games.get(i);
            RDay target = targets.get(i);
            if (game.getDay() == target) {
                continue;
            }
            scoreDirector.beforeVariableChanged(game, "day");
            game.setDay(target);
            scoreDirector.afterVariableChanged(game, "day");
        }
    }

    @Override
    public GameDayMove rebase(ScoreDirector<RescheduleSolution> destinationScoreDirector) {
        List<RDay> rebasedTargets = new ArrayList<>(targets.size());
        for (RDay day : targets) {
            rebasedTargets.add(day == null ? null : destinationScoreDirector.lookUpWorkingObject(day));
        }
        return new GameDayMove(type, rebaseList(games, destinationScoreDirector), rebasedTargets, null);
    }

    @Override
    public Collection<? extends Object> getPlanningEntities() {
        return games;
    }

    @Override
    public Collection<? extends Object> getPlanningValues() {
        List<RDay> values = new ArrayList<>();
        for (RDay day : targets) {
            if (day != null) {
                values.add(day);
            }
        }
        return values;
    }

    @Override
    public String getSimpleMoveTypeDescription() {
        return "GameDayMove(" + type + ")";
    }

    @Override
    public String toString() {
        return type + games + "->" + targets;
    }
}
