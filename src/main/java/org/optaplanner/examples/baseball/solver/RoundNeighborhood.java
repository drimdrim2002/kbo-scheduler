package org.optaplanner.examples.baseball.solver;

import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Constants;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.score.ScoreFormulas;

/**
 * One step's series-to-slot index and the hard checks shared by the Kempe and round-block moves.
 * <p>
 * An alternating cycle keeps every team in both rounds, but it does not keep five stadiums: the
 * shared-stadium home series travel with the cycle and can stack on one day. Successive rematches
 * and home/away runs of four are hard as well. Both are rejected here, before the score director
 * evaluates the move.
 */
final class RoundNeighborhood {

    static final int TEAM_COUNT = ScoreFormulas.TEAMS_PER_DAY;
    static final int SERIES_PER_DAY = ScoreFormulas.SERIES_PER_DAY;
    private static final int FULL_MASK = (1 << TEAM_COUNT) - 1;

    final Calendar[] calendars;
    final Match[][] matches;
    final int[] count;
    /** Home-team bitmask, or {@code -1} when the slot is not a complete matching. */
    final int[] homeMask;
    final long[] pairMask;
    final boolean[] movable;
    final int[] movableSlots;
    /** Inclusive runs of movable slots. Fixed anchors (2-game, Children's Day, 4-game) split them. */
    final int[][] segments;

    private RoundNeighborhood(Calendar[] calendars, Match[][] matches, int[] count, int[] homeMask, long[] pairMask,
            boolean[] movable, int[] movableSlots, int[][] segments) {
        this.calendars = calendars;
        this.matches = matches;
        this.count = count;
        this.homeMask = homeMask;
        this.pairMask = pairMask;
        this.movable = movable;
        this.movableSlots = movableSlots;
        this.segments = segments;
    }

    static RoundNeighborhood of(BaseballSolution solution) {
        int slotCount = 0;
        for (Calendar calendar : solution.getCalendarList()) {
            if (calendar != null && calendar.isRegular()) {
                slotCount = Math.max(slotCount, calendar.getSlotIndex() + 1);
            }
        }
        Calendar[] calendars = new Calendar[slotCount];
        for (Calendar calendar : solution.getCalendarList()) {
            if (calendar != null && calendar.isRegular()) {
                int slot = calendar.getSlotIndex();
                if (slot >= 0 && slot < slotCount) {
                    calendars[slot] = calendar;
                }
            }
        }
        Match[][] matches = new Match[slotCount][SERIES_PER_DAY];
        int[] count = new int[slotCount];
        boolean[] pinned = new boolean[slotCount];
        for (Match match : solution.getMatchList()) {
            Calendar calendar = match.getCalendar();
            if (calendar == null || !calendar.isRegular()) {
                continue;
            }
            int slot = calendar.getSlotIndex();
            if (slot < 0 || slot >= slotCount) {
                continue;
            }
            int index = count[slot];
            if (index >= matches[slot].length) {
                Match[] grown = new Match[matches[slot].length * 2];
                System.arraycopy(matches[slot], 0, grown, 0, matches[slot].length);
                matches[slot] = grown;
            }
            matches[slot][index] = match;
            count[slot] = index + 1;
            if (match.isPinned()) {
                pinned[slot] = true;
            }
        }
        int[] homeMask = new int[slotCount];
        long[] pairMask = new long[slotCount];
        boolean[] movable = new boolean[slotCount];
        int movableCount = 0;
        for (int slot = 0; slot < slotCount; slot++) {
            SlotFacts facts = facts(matches[slot], count[slot], calendars[slot]);
            homeMask[slot] = facts == null ? -1 : facts.homeMask;
            pairMask[slot] = facts == null ? 0L : facts.pairMask;
            boolean freeRound = facts != null && calendars[slot].getConsecutive() == 3 && !pinned[slot];
            movable[slot] = freeRound;
            if (freeRound) {
                movableCount++;
            }
        }
        int[] movableSlots = new int[movableCount];
        int cursor = 0;
        List<int[]> segmentList = new ArrayList<>();
        int segmentStart = -1;
        for (int slot = 0; slot < slotCount; slot++) {
            if (movable[slot]) {
                movableSlots[cursor++] = slot;
                if (segmentStart < 0) {
                    segmentStart = slot;
                }
            } else if (segmentStart >= 0) {
                segmentList.add(range(segmentStart, slot - 1));
                segmentStart = -1;
            }
        }
        if (segmentStart >= 0) {
            segmentList.add(range(segmentStart, slotCount - 1));
        }
        return new RoundNeighborhood(calendars, matches, count, homeMask, pairMask, movable, movableSlots,
                segmentList.toArray(int[][]::new));
    }

    long kempeUpperBound() {
        long rounds = movableSlots.length;
        return rounds < 2 ? 0L : rounds * (rounds - 1L) / 2L;
    }

    long blockUpperBound() {
        long total = 0L;
        for (int[] segment : segments) {
            total += blockCandidates(segment.length);
        }
        return total;
    }

    List<SeriesReassignmentMove> structuralKempeMoves() {
        List<SeriesReassignmentMove> moves = new ArrayList<>();
        for (int leftIndex = 0; leftIndex < movableSlots.length; leftIndex++) {
            for (int rightIndex = leftIndex + 1; rightIndex < movableSlots.length; rightIndex++) {
                moves.addAll(structuralKempe(movableSlots[leftIndex], movableSlots[rightIndex]));
            }
        }
        return moves;
    }

    List<SeriesReassignmentMove> feasibleKempeMoves() {
        return feasibleOnly(structuralKempeMoves());
    }

    List<SeriesReassignmentMove> structuralBlockMoves() {
        List<SeriesReassignmentMove> moves = new ArrayList<>();
        for (int[] segment : segments) {
            addBlocks(moves, segment);
        }
        return moves;
    }

    List<SeriesReassignmentMove> feasibleBlockMoves() {
        return feasibleOnly(structuralBlockMoves());
    }

    private List<SeriesReassignmentMove> feasibleOnly(List<SeriesReassignmentMove> structural) {
        List<SeriesReassignmentMove> feasible = new ArrayList<>();
        for (SeriesReassignmentMove move : structural) {
            if (preserves(move.matches(), move.targets())) {
                feasible.add(move);
            }
        }
        return feasible;
    }

    /**
     * Structural Kempe moves for one pair, without the hard filter. Tests compare these with the score.
     */
    List<SeriesReassignmentMove> structuralKempe(int leftSlot, int rightSlot) {
        List<SeriesReassignmentMove> moves = new ArrayList<>();
        for (Cycle cycle : cycles(leftSlot, rightSlot)) {
            if (cycle.leftMatches.length == SERIES_PER_DAY || !cycle.changesHomeAway()) {
                continue;
            }
            moves.add(kempeMove(leftSlot, rightSlot, cycle));
        }
        return moves;
    }

    boolean preserves(List<Match> moved, List<Calendar> targets) {
        int size = moved.size();
        if (size == 0 || size != targets.size()) {
            return false;
        }
        IdentityHashMap<Match, Calendar> targetByMatch = new IdentityHashMap<>(size * 2);
        boolean changed = false;
        boolean[] slotTouched = new boolean[calendars.length];
        for (int i = 0; i < size; i++) {
            Match match = moved.get(i);
            Calendar target = targets.get(i);
            if (match == null || target == null || match.isPinned() || !target.isRegular()) {
                return false;
            }
            if (match.getConsecutive() != target.getConsecutive()) {
                return false;
            }
            Calendar from = match.getCalendar();
            if (from == null || !from.isRegular() || from.getSlotIndex() < 0 || from.getSlotIndex() >= calendars.length) {
                return false;
            }
            if (targetByMatch.put(match, target) != null) {
                return false;
            }
            if (from != target) {
                changed = true;
                slotTouched[from.getSlotIndex()] = true;
                slotTouched[target.getSlotIndex()] = true;
            }
        }
        if (!changed) {
            return false;
        }

        int[] homeAfter = homeMask.clone();
        long[] pairAfter = pairMask.clone();
        int[] countAfter = count.clone();
        for (int slot = 0; slot < calendars.length; slot++) {
            if (!slotTouched[slot]) {
                continue;
            }
            List<Match> next = new ArrayList<>(SERIES_PER_DAY);
            for (int index = 0; index < count[slot]; index++) {
                Match match = matches[slot][index];
                Calendar target = targetByMatch.get(match);
                int destination = target == null ? slot : target.getSlotIndex();
                if (destination == slot) {
                    next.add(match);
                }
            }
            for (Map.Entry<Match, Calendar> entry : targetByMatch.entrySet()) {
                if (entry.getValue().getSlotIndex() != slot) {
                    continue;
                }
                int origin = entry.getKey().getCalendar().getSlotIndex();
                if (origin != slot) {
                    next.add(entry.getKey());
                }
            }
            SlotFacts facts = facts(next.toArray(Match[]::new), next.size(), calendars[slot]);
            if (facts == null) {
                return false;
            }
            homeAfter[slot] = facts.homeMask;
            pairAfter[slot] = facts.pairMask;
            countAfter[slot] = next.size();
        }

        for (int slot = 0; slot < calendars.length; slot++) {
            Calendar calendar = calendars[slot];
            if (calendar == null) {
                continue;
            }
            Calendar previous = calendar.getPrev();
            if (previous == null || !previous.isRegular()) {
                continue;
            }
            int previousSlot = previous.getSlotIndex();
            if (previousSlot < 0 || previousSlot >= calendars.length) {
                continue;
            }
            if (!slotTouched[slot] && !slotTouched[previousSlot]) {
                continue;
            }
            if (countAfter[slot] == 0 || countAfter[previousSlot] == 0) {
                continue;
            }
            if ((pairAfter[slot] & pairAfter[previousSlot]) != 0L) {
                return false;
            }
        }

        for (int window = 0; window + 3 < calendars.length; window++) {
            boolean overlap = false;
            boolean ready = true;
            int allHome = FULL_MASK;
            int anyHome = 0;
            for (int offset = 0; offset < 4; offset++) {
                int slot = window + offset;
                if (calendars[slot] == null || homeAfter[slot] < 0) {
                    ready = false;
                    break;
                }
                if (slotTouched[slot]) {
                    overlap = true;
                }
                allHome &= homeAfter[slot];
                anyHome |= homeAfter[slot];
            }
            if (!ready || !overlap) {
                continue;
            }
            if (allHome != 0 || (~anyHome & FULL_MASK) != 0) {
                return false;
            }
        }
        return true;
    }

    private void addBlocks(List<SeriesReassignmentMove> moves, int[] segment) {
        int length = segment.length;
        // Length 3 reverses only the two endpoints, which pillar swap already covers.
        if (length >= 4) {
            for (int start = 0; start < length - 3; start++) {
                for (int end = start + 3; end < length; end++) {
                    addIfPresent(moves, blockMove(segment, reversed(segment, start, end)));
                }
            }
        }
        int maxBlock = Math.min(3, length - 1);
        for (int blockLength = 1; blockLength <= maxBlock; blockLength++) {
            int starts = length - blockLength + 1;
            int insertPositions = length - blockLength + 1;
            for (int blockStart = 0; blockStart < starts; blockStart++) {
                for (int insertAt = 0; insertAt < insertPositions; insertAt++) {
                    if (insertAt == blockStart) {
                        continue;
                    }
                    int[] source = orOpt(segment, blockStart, blockLength, insertAt);
                    if (changedSlots(segment, source) <= 2) {
                        continue;
                    }
                    addIfPresent(moves, blockMove(segment, source));
                }
            }
        }
    }

    private static void addIfPresent(List<SeriesReassignmentMove> moves, SeriesReassignmentMove move) {
        if (move != null) {
            moves.add(move);
        }
    }

    private SeriesReassignmentMove kempeMove(int leftSlot, int rightSlot, Cycle cycle) {
        int size = cycle.leftMatches.length + cycle.rightMatches.length;
        List<Match> moved = new ArrayList<>(size);
        List<Calendar> targets = new ArrayList<>(size);
        Calendar left = calendars[leftSlot];
        Calendar right = calendars[rightSlot];
        for (Match match : cycle.leftMatches) {
            moved.add(match);
            targets.add(right);
        }
        for (Match match : cycle.rightMatches) {
            moved.add(match);
            targets.add(left);
        }
        return new SeriesReassignmentMove("Kempe chain", moved, targets);
    }

    /**
     * {@code source[i]} is the slot whose current series move onto {@code segment[i]}.
     */
    private SeriesReassignmentMove blockMove(int[] segment, int[] source) {
        List<Match> moved = new ArrayList<>();
        List<Calendar> targets = new ArrayList<>();
        for (int index = 0; index < segment.length; index++) {
            int origin = source[index];
            int destination = segment[index];
            if (origin == destination) {
                continue;
            }
            Calendar target = calendars[destination];
            for (int series = 0; series < count[origin]; series++) {
                moved.add(matches[origin][series]);
                targets.add(target);
            }
        }
        if (moved.isEmpty()) {
            return null;
        }
        return new SeriesReassignmentMove("Round block", moved, targets);
    }

    private List<Cycle> cycles(int leftSlot, int rightSlot) {
        if (leftSlot == rightSlot || !movable[leftSlot] || !movable[rightSlot]) {
            return List.of();
        }
        int[] oppLeft = new int[TEAM_COUNT];
        int[] oppRight = new int[TEAM_COUNT];
        Match[] matchLeft = new Match[TEAM_COUNT];
        Match[] matchRight = new Match[TEAM_COUNT];
        for (int team = 0; team < TEAM_COUNT; team++) {
            oppLeft[team] = -1;
            oppRight[team] = -1;
        }
        if (!indexRound(leftSlot, oppLeft, matchLeft) || !indexRound(rightSlot, oppRight, matchRight)) {
            return List.of();
        }
        boolean[] seen = new boolean[TEAM_COUNT];
        List<Cycle> cycles = new ArrayList<>();
        for (int start = 0; start < TEAM_COUNT; start++) {
            if (seen[start]) {
                continue;
            }
            List<Match> leftMatches = new ArrayList<>();
            List<Match> rightMatches = new ArrayList<>();
            int team = start;
            int guard = 0;
            boolean closed = false;
            while (guard <= TEAM_COUNT) {
                if (oppLeft[team] < 0 || (seen[team] && team != start)) {
                    return List.of();
                }
                seen[team] = true;
                int across = oppLeft[team];
                if (seen[across]) {
                    return List.of();
                }
                seen[across] = true;
                leftMatches.add(matchLeft[team]);
                if (oppRight[across] < 0) {
                    return List.of();
                }
                rightMatches.add(matchRight[across]);
                team = oppRight[across];
                guard++;
                if (team == start) {
                    closed = true;
                    break;
                }
            }
            if (!closed) {
                return List.of();
            }
            cycles.add(new Cycle(leftMatches.toArray(Match[]::new), rightMatches.toArray(Match[]::new)));
        }
        return cycles;
    }

    private boolean indexRound(int slot, int[] opponent, Match[] matchOf) {
        if (count[slot] != SERIES_PER_DAY) {
            return false;
        }
        for (int index = 0; index < SERIES_PER_DAY; index++) {
            Match match = matches[slot][index];
            int home = match.getHome().getIndex();
            int away = match.getAway().getIndex();
            if (home < 0 || away < 0 || home >= TEAM_COUNT || away >= TEAM_COUNT || home == away) {
                return false;
            }
            if (opponent[home] >= 0 || opponent[away] >= 0) {
                return false;
            }
            opponent[home] = away;
            opponent[away] = home;
            matchOf[home] = match;
            matchOf[away] = match;
        }
        for (int team = 0; team < TEAM_COUNT; team++) {
            if (opponent[team] < 0) {
                return false;
            }
        }
        return true;
    }

    private static int[] range(int from, int to) {
        int[] slots = new int[to - from + 1];
        for (int index = 0; index < slots.length; index++) {
            slots[index] = from + index;
        }
        return slots;
    }

    static int[] reversed(int[] segment, int start, int end) {
        int[] source = segment.clone();
        while (start < end) {
            int tmp = source[start];
            source[start] = source[end];
            source[end] = tmp;
            start++;
            end--;
        }
        return source;
    }

    /**
     * Removes {@code segment[blockStart .. blockStart + blockLength)} and inserts it at {@code insertAt}
     * in the shortened sequence. {@code insertAt == blockStart} is the identity.
     */
    static int[] orOpt(int[] segment, int blockStart, int blockLength, int insertAt) {
        int length = segment.length;
        int[] block = new int[blockLength];
        System.arraycopy(segment, blockStart, block, 0, blockLength);
        int[] rest = new int[length - blockLength];
        System.arraycopy(segment, 0, rest, 0, blockStart);
        System.arraycopy(segment, blockStart + blockLength, rest, blockStart, length - blockStart - blockLength);
        int[] source = new int[length];
        System.arraycopy(rest, 0, source, 0, insertAt);
        System.arraycopy(block, 0, source, insertAt, blockLength);
        System.arraycopy(rest, insertAt, source, insertAt + blockLength, rest.length - insertAt);
        return source;
    }

    private static int changedSlots(int[] segment, int[] source) {
        int changed = 0;
        for (int index = 0; index < segment.length; index++) {
            if (segment[index] != source[index]) {
                changed++;
            }
        }
        return changed;
    }

    static long blockCandidates(int length) {
        long total = 0L;
        if (length >= 4) {
            total += (long) (length - 3) * (length - 2) / 2L;
        }
        int maxBlock = Math.min(3, length - 1);
        for (int blockLength = 1; blockLength <= maxBlock; blockLength++) {
            int starts = length - blockLength + 1;
            int inserts = length - blockLength;
            total += (long) starts * inserts;
        }
        return total;
    }

    private static SlotFacts facts(Match[] slotMatches, int size, Calendar calendar) {
        if (calendar == null || size != SERIES_PER_DAY) {
            return null;
        }
        int teams = 0;
        int homes = 0;
        int stadiums = 0;
        long pairs = 0L;
        for (int index = 0; index < size; index++) {
            Match match = slotMatches[index];
            if (match.getConsecutive() != calendar.getConsecutive()) {
                return null;
            }
            if (calendar.isChildrenDay()
                    && Constants.HOME_OBLIGATION_CHILDREN.contains(match.getAway().getName())) {
                return null;
            }
            int home = match.getHome().getIndex();
            int away = match.getAway().getIndex();
            if (home < 0 || away < 0 || home >= TEAM_COUNT || away >= TEAM_COUNT || home == away) {
                return null;
            }
            int homeBit = 1 << home;
            int awayBit = 1 << away;
            if ((teams & homeBit) != 0 || (teams & awayBit) != 0) {
                return null;
            }
            teams |= homeBit | awayBit;
            homes |= homeBit;
            int stadium = match.getHome().getStadiumIndex();
            if (stadium < 0 || stadium >= Integer.SIZE) {
                return null;
            }
            stadiums |= 1 << stadium;
            pairs |= 1L << pairIndex(home, away);
        }
        if (teams != FULL_MASK || Integer.bitCount(stadiums) != ScoreFormulas.STADIUMS_PER_DAY) {
            return null;
        }
        return new SlotFacts(homes, pairs);
    }

    private static int pairIndex(int left, int right) {
        int high = Math.max(left, right);
        int low = Math.min(left, right);
        return high * (high - 1) / 2 + low;
    }

    private record Cycle(Match[] leftMatches, Match[] rightMatches) {

        boolean changesHomeAway() {
            boolean[] used = new boolean[rightMatches.length];
            for (Match left : leftMatches) {
                boolean found = false;
                for (int index = 0; index < rightMatches.length; index++) {
                    if (used[index]) {
                        continue;
                    }
                    Match right = rightMatches[index];
                    if (left.getHome().getIndex() == right.getHome().getIndex()
                            && left.getAway().getIndex() == right.getAway().getIndex()) {
                        used[index] = true;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    return true;
                }
            }
            return false;
        }
    }

    private record SlotFacts(int homeMask, long pairMask) {
    }
}
