package org.optaplanner.examples.baseball.solver;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Constants;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.Team;
import org.optaplanner.examples.baseball.score.ScoreFormulas;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Builds a fully assigned feasible schedule from teams, calendars, and matches.
 * {@code initialPlan} is not read. Match list order is ignored: series are bucketed by
 * consecutive length, home index, away index, and id.
 * <p>
 * Opening day and Children's Day are pinned only after every regular slot is assigned.
 * The finished solution has hard scores 0/0 and no unassigned series.
 */
public final class BaseballSolutionInitializer {

    private static final Logger LOGGER = LoggerFactory.getLogger(BaseballSolutionInitializer.class);
    private static final int TEAM_COUNT = ScoreFormulas.TEAMS_PER_DAY;
    private static final int SERIES_PER_DAY = ScoreFormulas.SERIES_PER_DAY;
    private static final int FULL_MASK = (1 << TEAM_COUNT) - 1;
    private static final int MAX_CONSECUTIVE = 4;
    private static final int CHILD_PERMUTATIONS = 120;
    private static final int DECOMPOSE_NODE_LIMIT = 4_000;
    private static final int PLACE_NODE_LIMIT = 5_000;
    private static final Comparator<Match> CANONICAL = Comparator
            .comparingInt(Match::getConsecutive)
            .thenComparingInt(match -> match.getHome().getIndex())
            .thenComparingInt(match -> match.getAway().getIndex())
            .thenComparingLong(match -> match.getId());

    private BaseballSolutionInitializer() {
    }

    public static void initialize(BaseballSolution solution) {
        initialize(solution, 0L);
    }

    /**
     * @param seed selects the first Children's Day matching to try. The next matchings are tried,
     *        in permutation order, when decomposition or slot placement exceeds its node limit.
     */
    public static void initialize(BaseballSolution solution, long seed) {
        if (solution == null) {
            throw new IllegalArgumentException("solution is null");
        }
        List<Team> teams = solution.getTeamList();
        List<Calendar> calendars = solution.getCalendarList();
        List<Match> matches = solution.getMatchList();
        if (teams == null || calendars == null || matches == null) {
            throw new IllegalArgumentException("solution is missing teams, calendars, or matches");
        }
        if (teams.size() != TEAM_COUNT) {
            throw new IllegalStateException("expected " + TEAM_COUNT + " teams but found " + teams.size());
        }
        for (Team team : teams) {
            if (!team.isIndexPrepared() || team.getIndex() < 0 || team.getIndex() >= TEAM_COUNT) {
                throw new IllegalStateException("Team index is not prepared: " + team.getName());
            }
        }

        Team[] teamByIndex = new Team[TEAM_COUNT];
        for (Team team : teams) {
            if (teamByIndex[team.getIndex()] != null) {
                throw new IllegalStateException("duplicate team index: " + team.getIndex());
            }
            teamByIndex[team.getIndex()] = team;
        }
        boolean[] jamsil = sharedStadiumTeams(teams);
        int[] childHomes = obligationHomes(teams);
        int[] childAways = obligationAways(teams, childHomes);
        requireOneSharedStadiumHome(jamsil, childHomes);

        Calendar[] bySlot = calendarsBySlot(calendars);
        int slotCount = bySlot.length;
        Calendar opening = null;
        Calendar fourGame = null;
        Calendar children = null;
        int threeSlots = 0;
        for (int slot = 0; slot < slotCount; slot++) {
            Calendar calendar = bySlot[slot];
            if (calendar.isChildrenDay()) {
                if (children != null) {
                    throw new IllegalStateException("more than one Children's Day slot");
                }
                children = calendar;
            }
            switch (calendar.getConsecutive()) {
                case 2 -> {
                    if (opening != null) {
                        throw new IllegalStateException("more than one 2-game slot");
                    }
                    opening = calendar;
                }
                case 3 -> threeSlots++;
                case 4 -> {
                    if (fourGame != null) {
                        throw new IllegalStateException("more than one 4-game slot");
                    }
                    fourGame = calendar;
                }
                default -> throw new IllegalStateException(
                        "unsupported series length " + calendar.getConsecutive() + " at slot " + slot);
            }
        }
        if (opening == null || fourGame == null || children == null || children.getConsecutive() != 3) {
            throw new IllegalStateException("calendar is missing the 2-game, 4-game, or Children's Day slot");
        }
        int roundCount = threeSlots - 1;
        if (roundCount <= 0) {
            throw new IllegalStateException("no 3-game rounds left after Children's Day");
        }

        Deque<Match>[][][] buckets = bucketMatches(matches);
        int[][] baseRemaining = remainingCounts(buckets);
        requireRegularGraph(baseRemaining, jamsil, threeSlots);

        Round openingRound = roundFromMatches(listBucket(buckets, 2), teamByIndex, jamsil, false);
        Round fourRound = roundFromMatches(listBucket(buckets, 4), teamByIndex, jamsil, false);
        if (openingRound.edges.length != SERIES_PER_DAY || fourRound.edges.length != SERIES_PER_DAY) {
            throw new IllegalStateException("2-game and 4-game series must each form one round of " + SERIES_PER_DAY);
        }

        int start = Math.floorMod(seed, CHILD_PERMUTATIONS);
        Round[] placed = null;
        int usedPerm = -1;
        for (int offset = 0; offset < CHILD_PERMUTATIONS; offset++) {
            int permIndex = (start + offset) % CHILD_PERMUTATIONS;
            Round[] schedule = attempt(baseRemaining, childHomes, childAways, permIndex, jamsil, teamByIndex,
                    bySlot, opening, fourGame, children, openingRound, fourRound, roundCount);
            if (schedule != null) {
                placed = schedule;
                usedPerm = permIndex;
                break;
            }
        }
        if (placed == null) {
            throw new IllegalStateException(
                    "No feasible initial solution within " + CHILD_PERMUTATIONS + " seeds starting at " + seed);
        }

        assign(buckets, bySlot, placed);
        pin(matches, opening, children);
        requireBucketsEmpty(buckets);

        BendableLongScore score = ScoreFormulas.evaluate(teams, calendars, matches);
        if (score.hardScore(0) != 0L || score.hardScore(1) != 0L || score.softScore(0) != 0L) {
            throw new IllegalStateException("constructed initial solution is not feasible: " + score);
        }
        LOGGER.info("Constructed initial solution from seed {} using children's matching {} with score {}",
                seed, usedPerm, score);
    }

    private static Round[] attempt(int[][] baseRemaining, int[] childHomes, int[] childAways, int permIndex,
            boolean[] jamsil, Team[] teamByIndex, Calendar[] bySlot, Calendar opening, Calendar fourGame,
            Calendar children, Round openingRound, Round fourRound, int roundCount) {
        int[][] remaining = copy(baseRemaining);
        int[] awayPerm = nthPermutation(childAways, permIndex);
        int[] childEdges = new int[SERIES_PER_DAY];
        for (int i = 0; i < SERIES_PER_DAY; i++) {
            int home = childHomes[i];
            int away = awayPerm[i];
            if (remaining[home][away] <= 0) {
                return null;
            }
            remaining[home][away]--;
            childEdges[i] = pack(home, away);
        }
        Round childRound = toRound(childEdges, teamByIndex, jamsil, true);

        List<Round> rounds = new ArrayList<>(roundCount);
        int[] nodes = {0};
        if (!decompose(remaining, jamsil, teamByIndex, rounds, roundCount, nodes)) {
            return null;
        }
        for (int home = 0; home < TEAM_COUNT; home++) {
            for (int away = 0; away < TEAM_COUNT; away++) {
                if (remaining[home][away] != 0) {
                    return null;
                }
            }
        }

        Round[] fixed = new Round[bySlot.length];
        fixed[opening.getSlotIndex()] = openingRound;
        fixed[fourGame.getSlotIndex()] = fourRound;
        fixed[children.getSlotIndex()] = childRound;
        return place(fixed, rounds, bySlot);
    }

    private static boolean decompose(int[][] remaining, boolean[] jamsil, Team[] teamByIndex, List<Round> rounds,
            int roundCount, int[] nodes) {
        if (rounds.size() == roundCount) {
            return true;
        }
        for (int edge : jamsilCandidates(remaining, jamsil)) {
            nodes[0]++;
            if (nodes[0] > DECOMPOSE_NODE_LIMIT) {
                return false;
            }
            int home = unpackHome(edge);
            int away = unpackAway(edge);
            remaining[home][away]--;
            int[] edges = new int[SERIES_PER_DAY];
            edges[0] = edge;
            int used = bit(home) | bit(away);
            if (completeRound(remaining, jamsil, used, edges, 1, nodes)) {
                rounds.add(toRound(edges, teamByIndex, jamsil, true));
                if (decompose(remaining, jamsil, teamByIndex, rounds, roundCount, nodes)) {
                    return true;
                }
                rounds.remove(rounds.size() - 1);
                restore(remaining, edges);
            } else {
                remaining[home][away]++;
            }
        }
        return false;
    }

    private static boolean completeRound(int[][] remaining, boolean[] jamsil, int used, int[] edges, int count,
            int[] nodes) {
        nodes[0]++;
        if (nodes[0] > DECOMPOSE_NODE_LIMIT) {
            return false;
        }
        if (count == SERIES_PER_DAY) {
            return true;
        }
        int pivot = lowestUnset(used);
        for (int edge : edgeCandidates(remaining, jamsil, pivot, used)) {
            int home = unpackHome(edge);
            int away = unpackAway(edge);
            remaining[home][away]--;
            edges[count] = edge;
            if (completeRound(remaining, jamsil, used | bit(home) | bit(away), edges, count + 1, nodes)) {
                return true;
            }
            remaining[home][away]++;
        }
        return false;
    }

    private static Round[] place(Round[] fixed, List<Round> rounds, Calendar[] bySlot) {
        int slotCount = bySlot.length;
        boolean[] filled = new boolean[slotCount];
        Round[] schedule = new Round[slotCount];
        int[] empty = new int[rounds.size()];
        int emptyCount = 0;
        for (int slot = 0; slot < slotCount; slot++) {
            if (fixed[slot] != null) {
                filled[slot] = true;
                schedule[slot] = fixed[slot];
            } else {
                if (bySlot[slot].getConsecutive() != 3) {
                    throw new IllegalStateException("unfilled slot " + slot + " is not a 3-game slot");
                }
                empty[emptyCount++] = slot;
            }
        }
        if (emptyCount != rounds.size()) {
            throw new IllegalStateException("round count " + rounds.size() + " does not match empty slots " + emptyCount);
        }
        boolean[] used = new boolean[rounds.size()];
        int[] nodes = {0};
        if (!placeAt(0, empty, rounds, used, filled, schedule, nodes)) {
            return null;
        }
        return schedule;
    }

    private static boolean placeAt(int index, int[] empty, List<Round> rounds, boolean[] used, boolean[] filled,
            Round[] schedule, int[] nodes) {
        nodes[0]++;
        if (nodes[0] > PLACE_NODE_LIMIT) {
            return false;
        }
        if (index == empty.length) {
            return true;
        }
        int slot = empty[index];
        int roundCount = rounds.size();
        for (int i = 0; i < roundCount; i++) {
            if (used[i]) {
                continue;
            }
            Round round = rounds.get(i);
            if (!fits(slot, round, filled, schedule)) {
                continue;
            }
            used[i] = true;
            filled[slot] = true;
            schedule[slot] = round;
            if (placeAt(index + 1, empty, rounds, used, filled, schedule, nodes)) {
                return true;
            }
            schedule[slot] = null;
            filled[slot] = false;
            used[i] = false;
            if (nodes[0] > PLACE_NODE_LIMIT) {
                return false;
            }
        }
        return false;
    }

    /**
     * Rejects a round that repeats an unordered pair on either neighboring slot, or that would
     * make some team home or away for four slot indexes in a row. Slot index order matches
     * {@code ScoreFormulas}, including across date gaps such as the all-star break.
     */
    private static boolean fits(int slot, Round round, boolean[] filled, Round[] schedule) {
        if (overlapsNeighbor(slot - 1, round, filled, schedule) || overlapsNeighbor(slot + 1, round, filled, schedule)) {
            return false;
        }
        int lastWindow = schedule.length - 4;
        int windowStart = Math.max(0, slot - 3);
        int windowEnd = Math.min(lastWindow, slot);
        for (int window = windowStart; window <= windowEnd; window++) {
            if (!windowReady(window, slot, filled)) {
                continue;
            }
            int m0 = maskAt(window, slot, round, schedule);
            int m1 = maskAt(window + 1, slot, round, schedule);
            int m2 = maskAt(window + 2, slot, round, schedule);
            int m3 = maskAt(window + 3, slot, round, schedule);
            if ((m0 & m1 & m2 & m3) != 0) {
                return false;
            }
            if (((~m0 & ~m1 & ~m2 & ~m3) & FULL_MASK) != 0) {
                return false;
            }
        }
        return true;
    }

    private static boolean overlapsNeighbor(int neighbor, Round round, boolean[] filled, Round[] schedule) {
        return neighbor >= 0 && neighbor < schedule.length && filled[neighbor]
                && (schedule[neighbor].pairMask & round.pairMask) != 0L;
    }

    private static boolean windowReady(int window, int slot, boolean[] filled) {
        for (int offset = 0; offset < 4; offset++) {
            int index = window + offset;
            if (index != slot && !filled[index]) {
                return false;
            }
        }
        return true;
    }

    private static int maskAt(int index, int slot, Round round, Round[] schedule) {
        if (index == slot) {
            return round.homeMask;
        }
        return schedule[index].homeMask;
    }

    private static void assign(Deque<Match>[][][] buckets, Calendar[] bySlot, Round[] schedule) {
        for (int slot = 0; slot < schedule.length; slot++) {
            Round round = schedule[slot];
            Calendar calendar = bySlot[slot];
            for (int edge : round.edges) {
                Deque<Match> bucket = buckets[calendar.getConsecutive()][unpackHome(edge)][unpackAway(edge)];
                if (bucket == null || bucket.isEmpty()) {
                    throw new IllegalStateException("missing series for slot " + slot + " edge " + edge);
                }
                Match match = bucket.removeFirst();
                match.setCalendar(calendar);
            }
        }
    }

    private static void pin(List<Match> matches, Calendar opening, Calendar children) {
        for (Match match : matches) {
            Calendar calendar = match.getCalendar();
            match.setPinned(calendar == opening || calendar == children);
        }
    }

    private static Deque<Match>[][][] bucketMatches(List<Match> matches) {
        List<Match> ordered = new ArrayList<>(matches);
        ordered.sort(CANONICAL);
        Deque<Match>[][][] buckets = newBuckets();
        for (Match match : ordered) {
            match.setCalendar(null);
            match.setPinned(false);
            int consecutive = match.getConsecutive();
            int home = match.getHome().getIndex();
            int away = match.getAway().getIndex();
            if (consecutive < 2 || consecutive > MAX_CONSECUTIVE || home == away
                    || home < 0 || away < 0 || home >= TEAM_COUNT || away >= TEAM_COUNT) {
                throw new IllegalStateException("invalid series " + match);
            }
            Deque<Match> bucket = buckets[consecutive][home][away];
            if (bucket == null) {
                bucket = new ArrayDeque<>();
                buckets[consecutive][home][away] = bucket;
            }
            bucket.addLast(match);
        }
        return buckets;
    }

    private static int[][] remainingCounts(Deque<Match>[][][] buckets) {
        int[][] remaining = new int[TEAM_COUNT][TEAM_COUNT];
        for (int home = 0; home < TEAM_COUNT; home++) {
            for (int away = 0; away < TEAM_COUNT; away++) {
                Deque<Match> bucket = buckets[3][home][away];
                remaining[home][away] = bucket == null ? 0 : bucket.size();
            }
        }
        return remaining;
    }

    private static void requireRegularGraph(int[][] remaining, boolean[] jamsil, int threeSlots) {
        int jamsilHomes = 0;
        int series = 0;
        int[] degree = new int[TEAM_COUNT];
        for (int home = 0; home < TEAM_COUNT; home++) {
            for (int away = 0; away < TEAM_COUNT; away++) {
                int count = remaining[home][away];
                series += count;
                degree[home] += count;
                degree[away] += count;
                if (jamsil[home]) {
                    jamsilHomes += count;
                }
            }
        }
        if (series != threeSlots * SERIES_PER_DAY) {
            throw new IllegalStateException("3-game series count " + series + " does not match slots " + threeSlots);
        }
        // Every 3-game slot needs exactly one shared-stadium home, so those homes equal the slot count.
        if (jamsilHomes != threeSlots) {
            throw new IllegalStateException("shared-stadium home series " + jamsilHomes + " != 3-game slots " + threeSlots);
        }
        for (int team = 0; team < TEAM_COUNT; team++) {
            if (degree[team] != threeSlots) {
                throw new IllegalStateException("team " + team + " plays " + degree[team] + " 3-game series");
            }
        }
    }

    private static Round roundFromMatches(List<Match> matches, Team[] teamByIndex, boolean[] jamsil,
            boolean requireOneJamsilHome) {
        int[] edges = new int[matches.size()];
        for (int i = 0; i < matches.size(); i++) {
            Match match = matches.get(i);
            edges[i] = pack(match.getHome().getIndex(), match.getAway().getIndex());
        }
        return toRound(edges, teamByIndex, jamsil, requireOneJamsilHome);
    }

    private static Round toRound(int[] edges, Team[] teamByIndex, boolean[] jamsil, boolean requireOneJamsilHome) {
        int homeMask = 0;
        int teamMask = 0;
        int stadiumMask = 0;
        long pairMask = 0L;
        int jamsilHomes = 0;
        for (int edge : edges) {
            int home = unpackHome(edge);
            int away = unpackAway(edge);
            int homeBit = bit(home);
            int awayBit = bit(away);
            if ((teamMask & homeBit) != 0 || (teamMask & awayBit) != 0) {
                throw new IllegalStateException("round repeats a team");
            }
            teamMask |= homeBit | awayBit;
            homeMask |= homeBit;
            stadiumMask |= bit(teamByIndex[home].getStadiumIndex());
            pairMask |= pairBit(home, away);
            if (jamsil[home]) {
                jamsilHomes++;
            }
        }
        if (edges.length != SERIES_PER_DAY || teamMask != FULL_MASK || Long.bitCount(pairMask) != SERIES_PER_DAY
                || Integer.bitCount(homeMask) != SERIES_PER_DAY
                || Integer.bitCount(stadiumMask) != ScoreFormulas.STADIUMS_PER_DAY) {
            throw new IllegalStateException("round is not a 5-series perfect matching");
        }
        if (requireOneJamsilHome && jamsilHomes != 1) {
            throw new IllegalStateException("3-game round must contain exactly one shared-stadium home");
        }
        return new Round(homeMask, pairMask, edges.clone());
    }

    private static List<Match> listBucket(Deque<Match>[][][] buckets, int consecutive) {
        List<Match> matches = new ArrayList<>();
        for (int home = 0; home < TEAM_COUNT; home++) {
            for (int away = 0; away < TEAM_COUNT; away++) {
                Deque<Match> bucket = buckets[consecutive][home][away];
                if (bucket != null) {
                    matches.addAll(bucket);
                }
            }
        }
        return matches;
    }

    private static void requireBucketsEmpty(Deque<Match>[][][] buckets) {
        for (int consecutive = 2; consecutive <= MAX_CONSECUTIVE; consecutive++) {
            for (int home = 0; home < TEAM_COUNT; home++) {
                for (int away = 0; away < TEAM_COUNT; away++) {
                    Deque<Match> bucket = buckets[consecutive][home][away];
                    if (bucket != null && !bucket.isEmpty()) {
                        throw new IllegalStateException("unassigned series remain at length " + consecutive);
                    }
                }
            }
        }
    }

    private static boolean[] sharedStadiumTeams(List<Team> teams) {
        Map<String, List<Team>> byStadium = new HashMap<>();
        for (Team team : teams) {
            byStadium.computeIfAbsent(team.getStadium(), key -> new ArrayList<>()).add(team);
        }
        boolean[] jamsil = new boolean[TEAM_COUNT];
        int sharedGroups = 0;
        for (List<Team> group : byStadium.values()) {
            if (group.size() <= 1) {
                continue;
            }
            sharedGroups++;
            if (group.size() != 2) {
                throw new IllegalStateException("shared stadium " + group.get(0).getStadium() + " has " + group.size() + " teams");
            }
            jamsil[group.get(0).getIndex()] = true;
            jamsil[group.get(1).getIndex()] = true;
        }
        if (sharedGroups != 1) {
            throw new IllegalStateException("expected one shared stadium but found " + sharedGroups);
        }
        return jamsil;
    }

    private static int[] obligationHomes(List<Team> teams) {
        List<Integer> homes = new ArrayList<>();
        for (Team team : teams) {
            if (Constants.HOME_OBLIGATION_CHILDREN.contains(team.getName())) {
                homes.add(team.getIndex());
            }
        }
        if (homes.size() != SERIES_PER_DAY) {
            throw new IllegalStateException("Children's Day home obligation is not " + SERIES_PER_DAY + " teams");
        }
        homes.sort(Integer::compareTo);
        return toArray(homes);
    }

    private static int[] obligationAways(List<Team> teams, int[] childHomes) {
        boolean[] home = new boolean[TEAM_COUNT];
        for (int index : childHomes) {
            home[index] = true;
        }
        List<Integer> aways = new ArrayList<>();
        for (Team team : teams) {
            if (!home[team.getIndex()]) {
                aways.add(team.getIndex());
            }
        }
        if (aways.size() != SERIES_PER_DAY) {
            throw new IllegalStateException("Children's Day away group is not " + SERIES_PER_DAY + " teams");
        }
        aways.sort(Integer::compareTo);
        return toArray(aways);
    }

    private static void requireOneSharedStadiumHome(boolean[] jamsil, int[] childHomes) {
        int count = 0;
        for (int home : childHomes) {
            if (jamsil[home]) {
                count++;
            }
        }
        if (count != 1) {
            throw new IllegalStateException("Children's Day homes must include exactly one shared-stadium team");
        }
    }

    private static Calendar[] calendarsBySlot(List<Calendar> calendars) {
        int slotCount = 0;
        for (Calendar calendar : calendars) {
            if (calendar != null && calendar.isRegular()) {
                slotCount = Math.max(slotCount, calendar.getSlotIndex() + 1);
            }
        }
        if (slotCount == 0) {
            throw new IllegalStateException("no regular calendar slots");
        }
        Calendar[] bySlot = new Calendar[slotCount];
        int regular = 0;
        for (Calendar calendar : calendars) {
            if (calendar == null || !calendar.isRegular()) {
                continue;
            }
            int slot = calendar.getSlotIndex();
            if (slot < 0 || slot >= slotCount || bySlot[slot] != null) {
                throw new IllegalStateException("regular slots are not a dense 0..n-1 index");
            }
            bySlot[slot] = calendar;
            regular++;
        }
        if (regular != slotCount) {
            throw new IllegalStateException("regular slots have a hole");
        }
        for (int slot = 0; slot < slotCount; slot++) {
            Calendar calendar = bySlot[slot];
            Calendar previous = calendar.getPrev();
            if (slot == 0) {
                if (previous != null && previous.isRegular()) {
                    throw new IllegalStateException("slot 0 has a regular predecessor");
                }
            } else if (previous != bySlot[slot - 1]) {
                throw new IllegalStateException("slot " + slot + " prev is not slot " + (slot - 1));
            }
        }
        return bySlot;
    }

    private static List<Integer> jamsilCandidates(int[][] remaining, boolean[] jamsil) {
        List<Integer> candidates = new ArrayList<>();
        for (int home = 0; home < TEAM_COUNT; home++) {
            if (!jamsil[home]) {
                continue;
            }
            for (int away = 0; away < TEAM_COUNT; away++) {
                if (away != home && remaining[home][away] > 0) {
                    candidates.add(pack(home, away));
                }
            }
        }
        candidates.sort(edgeOrder(remaining));
        return candidates;
    }

    private static List<Integer> edgeCandidates(int[][] remaining, boolean[] jamsil, int pivot, int used) {
        List<Integer> candidates = new ArrayList<>();
        for (int other = 0; other < TEAM_COUNT; other++) {
            if (other == pivot || (used & bit(other)) != 0) {
                continue;
            }
            if (!jamsil[pivot] && remaining[pivot][other] > 0) {
                candidates.add(pack(pivot, other));
            }
            if (!jamsil[other] && remaining[other][pivot] > 0) {
                candidates.add(pack(other, pivot));
            }
        }
        candidates.sort(edgeOrder(remaining));
        return candidates;
    }

    private static Comparator<Integer> edgeOrder(int[][] remaining) {
        return Comparator
                .comparingInt((Integer edge) -> -remaining[unpackHome(edge)][unpackAway(edge)])
                .thenComparingInt(BaseballSolutionInitializer::unpackHome)
                .thenComparingInt(BaseballSolutionInitializer::unpackAway);
    }

    private static int lowestUnset(int used) {
        for (int team = 0; team < TEAM_COUNT; team++) {
            if ((used & bit(team)) == 0) {
                return team;
            }
        }
        throw new IllegalStateException("every team is already matched");
    }

    private static int[] nthPermutation(int[] source, int index) {
        int[] items = source.clone();
        int[] result = new int[source.length];
        int active = source.length;
        for (int pos = 0; pos < source.length; pos++) {
            int fact = factorial(active - 1);
            int pick = index / fact;
            index %= fact;
            result[pos] = items[pick];
            System.arraycopy(items, pick + 1, items, pick, active - pick - 1);
            active--;
        }
        return result;
    }

    private static int factorial(int value) {
        int fact = 1;
        for (int i = 2; i <= value; i++) {
            fact *= i;
        }
        return fact;
    }

    private static void restore(int[][] remaining, int[] edges) {
        for (int edge : edges) {
            remaining[unpackHome(edge)][unpackAway(edge)]++;
        }
    }

    private static int[][] copy(int[][] remaining) {
        int[][] copied = new int[TEAM_COUNT][TEAM_COUNT];
        for (int home = 0; home < TEAM_COUNT; home++) {
            System.arraycopy(remaining[home], 0, copied[home], 0, TEAM_COUNT);
        }
        return copied;
    }

    private static int[] toArray(List<Integer> values) {
        int[] array = new int[values.size()];
        for (int i = 0; i < values.size(); i++) {
            array[i] = values.get(i);
        }
        return array;
    }

    private static int bit(int index) {
        return 1 << index;
    }

    private static int pack(int home, int away) {
        return home * TEAM_COUNT + away;
    }

    private static int unpackHome(int edge) {
        return edge / TEAM_COUNT;
    }

    private static int unpackAway(int edge) {
        return edge % TEAM_COUNT;
    }

    private static int pairIndex(int left, int right) {
        int low = Math.min(left, right);
        int high = Math.max(left, right);
        return low * (TEAM_COUNT - 1) - low * (low - 1) / 2 + (high - low - 1);
    }

    private static long pairBit(int left, int right) {
        return 1L << pairIndex(left, right);
    }

    @SuppressWarnings("unchecked")
    private static Deque<Match>[][][] newBuckets() {
        return new Deque[MAX_CONSECUTIVE + 1][TEAM_COUNT][TEAM_COUNT];
    }

    private record Round(int homeMask, long pairMask, int[] edges) {
    }
}
