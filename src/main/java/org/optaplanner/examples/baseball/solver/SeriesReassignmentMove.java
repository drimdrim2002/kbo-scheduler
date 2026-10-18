package org.optaplanner.examples.baseball.solver;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.optaplanner.core.api.score.director.ScoreDirector;
import org.optaplanner.core.impl.heuristic.move.AbstractMove;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Match;

/**
 * Assigns each series to a specific calendar. Kempe-chain and round-block factories both emit this
 * move. {@link #isMoveDoable} accepts it only when the assignment still has a complete matching on
 * every touched day, five distinct stadiums, no successive rematch, and no four-game home or away run.
 */
public final class SeriesReassignmentMove extends AbstractMove<BaseballSolution> {

    private final String type;
    private final List<Match> matches;
    private final List<Calendar> targets;

    SeriesReassignmentMove(String type, List<Match> matches, List<Calendar> targets) {
        if (matches.size() != targets.size()) {
            throw new IllegalArgumentException("matches and targets differ in size");
        }
        this.type = type;
        this.matches = matches;
        this.targets = targets;
    }

    static SeriesReassignmentMove notDoable() {
        return new SeriesReassignmentMove("none", List.of(), List.of());
    }

    List<Match> matches() {
        return matches;
    }

    List<Calendar> targets() {
        return targets;
    }

    @Override
    public boolean isMoveDoable(ScoreDirector<BaseballSolution> scoreDirector) {
        return preserves(scoreDirector.getWorkingSolution());
    }

    /**
     * @return true when applying this assignment keeps hard scores at zero on a feasible schedule
     */
    boolean preserves(BaseballSolution solution) {
        return RoundNeighborhood.of(solution).preserves(matches, targets);
    }

    @Override
    protected SeriesReassignmentMove createUndoMove(ScoreDirector<BaseballSolution> scoreDirector) {
        int size = matches.size();
        List<Calendar> back = new ArrayList<>(size);
        for (int i = 0; i < size; i++) {
            back.add(matches.get(i).getCalendar());
        }
        return new SeriesReassignmentMove(type, matches, back);
    }

    @Override
    protected void doMoveOnGenuineVariables(ScoreDirector<BaseballSolution> scoreDirector) {
        for (int i = 0; i < matches.size(); i++) {
            Match match = matches.get(i);
            Calendar target = targets.get(i);
            if (match.getCalendar() == target) {
                continue;
            }
            scoreDirector.beforeVariableChanged(match, "calendar");
            match.setCalendar(target);
            scoreDirector.afterVariableChanged(match, "calendar");
        }
    }

    @Override
    public SeriesReassignmentMove rebase(ScoreDirector<BaseballSolution> destinationScoreDirector) {
        return new SeriesReassignmentMove(type, rebaseList(matches, destinationScoreDirector),
                rebaseList(targets, destinationScoreDirector));
    }

    @Override
    public Collection<? extends Object> getPlanningEntities() {
        return matches;
    }

    @Override
    public Collection<? extends Object> getPlanningValues() {
        return targets;
    }

    @Override
    public String toString() {
        return type + "(" + matches.size() + " series)";
    }
}
