package org.optaplanner.examples.baseball.bench;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.core.api.solver.event.BestSolutionChangedEvent;
import org.optaplanner.core.api.solver.event.SolverEventListener;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.Team;

/**
 * Records the search as a replayable JSON trace: one entry per best-solution event with the elapsed
 * time, the score, and the series whose slot changed since the previous best solution. The header holds
 * the teams, slots and the starting assignment so a browser can replay the search from the trace alone.
 *
 * <p>Listener callbacks run on the solver thread; read the trace only after {@code solve()} returns.
 */
public final class SolveTrace implements SolverEventListener<BaseballSolution> {

    public static final long UNASSIGNED = -1L;

    public record Change(long matchId, long fromSlot, long toSlot) {
    }

    public record Event(long elapsedMs, BendableLongScore score, List<Change> changes) {
    }

    private final BaseballSolution initial;
    private final long seed;
    private final BendableLongScore initialScore;
    private Map<Long, Long> previous;
    private final List<Event> events = new ArrayList<>();

    /**
     * @param initial the solution handed to the solver; the first event is diffed against it
     * @param initialScore score of {@code initial}, or null if unknown (the solver fires no event for it)
     */
    public SolveTrace(BaseballSolution initial, long seed, BendableLongScore initialScore) {
        this.initial = initial;
        this.seed = seed;
        this.initialScore = initialScore;
        this.previous = assignment(initial);
    }

    /** match id → calendar id (slot index), {@link #UNASSIGNED} for a null calendar. */
    public static Map<Long, Long> assignment(BaseballSolution solution) {
        Map<Long, Long> map = new LinkedHashMap<>();
        for (Match match : solution.getMatchList()) {
            Calendar calendar = match.getCalendar();
            map.put(match.getId(), calendar == null ? UNASSIGNED : calendar.getId());
        }
        return map;
    }

    @Override
    public void bestSolutionChanged(BestSolutionChangedEvent<BaseballSolution> event) {
        Map<Long, Long> now = assignment(event.getNewBestSolution());
        List<Change> changes = new ArrayList<>();
        for (Map.Entry<Long, Long> entry : now.entrySet()) {
            Long before = previous.getOrDefault(entry.getKey(), UNASSIGNED);
            if (!before.equals(entry.getValue())) {
                changes.add(new Change(entry.getKey(), before, entry.getValue()));
            }
        }
        events.add(new Event(event.getTimeMillisSpent(), (BendableLongScore) event.getNewBestScore(),
                Collections.unmodifiableList(changes)));
        previous = now;
    }

    public List<Event> events() {
        return Collections.unmodifiableList(events);
    }

    public int eventCount() {
        return events.size();
    }

    public int changeCount() {
        int total = 0;
        for (Event event : events) {
            total += event.changes().size();
        }
        return total;
    }

    public String toJson() {
        StringBuilder sb = new StringBuilder(64 * 1024);
        sb.append("{\n");
        sb.append("  \"seed\": ").append(seed).append(",\n");
        sb.append("  \"initialScore\": ").append(initialScore == null ? "null" : scoreJson(initialScore)).append(",\n");
        sb.append("  \"teams\": [");
        boolean first = true;
        for (Team team : initial.getTeamList()) {
            sb.append(first ? "" : ", ");
            first = false;
            sb.append("{\"index\": ").append(team.getIndex())
                    .append(", \"name\": \"").append(escape(team.getName()))
                    .append("\", \"stadium\": \"").append(escape(team.getStadium())).append("\"}");
        }
        sb.append("],\n");
        sb.append("  \"slots\": [");
        first = true;
        for (Calendar calendar : initial.getCalendarList()) {
            if (!calendar.isRegular()) {
                continue;
            }
            sb.append(first ? "" : ", ");
            first = false;
            sb.append("{\"id\": ").append(calendar.getId())
                    .append(", \"start\": \"").append(calendar.getStartTime().toLocalDate())
                    .append("\", \"games\": ").append(calendar.getConsecutive())
                    .append(", \"weekend\": ").append(calendar.getWeekend())
                    .append(", \"holiday\": ").append(calendar.getHoliday()).append("}");
        }
        sb.append("],\n");
        sb.append("  \"series\": [");
        first = true;
        Map<Long, Long> start = assignment(initial);
        for (Match match : initial.getMatchList()) {
            sb.append(first ? "" : ", ");
            first = false;
            sb.append("{\"id\": ").append(match.getId())
                    .append(", \"home\": ").append(match.getHome().getIndex())
                    .append(", \"away\": ").append(match.getAway().getIndex())
                    .append(", \"games\": ").append(match.getConsecutive())
                    .append(", \"slot\": ").append(start.get(match.getId())).append("}");
        }
        sb.append("],\n");
        sb.append("  \"events\": [\n");
        for (int i = 0; i < events.size(); i++) {
            Event event = events.get(i);
            sb.append("    {\"elapsedMs\": ").append(event.elapsedMs())
                    .append(", \"score\": ").append(scoreJson(event.score()))
                    .append(", \"changes\": [");
            boolean firstChange = true;
            for (Change change : event.changes()) {
                sb.append(firstChange ? "" : ", ");
                firstChange = false;
                sb.append('[').append(change.matchId()).append(", ").append(change.fromSlot())
                        .append(", ").append(change.toSlot()).append(']');
            }
            sb.append("]}").append(i + 1 < events.size() ? ",\n" : "\n");
        }
        sb.append("  ]\n}\n");
        return sb.toString();
    }

    public static String scoreJson(BendableLongScore score) {
        StringBuilder sb = new StringBuilder("{\"hard\": [");
        for (int i = 0; i < score.hardLevelsSize(); i++) {
            sb.append(i == 0 ? "" : ", ").append(score.hardScore(i));
        }
        sb.append("], \"soft\": [");
        for (int i = 0; i < score.softLevelsSize(); i++) {
            sb.append(i == 0 ? "" : ", ").append(score.softScore(i));
        }
        return sb.append("]}").toString();
    }

    public long writeTo(Path path) throws IOException {
        if (path.getParent() != null) {
            Files.createDirectories(path.getParent());
        }
        byte[] bytes = toJson().getBytes(StandardCharsets.UTF_8);
        Files.write(path, bytes);
        return bytes.length;
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
