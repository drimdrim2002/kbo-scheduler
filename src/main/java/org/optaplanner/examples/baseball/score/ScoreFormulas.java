package org.optaplanner.examples.baseball.score;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Constants;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.ScoreSettings;
import org.optaplanner.examples.baseball.domain.Team;

/**
 * Shared score math for {@link BaseballEasyScoreCalculator} and {@link BaseballConstraintProvider}.
 * Distances are tenths of a kilometre so the tolerance-variance formulas stay exact in {@code long}.
 */
public final class ScoreFormulas {

    public static final int HARD_LEVELS = 2;
    public static final int SOFT_LEVELS = 5;
    public static final long DUMMY_CALENDAR_ID = 9999L;
    public static final long DISTANCE_TOLERANCE_TENTHS = 3_000L;
    public static final int TEAMS_PER_DAY = 10;
    public static final int STADIUMS_PER_DAY = 5;
    public static final int SERIES_PER_DAY = 5;
    private static final int INITIAL_SLOTS = 48;

    private static final Comparator<Match> BY_MATCH_ID =
            (left, right) -> Long.compare(matchId(left), matchId(right));
    private static final ThreadLocal<Scratch> SCRATCH = ThreadLocal.withInitial(Scratch::new);

    private ScoreFormulas() {
    }

    public static BendableLongScore hard(int level) {
        return BendableLongScore.ofHard(HARD_LEVELS, SOFT_LEVELS, level, 1L);
    }

    public static BendableLongScore soft(int level) {
        return BendableLongScore.ofSoft(HARD_LEVELS, SOFT_LEVELS, level, 1L);
    }

    public static boolean isRegular(Match match) {
        Calendar calendar = match.getCalendar();
        return calendar != null && calendar.isRegular();
    }

    public static long countDeviation(int actual, int expected) {
        return Math.abs((long) actual - expected);
    }

    public static int uniqueTeamCount(List<Match> matches) {
        int mask = 0;
        for (Match match : matches) {
            mask |= maskBit(match.getHome().getIndex());
            mask |= maskBit(match.getAway().getIndex());
        }
        return Integer.bitCount(mask);
    }

    public static int uniqueStadiumCount(List<Match> matches) {
        int mask = 0;
        for (Match match : matches) {
            mask |= maskBit(match.getHome().getStadiumIndex());
        }
        return Integer.bitCount(mask);
    }

    public static long seriesLengthMismatch(Calendar calendar, List<Match> matches) {
        long penalty = 0L;
        int expected = calendar.getConsecutive();
        for (Match match : matches) {
            if (match.getConsecutive() != expected) {
                penalty++;
            }
        }
        return penalty;
    }

    public static long childrensDayAwayPenalty(Calendar calendar, List<Match> matches) {
        if (!calendar.isChildrenDay()) {
            return 0L;
        }
        long penalty = 0L;
        for (Match match : matches) {
            if (match.getAway().isChildrenDayHome()) {
                penalty++;
            }
        }
        return penalty;
    }

    /**
     * One penalty per current match whose unordered pair appears at least once on the previous day.
     * An empty previous day contributes nothing, so a gap does not glue non-adjacent series together.
     */
    public static long successivePenalty(List<Match> previousDay, List<Match> currentDay) {
        if (previousDay == null || currentDay == null || previousDay.isEmpty() || currentDay.isEmpty()) {
            return 0L;
        }
        long penalty = 0L;
        for (Match current : currentDay) {
            for (Match previous : previousDay) {
                if (sameMatchup(current, previous)) {
                    penalty++;
                    break;
                }
            }
        }
        return penalty;
    }

    public static boolean sameMatchup(Match left, Match right) {
        return sameTeam(left.getHome(), right.getHome()) && sameTeam(left.getAway(), right.getAway())
                || sameTeam(left.getHome(), right.getAway()) && sameTeam(left.getAway(), right.getHome());
    }

    public record Visit(int slotIndex, long matchId, int locationTeamIndex, Team locationTeam, boolean home,
            int holidayWeight) {
    }

    /**
     * One team's route totals. Built from that team's matches only, so a calendar change
     * recomputes the home team and the away team and leaves the other summaries cached.
     */
    public record TeamSummary(int teamIndex, long distanceTenths, long moveCount, long holidayWeight, long streakPenalty) {

        public static TeamSummary empty(Team team) {
            return new TeamSummary(team.getIndex(), 0L, 0L, 0L, 0L);
        }
    }

    public static List<Visit> visitsFor(Team team, List<Match> matches) {
        TeamRouteAccumulator route = new TeamRouteAccumulator(team);
        for (Match match : matches) {
            if (!isRegular(match)) {
                continue;
            }
            if (sameTeam(match.getHome(), team) || sameTeam(match.getAway(), team)) {
                route.accept(match);
            }
        }
        return route.toVisits();
    }

    public static TeamSummary summarizeTeam(Team team, List<Match> matches) {
        TeamRouteAccumulator route = new TeamRouteAccumulator(team);
        for (Match match : matches) {
            if (!isRegular(match)) {
                continue;
            }
            if (sameTeam(match.getHome(), team) || sameTeam(match.getAway(), team)) {
                route.accept(match);
            }
        }
        return route.finish();
    }

    public static long streakPenalty(List<Visit> visits) {
        long penalty = 0L;
        int run = 1;
        for (int i = 1; i < visits.size(); i++) {
            if (visits.get(i).home() == visits.get(i - 1).home()) {
                run++;
                if (run > 3) {
                    penalty++;
                }
            } else {
                run = 1;
            }
        }
        return penalty;
    }

    public static long distanceTenths(List<Visit> visits) {
        long total = 0L;
        for (int i = 1; i < visits.size(); i++) {
            total += legTenths(visits.get(i - 1), visits.get(i));
        }
        return total;
    }

    public static int moveCount(List<Visit> visits) {
        int moves = 0;
        for (int i = 1; i < visits.size(); i++) {
            if (legTenths(visits.get(i - 1), visits.get(i)) > 0L) {
                moves++;
            }
        }
        return moves;
    }

    public static long holidayWeight(List<Visit> visits) {
        long total = 0L;
        for (Visit visit : visits) {
            if (visit.home() && visit.holidayWeight() > 0) {
                total += visit.holidayWeight();
            }
        }
        return total;
    }

    public static final class TeamTotals {
        public final long[] distanceTenths;
        public final long[] moveCount;
        public final long[] holidayWeight;
        public final long[] streakPenalty;
        public ScoreSettings settings = ScoreSettings.DEFAULT;

        public TeamTotals(int teamCount) {
            distanceTenths = new long[teamCount];
            moveCount = new long[teamCount];
            holidayWeight = new long[teamCount];
            streakPenalty = new long[teamCount];
        }
    }

    /**
     * Every team in {@code teams} is included. A team with no regular series stays at zero,
     * which keeps the mean divisor equal to the full league size.
     * Matches are visited once and dropped into per-team slot arrays. A slot with a single
     * series needs no sort; a slot with two or more series is ordered by match id.
     */
    public static TeamTotals computeTeamTotals(List<Team> teams, List<Match> matches) {
        int teamCount = teams.size();
        TeamRouteAccumulator[] routes = new TeamRouteAccumulator[teamCount];
        for (Team team : teams) {
            int index = team.getIndex();
            if (index < 0 || index >= teamCount) {
                throw new IllegalStateException("team index out of range: " + index);
            }
            if (routes[index] != null) {
                throw new IllegalStateException("duplicate team index: " + index);
            }
            routes[index] = new TeamRouteAccumulator(team);
        }
        for (Match match : matches) {
            if (!isRegular(match)) {
                continue;
            }
            acceptSide(routes, match.getHome(), match);
            if (match.getAway().getIndex() != match.getHome().getIndex()) {
                acceptSide(routes, match.getAway(), match);
            }
        }
        TeamTotals totals = new TeamTotals(teamCount);
        for (int index = 0; index < teamCount; index++) {
            if (routes[index] != null) {
                addSummary(totals, routes[index].finish());
            }
        }
        return totals;
    }

    /**
     * Places each summary at {@code teamIndex}. Missing indexes stay zero, which is the
     * contribution of a team that has no regular series.
     */
    public static TeamTotals totalsFrom(List<TeamSummary> summaries, int teamCount) {
        return totalsFrom(summaries, teamCount, ScoreSettings.DEFAULT);
    }

    public static TeamTotals totalsFrom(List<TeamSummary> summaries, int teamCount, ScoreSettings settings) {
        TeamTotals totals = new TeamTotals(teamCount);
        totals.settings = settings == null ? ScoreSettings.DEFAULT : settings;
        for (TeamSummary summary : summaries) {
            addSummary(totals, summary);
        }
        return totals;
    }

    private static void addSummary(TeamTotals totals, TeamSummary summary) {
        int index = summary.teamIndex();
        totals.distanceTenths[index] = summary.distanceTenths();
        totals.moveCount[index] = summary.moveCount();
        totals.holidayWeight[index] = summary.holidayWeight();
        totals.streakPenalty[index] = summary.streakPenalty();
    }

    public static long totalStreakPenalty(TeamTotals totals) {
        long penalty = 0L;
        for (long value : totals.streakPenalty) {
            penalty += value;
        }
        return penalty;
    }

    /**
     * One pass over matches. Daily masks and team routes share that pass.
     * The scratch is thread-local because move threads call one calculator instance together.
     */
    public static BendableLongScore evaluate(List<Team> teams, List<Calendar> calendars, List<Match> matches) {
        return evaluate(teams, calendars, matches, ScoreSettings.DEFAULT);
    }

    public static BendableLongScore evaluate(List<Team> teams, List<Calendar> calendars, List<Match> matches,
            ScoreSettings settings) {
        ScoreSettings st = settings == null ? ScoreSettings.DEFAULT : settings;
        Scratch scratch = SCRATCH.get();
        scratch.prepare(teams, calendars, matches.size());
        try {
            scratch.absorb(matches);
            long hard0 = scratch.dailyHard(calendars, matches);
            scratch.finishTeams();
            hard0 += totalStreakPenalty(scratch.totals);
            long soft1 = moveVariancePenalty(scratch.totals.moveCount, st.getMoveTolerance());
            long soft2 = distanceVariancePenalty(scratch.totals.distanceTenths, st.getDistanceToleranceTenths());
            long soft3 = holidayVariancePenalty(scratch.totals.holidayWeight, st.getHolidayTolerance());
            long soft4 = totalDistanceKm(scratch.totals.distanceTenths);
            return BendableLongScore.of(
                    new long[] {-hard0, -scratch.hard1},
                    new long[] {-scratch.soft0, -soft1, -soft2, -soft3, -soft4});
        } finally {
            scratch.release();
        }
    }

    /**
     * Truncated kilometre sum. Mean uses integer division of tenths, matching
     * {@code BigDecimal.divide(..., scale 1, ROUND_DOWN)} when every leg is an exact tenth.
     * Penalty is {@code floor(sum((max(0, |d-mean|-300))^2))}.
     */
    public static long distanceVariancePenalty(long[] distanceTenths) {
        return distanceVariancePenalty(distanceTenths, DISTANCE_TOLERANCE_TENTHS);
    }

    public static long distanceVariancePenalty(long[] distanceTenths, long toleranceTenths) {
        if (distanceTenths.length == 0) {
            return 0L;
        }
        long sumTenths = 0L;
        for (long distance : distanceTenths) {
            sumTenths += distance;
        }
        long meanTenths = sumTenths / distanceTenths.length;
        long hundredths = 0L;
        for (long distance : distanceTenths) {
            long diffTenths = Math.abs(distance - meanTenths);
            if (diffTenths > toleranceTenths) {
                long excessTenths = diffTenths - toleranceTenths;
                hundredths += excessTenths * excessTenths;
            }
        }
        return hundredths / 100L;
    }

    public static long totalDistanceKm(long[] distanceTenths) {
        long sumTenths = 0L;
        for (long distance : distanceTenths) {
            sumTenths += distance;
        }
        return sumTenths / 10L;
    }

    public static long holidayVariancePenalty(long[] holidayWeight) {
        return holidayVariancePenalty(holidayWeight, Constants.TOLERANCE.HOLIDAY.toDouble());
    }

    public static long holidayVariancePenalty(long[] holidayWeight, double tolerance) {
        return squaredFloorTolerance(holidayWeight, tolerance);
    }

    /** Move-count variance multiplied by 100, matching the legacy soft weight. */
    public static long moveVariancePenalty(long[] moveCount) {
        return moveVariancePenalty(moveCount, Constants.TOLERANCE.TOTAL_MOVE.toDouble());
    }

    public static long moveVariancePenalty(long[] moveCount, double tolerance) {
        return squaredFloorTolerance(moveCount, tolerance) * 100L;
    }

    private static long squaredFloorTolerance(long[] values, double tolerance) {
        if (values.length == 0) {
            return 0L;
        }
        double sum = 0.0d;
        for (long value : values) {
            sum += value;
        }
        double mean = sum / values.length;
        long variance = 0L;
        for (long value : values) {
            long steps = (long) Math.floor(Math.abs(value - mean) / tolerance);
            variance += steps * steps;
        }
        return variance;
    }

    private static long legTenths(Visit from, Visit to) {
        return from.locationTeam().getDistanceTenthsTo(to.locationTeam().getIndex());
    }

    private static int maskBit(int index) {
        if (index < 0 || index > 31) {
            throw new IllegalArgumentException("bit index out of 0..31: " + index);
        }
        return 1 << index;
    }

    static long matchId(Match match) {
        Long id = match.getId();
        return id == null ? 0L : id;
    }

    private static void acceptSide(TeamRouteAccumulator[] routes, Team side, Match match) {
        int index = side.getIndex();
        if (index < 0 || index >= routes.length) {
            return;
        }
        TeamRouteAccumulator route = routes[index];
        if (route != null && sameTeam(side, route.team)) {
            route.accept(match);
        }
    }

    static boolean sameTeam(Team left, Team right) {
        if (left == right) {
            return true;
        }
        return left.getId() != null && left.getId().equals(right.getId());
    }

    /**
     * Slot-indexed route for one team. A normal series occupies one slot, so distance, moves,
     * holiday weight, and the home/away streak are a scan from slot 0 upward. Match-id order is
     * applied only when two series share a slot. {@link #add} captures the slot so a later
     * calendar change still retracts the old cell.
     */
    public static final class TeamRouteAccumulator {
        private Team team;
        private int slotCapacity;
        private int[] counts;
        private Match[] single;
        private Match[][] extra;
        private final VisitFold fold = new VisitFold();

        public TeamRouteAccumulator() {
            grow(INITIAL_SLOTS);
        }

        TeamRouteAccumulator(Team team) {
            this.team = team;
            grow(INITIAL_SLOTS);
        }

        public Runnable add(Team team, Match match) {
            if (this.team == null) {
                this.team = team;
            } else if (this.team != team) {
                throw new IllegalStateException("route group changed team");
            }
            int slot = match.getCalendar().getSlotIndex();
            insert(slot, match);
            return () -> delete(slot, match);
        }

        void accept(Match match) {
            insert(match.getCalendar().getSlotIndex(), match);
        }

        public TeamSummary finish() {
            if (team == null) {
                throw new IllegalStateException("route has no team");
            }
            return fold.summarize(team, slotCapacity, 0, counts, single, extra);
        }

        List<Visit> toVisits() {
            ArrayList<Visit> visits = new ArrayList<>();
            for (int slot = 0; slot < slotCapacity; slot++) {
                int count = counts[slot];
                if (count == 0) {
                    continue;
                }
                if (count == 1) {
                    visits.add(toVisit(single[slot]));
                    continue;
                }
                Match[] many = extra[slot];
                Arrays.sort(many, 0, count, BY_MATCH_ID);
                for (int i = 0; i < count; i++) {
                    visits.add(toVisit(many[i]));
                }
            }
            return visits;
        }

        private Visit toVisit(Match match) {
            boolean home = sameTeam(match.getHome(), team);
            int holiday = home ? match.getCalendar().getHoliday() : 0;
            Team location = match.getHome();
            return new Visit(match.getCalendar().getSlotIndex(), matchId(match), location.getIndex(), location, home,
                    holiday);
        }

        private void insert(int slot, Match match) {
            if (slot < 0) {
                throw new IllegalStateException("regular match has no slot");
            }
            if (slot >= slotCapacity) {
                grow(Math.max(slotCapacity * 2, slot + 1));
            }
            int count = counts[slot];
            if (count == 0) {
                single[slot] = match;
                counts[slot] = 1;
                return;
            }
            if (extra == null) {
                extra = new Match[slotCapacity][];
            }
            if (count == 1) {
                Match[] many = new Match[4];
                many[0] = single[slot];
                many[1] = match;
                extra[slot] = many;
                single[slot] = null;
                counts[slot] = 2;
                return;
            }
            Match[] many = extra[slot];
            if (count == many.length) {
                many = Arrays.copyOf(many, count * 2);
                extra[slot] = many;
            }
            many[count] = match;
            counts[slot] = count + 1;
        }

        private void delete(int slot, Match match) {
            if (slot < 0 || slot >= slotCapacity) {
                throw new IllegalStateException("retract missing slot " + slot);
            }
            int count = counts[slot];
            if (count == 1) {
                if (single[slot] != match) {
                    throw new IllegalStateException("retract mismatch");
                }
                single[slot] = null;
                counts[slot] = 0;
                return;
            }
            if (count < 2 || extra == null || extra[slot] == null) {
                throw new IllegalStateException("retract empty slot " + slot);
            }
            Match[] many = extra[slot];
            int found = -1;
            for (int i = 0; i < count; i++) {
                if (many[i] == match) {
                    found = i;
                    break;
                }
            }
            if (found < 0) {
                throw new IllegalStateException("retract mismatch");
            }
            int last = count - 1;
            many[found] = many[last];
            many[last] = null;
            if (last == 1) {
                single[slot] = many[0];
                many[0] = null;
                extra[slot] = null;
            }
            counts[slot] = last;
        }

        private void grow(int newCapacity) {
            int[] newCounts = new int[newCapacity];
            Match[] newSingle = new Match[newCapacity];
            if (counts != null) {
                System.arraycopy(counts, 0, newCounts, 0, slotCapacity);
                System.arraycopy(single, 0, newSingle, 0, slotCapacity);
            }
            if (extra != null) {
                extra = Arrays.copyOf(extra, newCapacity);
            }
            counts = newCounts;
            single = newSingle;
            slotCapacity = newCapacity;
        }
    }

    private static final class VisitFold {
        private Team previousLocation;
        private boolean previousHome;
        private boolean hasPrevious;
        private int run;
        private long distance;
        private long moves;
        private long holiday;
        private long streak;

        private TeamSummary summarize(Team team, int slots, int base, int[] counts, Match[] single, Match[][] extra) {
            reset();
            for (int slot = 0; slot < slots; slot++) {
                int index = base + slot;
                int count = counts[index];
                if (count == 0) {
                    continue;
                }
                if (count == 1) {
                    accept(team, single[index]);
                    continue;
                }
                Match[] many = extra[index];
                Arrays.sort(many, 0, count, BY_MATCH_ID);
                for (int i = 0; i < count; i++) {
                    accept(team, many[i]);
                }
            }
            return new TeamSummary(team.getIndex(), distance, moves, holiday, streak);
        }

        private void reset() {
            previousLocation = null;
            previousHome = false;
            hasPrevious = false;
            run = 0;
            distance = 0L;
            moves = 0L;
            holiday = 0L;
            streak = 0L;
        }

        private void accept(Team traveler, Match match) {
            boolean home = sameTeam(match.getHome(), traveler);
            Team location = match.getHome();
            if (!hasPrevious) {
                hasPrevious = true;
                run = 1;
            } else {
                long leg = previousLocation.getDistanceTenthsTo(location.getIndex());
                distance += leg;
                if (leg > 0L) {
                    moves++;
                }
                if (home == previousHome) {
                    run++;
                    if (run > 3) {
                        streak++;
                    }
                } else {
                    run = 1;
                }
            }
            if (home) {
                int weight = match.getCalendar().getHoliday();
                if (weight > 0) {
                    holiday += weight;
                }
            }
            previousHome = home;
            previousLocation = location;
        }
    }

    /**
     * Reused on the calling move thread. Cleared at the start of each evaluation.
     */
    private static final class Scratch {
        private int teamCount;
        private int allocatedTeams;
        private int slotCapacity;
        private int matchCapacity;
        private Team[] teamByIndex;
        private int[] counts;
        private Match[] single;
        private Match[][] extra;
        private int[] teamMask;
        private int[] stadiumMask;
        private int[] seriesCount;
        private long[] lengthMismatch;
        private long[] childrenPenalty;
        private int[] slotHead;
        private int[] nextInSlot;
        private TeamTotals totals;
        private final VisitFold fold = new VisitFold();
        private long soft0;
        private long hard1;

        private void prepare(List<Team> teams, List<Calendar> calendars, int matchCount) {
            teamCount = teams.size();
            int neededSlots = INITIAL_SLOTS;
            for (Calendar calendar : calendars) {
                if (calendar != null && calendar.isRegular()) {
                    neededSlots = Math.max(neededSlots, calendar.getSlotIndex() + 1);
                }
            }
            ensureTeams(teams);
            ensureSlots(neededSlots);
            ensureMatches(matchCount);
            clear();
        }

        private void absorb(List<Match> matches) {
            int size = matches.size();
            for (int i = 0; i < size; i++) {
                Match match = matches.get(i);
                if (!isRegular(match)) {
                    soft0++;
                    continue;
                }
                int slot = match.getCalendar().getSlotIndex();
                if (slot >= slotCapacity) {
                    ensureSlots(slot + 1);
                }
                nextInSlot[i] = slotHead[slot];
                slotHead[slot] = i;
                Team home = match.getHome();
                Team away = match.getAway();
                teamMask[slot] |= maskBit(home.getIndex());
                teamMask[slot] |= maskBit(away.getIndex());
                stadiumMask[slot] |= maskBit(home.getStadiumIndex());
                seriesCount[slot]++;
                Calendar calendar = match.getCalendar();
                if (match.getConsecutive() != calendar.getConsecutive()) {
                    lengthMismatch[slot]++;
                }
                if (calendar.isChildrenDay() && away.isChildrenDayHome()) {
                    childrenPenalty[slot]++;
                }
                addRoute(home, slot, match);
                if (away.getIndex() != home.getIndex()) {
                    addRoute(away, slot, match);
                }
            }
        }

        private long dailyHard(List<Calendar> calendars, List<Match> matches) {
            long hard0 = 0L;
            hard1 = 0L;
            for (Calendar calendar : calendars) {
                if (calendar == null || !calendar.isRegular()) {
                    continue;
                }
                int slot = calendar.getSlotIndex();
                if (slot < 0 || slot >= slotCapacity || seriesCount[slot] == 0) {
                    continue;
                }
                hard0 += countDeviation(Integer.bitCount(teamMask[slot]), TEAMS_PER_DAY);
                hard0 += countDeviation(Integer.bitCount(stadiumMask[slot]), STADIUMS_PER_DAY);
                hard0 += countDeviation(seriesCount[slot], SERIES_PER_DAY);
                hard0 += lengthMismatch[slot];
                hard0 += childrenPenalty[slot];
                Calendar previous = calendar.getPrev();
                if (previous != null && previous.isRegular()) {
                    int previousSlot = previous.getSlotIndex();
                    if (previousSlot >= 0 && previousSlot < slotCapacity && seriesCount[previousSlot] > 0) {
                        hard1 += successiveChain(matches, previousSlot, slot);
                    }
                }
            }
            return hard0;
        }

        private void finishTeams() {
            for (int index = 0; index < teamCount; index++) {
                Team team = teamByIndex[index];
                if (team == null) {
                    continue;
                }
                TeamSummary summary = fold.summarize(team, slotCapacity, index * slotCapacity, counts, single, extra);
                addSummary(totals, summary);
            }
        }

        private void release() {
            if (single != null) {
                Arrays.fill(single, null);
            }
            if (extra != null) {
                Arrays.fill(extra, null);
            }
            if (teamByIndex != null) {
                Arrays.fill(teamByIndex, null);
            }
        }

        private void addRoute(Team side, int slot, Match match) {
            int index = side.getIndex();
            if (index < 0 || index >= teamCount) {
                return;
            }
            Team known = teamByIndex[index];
            if (known == null || !sameTeam(side, known)) {
                return;
            }
            int cell = index * slotCapacity + slot;
            int count = counts[cell];
            if (count == 0) {
                single[cell] = match;
                counts[cell] = 1;
                return;
            }
            if (extra == null) {
                extra = new Match[teamCount * slotCapacity][];
            }
            if (count == 1) {
                Match[] many = new Match[4];
                many[0] = single[cell];
                many[1] = match;
                extra[cell] = many;
                single[cell] = null;
                counts[cell] = 2;
                return;
            }
            Match[] many = extra[cell];
            if (count == many.length) {
                many = Arrays.copyOf(many, count * 2);
                extra[cell] = many;
            }
            many[count] = match;
            counts[cell] = count + 1;
        }

        private long successiveChain(List<Match> matches, int previousSlot, int slot) {
            long penalty = 0L;
            for (int current = slotHead[slot]; current >= 0; current = nextInSlot[current]) {
                Match currentMatch = matches.get(current);
                for (int previous = slotHead[previousSlot]; previous >= 0; previous = nextInSlot[previous]) {
                    if (sameMatchup(currentMatch, matches.get(previous))) {
                        penalty++;
                        break;
                    }
                }
            }
            return penalty;
        }

        private void ensureTeams(List<Team> teams) {
            if (teamByIndex == null || teamByIndex.length < teamCount) {
                teamByIndex = new Team[teamCount];
            }
            if (totals == null || totals.distanceTenths.length != teamCount) {
                totals = new TeamTotals(teamCount);
            } else {
                Arrays.fill(totals.distanceTenths, 0L);
                Arrays.fill(totals.moveCount, 0L);
                Arrays.fill(totals.holidayWeight, 0L);
                Arrays.fill(totals.streakPenalty, 0L);
            }
            Arrays.fill(teamByIndex, 0, teamCount, null);
            for (Team team : teams) {
                int index = team.getIndex();
                if (index < 0 || index >= teamCount) {
                    throw new IllegalStateException("team index out of range: " + index);
                }
                if (teamByIndex[index] != null) {
                    throw new IllegalStateException("duplicate team index: " + index);
                }
                teamByIndex[index] = team;
            }
        }

        private void ensureSlots(int needed) {
            int neededSlots = Math.max(needed, INITIAL_SLOTS);
            if (counts != null && allocatedTeams >= teamCount && slotCapacity >= neededSlots
                    && counts.length >= allocatedTeams * slotCapacity) {
                return;
            }
            int newSlots = Math.max(neededSlots, slotCapacity);
            int oldSlots = counts == null ? 0 : slotCapacity;
            int oldTeams = counts == null ? 0 : allocatedTeams;
            int cells = teamCount * newSlots;
            int[] newCounts = new int[cells];
            Match[] newSingle = new Match[cells];
            Match[][] newExtra = extra == null ? null : new Match[cells][];
            int copyTeams = Math.min(oldTeams, teamCount);
            for (int team = 0; team < copyTeams; team++) {
                System.arraycopy(counts, team * oldSlots, newCounts, team * newSlots, oldSlots);
                System.arraycopy(single, team * oldSlots, newSingle, team * newSlots, oldSlots);
                if (extra != null) {
                    System.arraycopy(extra, team * oldSlots, newExtra, team * newSlots, oldSlots);
                }
            }
            if (teamMask == null || teamMask.length < newSlots) {
                int[] newTeamMask = new int[newSlots];
                int[] newStadiumMask = new int[newSlots];
                int[] newSeriesCount = new int[newSlots];
                long[] newLengthMismatch = new long[newSlots];
                long[] newChildrenPenalty = new long[newSlots];
                int[] newSlotHead = new int[newSlots];
                Arrays.fill(newSlotHead, -1);
                if (teamMask != null) {
                    System.arraycopy(teamMask, 0, newTeamMask, 0, oldSlots);
                    System.arraycopy(stadiumMask, 0, newStadiumMask, 0, oldSlots);
                    System.arraycopy(seriesCount, 0, newSeriesCount, 0, oldSlots);
                    System.arraycopy(lengthMismatch, 0, newLengthMismatch, 0, oldSlots);
                    System.arraycopy(childrenPenalty, 0, newChildrenPenalty, 0, oldSlots);
                    System.arraycopy(slotHead, 0, newSlotHead, 0, oldSlots);
                }
                teamMask = newTeamMask;
                stadiumMask = newStadiumMask;
                seriesCount = newSeriesCount;
                lengthMismatch = newLengthMismatch;
                childrenPenalty = newChildrenPenalty;
                slotHead = newSlotHead;
            }
            counts = newCounts;
            single = newSingle;
            extra = newExtra;
            allocatedTeams = teamCount;
            slotCapacity = newSlots;
        }

        private void ensureMatches(int matchCount) {
            if (nextInSlot == null || matchCapacity < matchCount) {
                nextInSlot = new int[Math.max(matchCount, 16)];
                matchCapacity = nextInSlot.length;
            }
        }

        private void clear() {
            Arrays.fill(counts, 0);
            Arrays.fill(single, null);
            if (extra != null) {
                if (extra.length < counts.length) {
                    extra = new Match[counts.length][];
                } else {
                    Arrays.fill(extra, null);
                }
            }
            Arrays.fill(teamMask, 0);
            Arrays.fill(stadiumMask, 0);
            Arrays.fill(seriesCount, 0);
            Arrays.fill(lengthMismatch, 0L);
            Arrays.fill(childrenPenalty, 0L);
            Arrays.fill(slotHead, -1);
            soft0 = 0L;
            hard1 = 0L;
        }
    }
}
