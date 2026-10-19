package org.optaplanner.examples.baseball.bench;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.core.api.solver.event.BestSolutionChangedEvent;
import org.optaplanner.core.api.solver.event.SolverEventListener;
import org.optaplanner.examples.baseball.domain.BaseballSolution;

/** Records (elapsed ms, best score) for every best-solution event of one solve. */
public final class ScoreRecorder implements SolverEventListener<BaseballSolution> {

    public record Point(long elapsedMs, BendableLongScore score) {
    }

    private final List<Point> points = new ArrayList<>();

    @Override
    public void bestSolutionChanged(BestSolutionChangedEvent<BaseballSolution> event) {
        points.add(new Point(event.getTimeMillisSpent(), (BendableLongScore) event.getNewBestScore()));
    }

    public List<Point> points() {
        return Collections.unmodifiableList(points);
    }

    public int eventCount() {
        return points.size();
    }

    public long lastImprovedMs() {
        return points.isEmpty() ? -1 : points.get(points.size() - 1).elapsedMs();
    }

    public BendableLongScore firstScore() {
        return points.isEmpty() ? null : points.get(0).score();
    }

    public BendableLongScore lastScore() {
        return points.isEmpty() ? null : points.get(points.size() - 1).score();
    }

    /** Elapsed ms at which the given soft level first became 0 (and stayed there), or -1. */
    public long firstZeroMs(int softLevel) {
        for (Point point : points) {
            if (point.score().softScore(softLevel) == 0) {
                return point.elapsedMs();
            }
        }
        return -1;
    }
}
