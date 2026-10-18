package org.optaplanner.examples.baseball.solver;

import java.util.Iterator;
import java.util.List;
import java.util.Random;
import org.optaplanner.core.api.score.director.ScoreDirector;
import org.optaplanner.core.impl.heuristic.selector.move.factory.MoveIteratorFactory;
import org.optaplanner.examples.baseball.domain.BaseballSolution;

/**
 * Or-opt insertion and 2-opt reversal of free 3-game rounds inside one segment.
 * Slots that are pinned or not a 3-game round stay fixed, which keeps opening day, Children's Day,
 * and the 4-game series in place. Reversals of three rounds and insertions that only swap two rounds
 * are omitted because pillar swap already covers a single pair.
 */
public final class RoundBlockMoveIteratorFactory
        implements MoveIteratorFactory<BaseballSolution, SeriesReassignmentMove> {

    @Override
    public long getSize(ScoreDirector<BaseballSolution> scoreDirector) {
        return RoundNeighborhood.of(scoreDirector.getWorkingSolution()).blockUpperBound();
    }

    @Override
    public Iterator<SeriesReassignmentMove> createOriginalMoveIterator(ScoreDirector<BaseballSolution> scoreDirector) {
        return RoundNeighborhood.of(scoreDirector.getWorkingSolution()).feasibleBlockMoves().iterator();
    }

    @Override
    public Iterator<SeriesReassignmentMove> createRandomMoveIterator(ScoreDirector<BaseballSolution> scoreDirector,
            Random random) {
        List<SeriesReassignmentMove> feasible =
                RoundNeighborhood.of(scoreDirector.getWorkingSolution()).feasibleBlockMoves();
        return new SamplingMoveIterator(feasible, random);
    }
}
