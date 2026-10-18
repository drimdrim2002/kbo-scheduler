package org.optaplanner.examples.baseball.solver;

import java.util.Iterator;
import java.util.List;
import java.util.Random;
import org.optaplanner.core.api.score.director.ScoreDirector;
import org.optaplanner.core.impl.heuristic.selector.move.factory.MoveIteratorFactory;
import org.optaplanner.examples.baseball.domain.BaseballSolution;

/**
 * Alternating-cycle exchange between two free 3-game rounds (TTP partial round swap).
 * A cycle that covers all five series is a full round swap, already produced by pillar swap, so it
 * is left out. Cycles that stack the shared stadium or break a hard streak or rematch are left out too.
 */
public final class KempeChainMoveIteratorFactory
        implements MoveIteratorFactory<BaseballSolution, SeriesReassignmentMove> {

    @Override
    public long getSize(ScoreDirector<BaseballSolution> scoreDirector) {
        return RoundNeighborhood.of(scoreDirector.getWorkingSolution()).kempeUpperBound();
    }

    @Override
    public Iterator<SeriesReassignmentMove> createOriginalMoveIterator(ScoreDirector<BaseballSolution> scoreDirector) {
        return RoundNeighborhood.of(scoreDirector.getWorkingSolution()).feasibleKempeMoves().iterator();
    }

    @Override
    public Iterator<SeriesReassignmentMove> createRandomMoveIterator(ScoreDirector<BaseballSolution> scoreDirector,
            Random random) {
        List<SeriesReassignmentMove> feasible =
                RoundNeighborhood.of(scoreDirector.getWorkingSolution()).feasibleKempeMoves();
        return new SamplingMoveIterator(feasible, random);
    }
}
