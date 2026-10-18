package org.optaplanner.examples.baseball.solver;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;
import java.util.stream.IntStream;
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
 * Construction is a GRASP multi-start. Each start runs three steps:
 * <ol>
 * <li>Phase A decomposes the 3-game series into perfect matchings (rounds) with exactly one
 * shared-stadium home each. Edges with the same remaining multiplicity are tried in random order.</li>
 * <li>Phase B orders the rounds over the free 3-game slots with a weighted nearest-neighbour DFS.
 * The transition cost is {@code sum_t w_t * d(loc_t(r), loc_t(r'))}. After each construction a
 * Lagrangian update raises {@code w_t} for teams that travel more than the league mean and lowers
 * it for teams that travel less.</li>
 * <li>A late-acceptance local search applies swap, Or-opt insertion, and 2-opt reversal moves over
 * the free slots. Each candidate must pass the adjacent-matchup and four-in-a-row bitmask checks.
 * Candidates are compared on soft levels 1..4 of {@link ScoreFormulas} in score order, so a shorter
 * total distance can never be bought with a worse distance-variance penalty.</li>
 * </ol>
 * The best start wins. A start depends only on {@code (seed, start index)}, so the result is
 * deterministic even when starts run in parallel.
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
    private static final int PLACE_NODE_LIMIT = 20_000;
    private static final int ATTEMPTS_PER_START = 40;
    private static final int MULTIPLICITY_CEILING = 64;
    /** GRASP noise: a candidate's weighted cost is scaled by a random factor in [1, 1 + noise). */
    private static final double CONSTRUCTION_NOISE = 0.15;
    /** Lagrangian step per tolerance unit (300 km) of deviation from the league mean. */
    private static final double LAGRANGE_STEP = 0.35;
    private static final double MIN_WEIGHT = 0.25;
    private static final double MAX_WEIGHT = 4.0;
    private static final Comparator<Match> CANONICAL = Comparator
            .comparingInt(Match::getConsecutive)
            .thenComparingInt(match -> match.getHome().getIndex())
            .thenComparingInt(match -> match.getAway().getIndex())
            .thenComparingLong(match -> match.getId());

    /**
     * Search budget. Every limit is a count, never a wall-clock time, so a given seed always
     * produces the same schedule.
     *
     * @param starts independent GRASP starts
     * @param lagrangeRounds weighted constructions per start. Team weights are updated between them
     * @param improveIterations late-acceptance iterations per start
     * @param lateAcceptanceSize late-acceptance history length
     * @param parallel run starts on the common fork-join pool
     */
    public record Settings(int starts, int lagrangeRounds, int improveIterations, int lateAcceptanceSize,
            boolean parallel) {

        public static final Settings DEFAULT = new Settings(80, 8, 60_000, 300, true);

        public Settings {
            if (starts <= 0 || lagrangeRounds <= 0 || improveIterations < 0 || lateAcceptanceSize <= 0) {
                throw new IllegalArgumentException("invalid initializer settings");
            }
        }
    }

    private BaseballSolutionInitializer() {
    }

    public static void initialize(BaseballSolution solution) {
        initialize(solution, 0L);
    }

    /**
     * @param seed master seed. Start {@code k} draws its Children's Day matchings, Phase A tie-breaks,
     *        construction noise, and local-search moves from a generator seeded by {@code (seed, k)}.
     */
    public static void initialize(BaseballSolution solution, long seed) {
        initialize(solution, seed, Settings.DEFAULT);
    }

    public static void initialize(BaseballSolution solution, long seed, Settings settings) {
        if (solution == null) {
            throw new IllegalArgumentException("solution is null");
        }
        if (settings == null) {
            throw new IllegalArgumentException("settings is null");
        }
        long startNanos = System.nanoTime();
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

        Problem problem = new Problem(teamByIndex, jamsil, childHomes, childAways, bySlot, opening.getSlotIndex(),
                fourGame.getSlotIndex(), children.getSlotIndex(), baseRemaining, openingRound, fourRound, roundCount);

        IntStream startIndexes = IntStream.range(0, settings.starts());
        if (settings.parallel()) {
            startIndexes = startIndexes.parallel();
        }
        Candidate[] results = startIndexes
                .mapToObj(start -> runStart(problem, seed, start, settings))
                .toArray(Candidate[]::new);
        Candidate best = null;
        int feasibleStarts = 0;
        for (Candidate candidate : results) {
            if (candidate == null) {
                continue;
            }
            feasibleStarts++;
            if (best == null || candidate.isBetterThan(best)) {
                best = candidate;
            }
        }
        if (best == null) {
            throw new IllegalStateException(
                    "No feasible initial solution within " + settings.starts() + " starts from seed " + seed);
        }

        assign(buckets, bySlot, best.schedule);
        pin(matches, opening, children);
        requireBucketsEmpty(buckets);

        BendableLongScore score = ScoreFormulas.evaluate(teams, calendars, matches);
        if (score.hardScore(0) != 0L || score.hardScore(1) != 0L || score.softScore(0) != 0L) {
            throw new IllegalStateException("constructed initial solution is not feasible: " + score);
        }
        for (int level = 1; level < ScoreFormulas.SOFT_LEVELS; level++) {
            if (-score.softScore(level) != best.soft[level - 1]) {
                throw new IllegalStateException("initializer soft " + level + " = " + best.soft[level - 1]
                        + " disagrees with ScoreFormulas: " + score);
            }
        }
        LOGGER.info("Constructed initial solution from seed {} in {} ms: {} of {} starts feasible, best start {} "
                + "(children's matching {}), score {}", seed, (System.nanoTime() - startNanos) / 1_000_000L,
                feasibleStarts, settings.starts(), best.start, best.childPermutation, score);
    }

    // ************************************************************************
    // One GRASP start
    // ************************************************************************

    private static Candidate runStart(Problem problem, long seed, int start, Settings settings) {
        SplittableRandom random = new SplittableRandom(mix(seed, start));
        for (int attempt = 0; attempt < ATTEMPTS_PER_START; attempt++) {
            int permIndex = random.nextInt(CHILD_PERMUTATIONS);
            Round[] rounds = decomposeAttempt(problem, permIndex, random);
            if (rounds == null) {
                continue;
            }
            Sequencer sequencer = new Sequencer(problem, rounds);
            int[] perm = sequencer.lagrangianConstruction(settings.lagrangeRounds(), random);
            if (perm == null) {
                continue;
            }
            perm = sequencer.improve(perm, settings.improveIterations(), settings.lateAcceptanceSize(), random);
            sequencer.evaluate(perm);
            return new Candidate(start, permIndex, sequencer.schedule(perm), sequencer.key1, sequencer.key2,
                    sequencer.softLevels());
        }
        return null;
    }

    /**
     * @return the 3-game rounds ({@code roundCount} free rounds followed by the Children's Day round),
     *         or null when this matching or the decomposition fails
     */
    private static Round[] decomposeAttempt(Problem problem, int permIndex, SplittableRandom random) {
        int[][] remaining = copy(problem.baseRemaining);
        int[] awayPerm = nthPermutation(problem.childAways, permIndex);
        int[] childEdges = new int[SERIES_PER_DAY];
        for (int i = 0; i < SERIES_PER_DAY; i++) {
            int home = problem.childHomes[i];
            int away = awayPerm[i];
            if (remaining[home][away] <= 0) {
                return null;
            }
            remaining[home][away]--;
            childEdges[i] = pack(home, away);
        }
        Round childRound = toRound(childEdges, problem.teamByIndex, problem.jamsil, true);

        List<Round> rounds = new ArrayList<>(problem.roundCount);
        int[] nodes = {0};
        if (!decompose(remaining, problem.jamsil, problem.teamByIndex, rounds, problem.roundCount, nodes, random)) {
            return null;
        }
        for (int home = 0; home < TEAM_COUNT; home++) {
            for (int away = 0; away < TEAM_COUNT; away++) {
                if (remaining[home][away] != 0) {
                    return null;
                }
            }
        }
        Round[] result = rounds.toArray(new Round[problem.roundCount + 1]);
        result[problem.roundCount] = childRound;
        return result;
    }

    private static boolean decompose(int[][] remaining, boolean[] jamsil, Team[] teamByIndex, List<Round> rounds,
            int roundCount, int[] nodes, SplittableRandom random) {
        if (rounds.size() == roundCount) {
            return true;
        }
        for (int edge : jamsilCandidates(remaining, jamsil, random)) {
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
            if (completeRound(remaining, jamsil, used, edges, 1, nodes, random)) {
                rounds.add(toRound(edges, teamByIndex, jamsil, true));
                if (decompose(remaining, jamsil, teamByIndex, rounds, roundCount, nodes, random)) {
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
            int[] nodes, SplittableRandom random) {
        nodes[0]++;
        if (nodes[0] > DECOMPOSE_NODE_LIMIT) {
            return false;
        }
        if (count == SERIES_PER_DAY) {
            return true;
        }
        int pivot = lowestUnset(used);
        for (int edge : edgeCandidates(remaining, jamsil, pivot, used, random)) {
            int home = unpackHome(edge);
            int away = unpackAway(edge);
            remaining[home][away]--;
            edges[count] = edge;
            if (completeRound(remaining, jamsil, used | bit(home) | bit(away), edges, count + 1, nodes, random)) {
                return true;
            }
            remaining[home][away]++;
        }
        return false;
    }

    // ************************************************************************
    // Phase B: distance- and variance-aware sequencing
    // ************************************************************************

    /**
     * Orders one start's rounds over the slots. Round ids {@code 0..roundCount-1} are free,
     * {@code roundCount} is Children's Day, then opening and the 4-game round. A permutation
     * {@code perm[p]} is the round in free slot {@code freeSlots[p]}.
     */
    private static final class Sequencer {
        private final Problem problem;
        private final Round[] rounds;
        private final int roundTotal;
        private final int slotCount;
        private final int[] freeSlots;
        private final int[] homeMask;
        private final long[] pairMask;
        /** {@code legs[(from * roundTotal + to) * TEAM_COUNT + team]} in tenths of a kilometre. */
        private final long[] legs;
        private final double[] weightedCost;
        /** Fixed slots only; free slots are -1. */
        private final int[] template;
        /** Evaluation buffer: fixed slots plus the permutation last written by {@link #fill}. */
        private final int[] seq;
        private final long[] distance = new long[TEAM_COUNT];
        private final long[] moves = new long[TEAM_COUNT];
        private final long[] holiday = new long[TEAM_COUNT];
        private final long[] soft = new long[ScoreFormulas.SOFT_LEVELS - 1];
        private long key1;
        private long key2;

        private Sequencer(Problem problem, Round[] threeGameRounds) {
            this.problem = problem;
            int free = problem.roundCount;
            roundTotal = free + 3;
            rounds = Arrays.copyOf(threeGameRounds, roundTotal);
            rounds[free + 1] = problem.openingRound;
            rounds[free + 2] = problem.fourRound;
            slotCount = problem.bySlot.length;
            freeSlots = problem.freeSlots;
            homeMask = new int[roundTotal];
            pairMask = new long[roundTotal];
            int[][] location = new int[roundTotal][TEAM_COUNT];
            for (int r = 0; r < roundTotal; r++) {
                homeMask[r] = rounds[r].homeMask;
                pairMask[r] = rounds[r].pairMask;
                for (int edge : rounds[r].edges) {
                    int home = unpackHome(edge);
                    location[r][home] = home;
                    location[r][unpackAway(edge)] = home;
                }
            }
            legs = new long[roundTotal * roundTotal * TEAM_COUNT];
            for (int from = 0; from < roundTotal; from++) {
                for (int to = 0; to < roundTotal; to++) {
                    int base = (from * roundTotal + to) * TEAM_COUNT;
                    for (int team = 0; team < TEAM_COUNT; team++) {
                        legs[base + team] = problem.distance[location[from][team]][location[to][team]];
                    }
                }
            }
            weightedCost = new double[roundTotal * roundTotal];
            template = new int[slotCount];
            Arrays.fill(template, -1);
            template[problem.childSlot] = free;
            template[problem.openingSlot] = free + 1;
            template[problem.fourSlot] = free + 2;
            seq = template.clone();
        }

        /**
         * Builds {@code roundsToTry} weighted constructions. The first uses unit weights; each later one
         * reweights teams by their deviation from the league mean in the previous construction.
         *
         * @return the construction with the best soft levels, or null when none was found
         */
        private int[] lagrangianConstruction(int roundsToTry, SplittableRandom random) {
            double[] weights = new double[TEAM_COUNT];
            Arrays.fill(weights, 1.0d);
            int[] best = null;
            long bestKey1 = Long.MAX_VALUE;
            long bestKey2 = Long.MAX_VALUE;
            for (int round = 0; round < roundsToTry; round++) {
                updateWeightedCost(weights);
                int[] perm = construct(random, CONSTRUCTION_NOISE);
                if (perm == null) {
                    continue;
                }
                evaluate(perm);
                if (best == null || isLess(key1, key2, bestKey1, bestKey2)) {
                    best = perm;
                    bestKey1 = key1;
                    bestKey2 = key2;
                }
                lagrangeUpdate(weights);
            }
            if (best == null) {
                // A weighted order can corner the DFS near the fixed slots. Index order is the old first-fit.
                best = construct(null, 0.0d);
            }
            return best;
        }

        private void updateWeightedCost(double[] weights) {
            for (int pair = 0; pair < weightedCost.length; pair++) {
                int base = pair * TEAM_COUNT;
                double cost = 0.0d;
                for (int team = 0; team < TEAM_COUNT; team++) {
                    cost += weights[team] * legs[base + team];
                }
                weightedCost[pair] = cost;
            }
        }

        /** Uses {@link #distance} from the latest {@link #evaluate}. */
        private void lagrangeUpdate(double[] weights) {
            long sum = 0L;
            for (long value : distance) {
                sum += value;
            }
            double mean = (double) sum / TEAM_COUNT;
            double total = 0.0d;
            for (int team = 0; team < TEAM_COUNT; team++) {
                double deviation = (distance[team] - mean) / ScoreFormulas.DISTANCE_TOLERANCE_TENTHS;
                double weight = weights[team] * Math.exp(LAGRANGE_STEP * deviation);
                weights[team] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, weight));
                total += weights[team];
            }
            double scale = TEAM_COUNT / total;
            for (int team = 0; team < TEAM_COUNT; team++) {
                weights[team] *= scale;
            }
        }

        /**
         * Depth-first fill of the free slots in slot order. Candidates are tried cheapest first by
         * weighted transition cost from the previous slot (and into a fixed next slot), each cost
         * scaled by GRASP noise. A null {@code random} tries rounds in index order.
         */
        private int[] construct(SplittableRandom random, double noise) {
            int[] work = seq.clone();
            boolean[] used = new boolean[problem.roundCount];
            int[] nodes = {0};
            if (!placeAt(0, work, used, nodes, random, noise)) {
                return null;
            }
            int[] perm = new int[freeSlots.length];
            for (int p = 0; p < freeSlots.length; p++) {
                perm[p] = work[freeSlots[p]];
            }
            return perm;
        }

        private boolean placeAt(int index, int[] work, boolean[] used, int[] nodes, SplittableRandom random,
                double noise) {
            nodes[0]++;
            if (nodes[0] > PLACE_NODE_LIMIT) {
                return false;
            }
            if (index == freeSlots.length) {
                return true;
            }
            int slot = freeSlots[index];
            int free = problem.roundCount;
            int[] order = new int[free];
            double[] cost = new double[free];
            int count = 0;
            int previous = slot > 0 ? work[slot - 1] : -1;
            int next = slot + 1 < slotCount ? work[slot + 1] : -1;
            for (int r = 0; r < free; r++) {
                if (used[r] || !fits(slot, r, work)) {
                    continue;
                }
                double c = 0.0d;
                if (random != null) {
                    if (previous >= 0) {
                        c += weightedCost[previous * roundTotal + r];
                    }
                    if (next >= 0) {
                        c += weightedCost[r * roundTotal + next];
                    }
                    c *= 1.0d + noise * random.nextDouble();
                }
                order[count] = r;
                cost[count] = c;
                count++;
            }
            if (random != null) {
                sortByCost(order, cost, count);
            }
            for (int i = 0; i < count; i++) {
                int r = order[i];
                used[r] = true;
                work[slot] = r;
                if (placeAt(index + 1, work, used, nodes, random, noise)) {
                    return true;
                }
                work[slot] = -1;
                used[r] = false;
                if (nodes[0] > PLACE_NODE_LIMIT) {
                    return false;
                }
            }
            return false;
        }

        /**
         * Rejects a round that repeats an unordered pair on either filled neighbouring slot, or that
         * would make some team home or away for four slot indexes in a row. Slot index order matches
         * {@code ScoreFormulas}, including across date gaps such as the all-star break.
         */
        private boolean fits(int slot, int round, int[] work) {
            long pairs = pairMask[round];
            if (slot > 0 && work[slot - 1] >= 0 && (pairMask[work[slot - 1]] & pairs) != 0L) {
                return false;
            }
            if (slot + 1 < slotCount && work[slot + 1] >= 0 && (pairMask[work[slot + 1]] & pairs) != 0L) {
                return false;
            }
            int windowStart = Math.max(0, slot - 3);
            int windowEnd = Math.min(slotCount - 4, slot);
            for (int window = windowStart; window <= windowEnd; window++) {
                int all = FULL_MASK;
                int any = 0;
                boolean ready = true;
                for (int offset = 0; offset < 4; offset++) {
                    int index = window + offset;
                    int mask;
                    if (index == slot) {
                        mask = homeMask[round];
                    } else if (work[index] >= 0) {
                        mask = homeMask[work[index]];
                    } else {
                        ready = false;
                        break;
                    }
                    all &= mask;
                    any |= mask;
                }
                if (ready && (all != 0 || (~any & FULL_MASK) != 0)) {
                    return false;
                }
            }
            return true;
        }

        /** Full hard check of a complete sequence. */
        private boolean feasible(int[] full) {
            for (int slot = 1; slot < slotCount; slot++) {
                if ((pairMask[full[slot - 1]] & pairMask[full[slot]]) != 0L) {
                    return false;
                }
            }
            for (int window = 0; window + 3 < slotCount; window++) {
                int m0 = homeMask[full[window]];
                int m1 = homeMask[full[window + 1]];
                int m2 = homeMask[full[window + 2]];
                int m3 = homeMask[full[window + 3]];
                if ((m0 & m1 & m2 & m3) != 0 || (~(m0 | m1 | m2 | m3) & FULL_MASK) != 0) {
                    return false;
                }
            }
            return true;
        }

        /**
         * Late acceptance over the free-slot permutation. Moves: swap two slots, move one slot
         * elsewhere (Or-opt), reverse a segment (2-opt). Half of the moves stay within 8 positions.
         */
        private int[] improve(int[] start, int iterations, int historySize, SplittableRandom random) {
            int n = start.length;
            int[] current = start.clone();
            int[] candidate = new int[n];
            int[] best = start.clone();
            evaluate(current);
            long currentKey1 = key1;
            long currentKey2 = key2;
            long bestKey1 = key1;
            long bestKey2 = key2;
            long[] history1 = new long[historySize];
            long[] history2 = new long[historySize];
            Arrays.fill(history1, currentKey1);
            Arrays.fill(history2, currentKey2);
            for (int iteration = 0; iteration < iterations; iteration++) {
                System.arraycopy(current, 0, candidate, 0, n);
                int p = random.nextInt(n);
                int q;
                if (random.nextBoolean()) {
                    int offset = 1 + random.nextInt(8);
                    q = random.nextBoolean() ? p + offset : p - offset;
                    if (q < 0 || q >= n) {
                        continue;
                    }
                } else {
                    q = random.nextInt(n - 1);
                    if (q >= p) {
                        q++;
                    }
                }
                switch (random.nextInt(3)) {
                    case 0 -> {
                        int tmp = candidate[p];
                        candidate[p] = candidate[q];
                        candidate[q] = tmp;
                    }
                    case 1 -> {
                        int moved = candidate[p];
                        if (p < q) {
                            System.arraycopy(candidate, p + 1, candidate, p, q - p);
                        } else {
                            System.arraycopy(candidate, q, candidate, q + 1, p - q);
                        }
                        candidate[q] = moved;
                    }
                    default -> {
                        int low = Math.min(p, q);
                        int high = Math.max(p, q);
                        while (low < high) {
                            int tmp = candidate[low];
                            candidate[low] = candidate[high];
                            candidate[high] = tmp;
                            low++;
                            high--;
                        }
                    }
                }
                int[] full = fill(candidate);
                if (!feasible(full)) {
                    continue;
                }
                evaluateFull(full);
                int slot = iteration % historySize;
                if (!isLess(currentKey1, currentKey2, key1, key2)
                        || !isLess(history1[slot], history2[slot], key1, key2)) {
                    int[] swap = current;
                    current = candidate;
                    candidate = swap;
                    currentKey1 = key1;
                    currentKey2 = key2;
                    if (isLess(currentKey1, currentKey2, bestKey1, bestKey2)) {
                        System.arraycopy(current, 0, best, 0, n);
                        bestKey1 = currentKey1;
                        bestKey2 = currentKey2;
                    }
                }
                history1[slot] = currentKey1;
                history2[slot] = currentKey2;
            }
            return best;
        }

        private int[] fill(int[] perm) {
            for (int p = 0; p < perm.length; p++) {
                seq[freeSlots[p]] = perm[p];
            }
            return seq;
        }

        private void evaluate(int[] perm) {
            evaluateFull(fill(perm));
        }

        /**
         * Exact soft levels 1..4 of {@link ScoreFormulas#evaluate} for a hard-feasible sequence:
         * each team plays one series per slot, so a route is the slot sequence of its locations.
         */
        private void evaluateFull(int[] full) {
            Arrays.fill(distance, 0L);
            Arrays.fill(moves, 0L);
            Arrays.fill(holiday, 0L);
            for (int slot = 1; slot < slotCount; slot++) {
                int base = (full[slot - 1] * roundTotal + full[slot]) * TEAM_COUNT;
                for (int team = 0; team < TEAM_COUNT; team++) {
                    long leg = legs[base + team];
                    distance[team] += leg;
                    if (leg > 0L) {
                        moves[team]++;
                    }
                }
            }
            for (int slot : problem.holidaySlots) {
                int weight = problem.holidayBySlot[slot];
                int mask = homeMask[full[slot]];
                while (mask != 0) {
                    int team = Integer.numberOfTrailingZeros(mask);
                    holiday[team] += weight;
                    mask &= mask - 1;
                }
            }
            soft[0] = ScoreFormulas.moveVariancePenalty(moves);
            soft[1] = ScoreFormulas.distanceVariancePenalty(distance);
            soft[2] = ScoreFormulas.holidayVariancePenalty(holiday);
            soft[3] = ScoreFormulas.totalDistanceKm(distance);
            key1 = (saturate(soft[0], 28) << 34) | saturate(soft[1], 34);
            key2 = (saturate(soft[2], 38) << 24) | saturate(soft[3], 24);
        }

        private long[] softLevels() {
            return soft.clone();
        }

        private Round[] schedule(int[] perm) {
            int[] full = fill(perm);
            Round[] schedule = new Round[slotCount];
            for (int slot = 0; slot < slotCount; slot++) {
                schedule[slot] = rounds[full[slot]];
            }
            return schedule;
        }
    }

    private static void sortByCost(int[] order, double[] cost, int count) {
        for (int i = 1; i < count; i++) {
            int r = order[i];
            double c = cost[i];
            int j = i - 1;
            while (j >= 0 && cost[j] > c) {
                order[j + 1] = order[j];
                cost[j + 1] = cost[j];
                j--;
            }
            order[j + 1] = r;
            cost[j + 1] = c;
        }
    }

    /** Lexicographic {@code (a1, a2) < (b1, b2)}. Lower penalty is better. */
    private static boolean isLess(long a1, long a2, long b1, long b2) {
        return a1 < b1 || (a1 == b1 && a2 < b2);
    }

    private static long saturate(long value, int bits) {
        return Math.min(value, (1L << bits) - 1L);
    }

    private static long mix(long seed, int start) {
        long z = seed + 0x9E3779B97F4A7C15L * (start + 1L);
        z = (z ^ (z >>> 30)) * 0xBF58476D1CE4E5B9L;
        z = (z ^ (z >>> 27)) * 0x94D049BB133111EBL;
        return z ^ (z >>> 31);
    }

    /**
     * Soft levels 1..4 as penalties ({@code soft[0]} is score soft 1). {@code key1}/{@code key2}
     * encode them for lexicographic comparison. Ties go to the lower start index.
     */
    private record Candidate(int start, int childPermutation, Round[] schedule, long key1, long key2, long[] soft) {

        boolean isBetterThan(Candidate other) {
            if (isLess(key1, key2, other.key1, other.key2)) {
                return true;
            }
            return key1 == other.key1 && key2 == other.key2 && start < other.start;
        }
    }

    /** Immutable facts shared by every start. */
    private static final class Problem {
        private final Team[] teamByIndex;
        private final boolean[] jamsil;
        private final int[] childHomes;
        private final int[] childAways;
        private final Calendar[] bySlot;
        private final int openingSlot;
        private final int fourSlot;
        private final int childSlot;
        private final int[][] baseRemaining;
        private final Round openingRound;
        private final Round fourRound;
        private final int roundCount;
        private final int[] freeSlots;
        private final long[][] distance;
        private final int[] holidayBySlot;
        private final int[] holidaySlots;

        private Problem(Team[] teamByIndex, boolean[] jamsil, int[] childHomes, int[] childAways, Calendar[] bySlot,
                int openingSlot, int fourSlot, int childSlot, int[][] baseRemaining, Round openingRound,
                Round fourRound, int roundCount) {
            this.teamByIndex = teamByIndex;
            this.jamsil = jamsil;
            this.childHomes = childHomes;
            this.childAways = childAways;
            this.bySlot = bySlot;
            this.openingSlot = openingSlot;
            this.fourSlot = fourSlot;
            this.childSlot = childSlot;
            this.baseRemaining = baseRemaining;
            this.openingRound = openingRound;
            this.fourRound = fourRound;
            this.roundCount = roundCount;
            int slotCount = bySlot.length;
            freeSlots = new int[roundCount];
            int free = 0;
            for (int slot = 0; slot < slotCount; slot++) {
                if (slot == openingSlot || slot == fourSlot || slot == childSlot) {
                    continue;
                }
                if (bySlot[slot].getConsecutive() != 3) {
                    throw new IllegalStateException("unfilled slot " + slot + " is not a 3-game slot");
                }
                if (free == roundCount) {
                    throw new IllegalStateException("more free 3-game slots than rounds " + roundCount);
                }
                freeSlots[free++] = slot;
            }
            if (free != roundCount) {
                throw new IllegalStateException("round count " + roundCount + " does not match empty slots " + free);
            }
            distance = new long[TEAM_COUNT][TEAM_COUNT];
            for (int from = 0; from < TEAM_COUNT; from++) {
                for (int to = 0; to < TEAM_COUNT; to++) {
                    distance[from][to] = teamByIndex[from].getDistanceTenthsTo(to);
                }
            }
            holidayBySlot = new int[slotCount];
            int holidayCount = 0;
            for (int slot = 0; slot < slotCount; slot++) {
                holidayBySlot[slot] = Math.max(0, bySlot[slot].getHoliday());
                if (holidayBySlot[slot] > 0) {
                    holidayCount++;
                }
            }
            holidaySlots = new int[holidayCount];
            int next = 0;
            for (int slot = 0; slot < slotCount; slot++) {
                if (holidayBySlot[slot] > 0) {
                    holidaySlots[next++] = slot;
                }
            }
        }
    }

    // ************************************************************************
    // Assignment, validation, and helpers
    // ************************************************************************

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
                if (count >= MULTIPLICITY_CEILING) {
                    throw new IllegalStateException("series multiplicity " + count + " is too large");
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

    /**
     * Shared-stadium home edges, most remaining copies first. Equal counts are shuffled by {@code random}.
     */
    private static int[] jamsilCandidates(int[][] remaining, boolean[] jamsil, SplittableRandom random) {
        long[] keys = new long[TEAM_COUNT * TEAM_COUNT];
        int count = 0;
        for (int home = 0; home < TEAM_COUNT; home++) {
            if (!jamsil[home]) {
                continue;
            }
            for (int away = 0; away < TEAM_COUNT; away++) {
                if (away != home && remaining[home][away] > 0) {
                    keys[count++] = edgeKey(remaining, pack(home, away), random);
                }
            }
        }
        return sortedEdges(keys, count);
    }

    private static int[] edgeCandidates(int[][] remaining, boolean[] jamsil, int pivot, int used,
            SplittableRandom random) {
        long[] keys = new long[2 * TEAM_COUNT];
        int count = 0;
        for (int other = 0; other < TEAM_COUNT; other++) {
            if (other == pivot || (used & bit(other)) != 0) {
                continue;
            }
            if (!jamsil[pivot] && remaining[pivot][other] > 0) {
                keys[count++] = edgeKey(remaining, pack(pivot, other), random);
            }
            if (!jamsil[other] && remaining[other][pivot] > 0) {
                keys[count++] = edgeKey(remaining, pack(other, pivot), random);
            }
        }
        return sortedEdges(keys, count);
    }

    /** Sort key: fewer missing copies first, then a random tie-break, then the edge in the low byte. */
    private static long edgeKey(int[][] remaining, int edge, SplittableRandom random) {
        long urgency = MULTIPLICITY_CEILING - remaining[unpackHome(edge)][unpackAway(edge)];
        return (urgency << 40) | ((long) random.nextInt(1 << 30) << 8) | edge;
    }

    private static int[] sortedEdges(long[] keys, int count) {
        Arrays.sort(keys, 0, count);
        int[] edges = new int[count];
        for (int i = 0; i < count; i++) {
            edges[i] = (int) (keys[i] & 0xFFL);
        }
        return edges;
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
