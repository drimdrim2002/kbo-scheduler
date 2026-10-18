package org.optaplanner.examples.baseball.solver;

import java.util.Iterator;
import java.util.List;
import java.util.Random;

/**
 * Never-ending uniform sample of the feasible moves built for one local-search step.
 * An empty list yields a move that {@link SeriesReassignmentMove#isMoveDoable} rejects, so a step
 * does not stop just because one neighborhood is empty.
 */
final class SamplingMoveIterator implements Iterator<SeriesReassignmentMove> {

    private final List<SeriesReassignmentMove> feasible;
    private final Random random;

    SamplingMoveIterator(List<SeriesReassignmentMove> feasible, Random random) {
        this.feasible = feasible;
        this.random = random;
    }

    @Override
    public boolean hasNext() {
        return true;
    }

    @Override
    public SeriesReassignmentMove next() {
        if (feasible.isEmpty()) {
            return SeriesReassignmentMove.notDoable();
        }
        return feasible.get(random.nextInt(feasible.size()));
    }
}
