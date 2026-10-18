package org.optaplanner.examples.baseball.score;

import static org.optaplanner.core.api.score.stream.Joiners.equal;
import static org.optaplanner.core.api.score.stream.Joiners.filtering;

import java.util.List;
import java.util.function.BiFunction;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;
import java.util.function.ToLongFunction;
import org.optaplanner.core.api.function.TriFunction;
import org.optaplanner.core.api.score.stream.Constraint;
import org.optaplanner.core.api.score.stream.ConstraintCollectors;
import org.optaplanner.core.api.score.stream.ConstraintFactory;
import org.optaplanner.core.api.score.stream.ConstraintProvider;
import org.optaplanner.core.api.score.stream.Joiners;
import org.optaplanner.core.api.score.stream.bi.BiConstraintCollector;
import org.optaplanner.core.api.score.stream.bi.BiConstraintStream;
import org.optaplanner.core.api.score.stream.bi.BiJoiner;
import org.optaplanner.core.api.score.stream.uni.UniConstraintCollector;
import org.optaplanner.core.api.score.stream.uni.UniConstraintStream;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.Team;
import org.optaplanner.examples.baseball.score.ScoreFormulas.TeamRouteAccumulator;
import org.optaplanner.examples.baseball.score.ScoreFormulas.TeamSummary;
import org.optaplanner.examples.baseball.score.ScoreFormulas.TeamTotals;

/**
 * Bavet constraints. Counts and weights are {@link ScoreFormulas} so they stay aligned with the easy calculator.
 * <p>
 * Filter, join, and groupBy building blocks are static finals, which is what Bavet compares when it shares nodes.
 * {@code defineConstraints} also builds each shared pipeline once. OptaPlanner 9.44 group-bridge streams do not
 * implement equality, so five separate {@code groupBy} calls would still allocate five group nodes.
 */
public class BaseballConstraintProvider implements ConstraintProvider {

    private static final Predicate<Match> IS_REGULAR = ScoreFormulas::isRegular;
    private static final Function<Match, Calendar> MATCH_CALENDAR = Match::getCalendar;
    private static final UniConstraintCollector<Match, ?, List<Match>> MATCHES_ON_DAY = ConstraintCollectors.toList();
    private static final BiPredicate<Team, Match> TEAM_PLAYS =
            (team, match) -> match.getHome() == team || match.getAway() == team;
    private static final BiJoiner<Team, Match> TEAM_PLAYS_JOINER = Joiners.filtering(TEAM_PLAYS);
    private static final BiFunction<Team, Match, Team> TEAM_KEY = (team, match) -> team;
    private static final BiConstraintCollector<Team, Match, TeamRouteAccumulator, TeamSummary> TEAM_ROUTE =
            new TeamRouteCollector();
    private static final BiFunction<Team, TeamSummary, TeamSummary> SUMMARY_OF = (team, summary) -> summary;
    private static final UniConstraintCollector<TeamSummary, ?, List<TeamSummary>> SUMMARY_LIST =
            ConstraintCollectors.toList();
    private static final UniConstraintCollector<Team, ?, Integer> TEAM_COUNT = ConstraintCollectors.count();
    private static final BiFunction<List<TeamSummary>, Integer, TeamTotals> TO_TOTALS =
            (summaries, teamCount) -> ScoreFormulas.totalsFrom(summaries, teamCount);

    private static final BiFunction<Calendar, List<Match>, Long> TEAM_COUNT_DEVIATION =
            (calendar, matches) -> ScoreFormulas.countDeviation(
                    ScoreFormulas.uniqueTeamCount(matches), ScoreFormulas.TEAMS_PER_DAY);
    private static final BiFunction<Calendar, List<Match>, Long> STADIUM_COUNT_DEVIATION =
            (calendar, matches) -> ScoreFormulas.countDeviation(
                    ScoreFormulas.uniqueStadiumCount(matches), ScoreFormulas.STADIUMS_PER_DAY);
    private static final BiFunction<Calendar, List<Match>, Long> SERIES_COUNT_DEVIATION =
            (calendar, matches) -> ScoreFormulas.countDeviation(matches.size(), ScoreFormulas.SERIES_PER_DAY);
    private static final BiFunction<Calendar, List<Match>, Long> LENGTH_MISMATCH = ScoreFormulas::seriesLengthMismatch;
    private static final BiFunction<Calendar, List<Match>, Long> CHILDREN_PENALTY = ScoreFormulas::childrensDayAwayPenalty;

    private static final Predicate<TeamSummary> HAS_STREAK = summary -> summary.streakPenalty() > 0L;
    private static final ToLongFunction<TeamSummary> STREAK_PENALTY = TeamSummary::streakPenalty;
    private static final Function<TeamTotals, Long> MOVE_WEIGHT =
            totals -> ScoreFormulas.moveVariancePenalty(totals.moveCount);
    private static final Function<TeamTotals, Long> DISTANCE_WEIGHT =
            totals -> ScoreFormulas.distanceVariancePenalty(totals.distanceTenths);
    private static final Function<TeamTotals, Long> HOLIDAY_WEIGHT =
            totals -> ScoreFormulas.holidayVariancePenalty(totals.holidayWeight);
    private static final Function<TeamTotals, Long> TOTAL_DISTANCE_WEIGHT =
            totals -> ScoreFormulas.totalDistanceKm(totals.distanceTenths);
    private static final Predicate<Long> POSITIVE_LONG = value -> value > 0L;
    private static final ToLongFunction<Long> UNBOX_LONG = value -> value;

    @Override
    public Constraint[] defineConstraints(ConstraintFactory factory) {
        UniConstraintStream<Match> regular = regularMatches(factory);
        BiConstraintStream<Calendar, List<Match>> days = byDay(regular);
        UniConstraintStream<TeamSummary> summaries = teamSummaries(factory, regular);
        UniConstraintStream<TeamTotals> totals = leagueTotals(factory, summaries);
        return new Constraint[] {
                day(days, TEAM_COUNT_DEVIATION, "하루 팀 수 위반"),
                day(days, STADIUM_COUNT_DEVIATION, "하루 구장 수 위반"),
                day(days, SERIES_COUNT_DEVIATION, "하루 시리즈 수 위반"),
                day(days, LENGTH_MISMATCH, "시리즈 길이 불일치"),
                day(days, CHILDREN_PENALTY, "어린이날 홈 의무"),
                streak(summaries),
                consecutiveSameMatchup(factory),
                minimizeUnassigned(factory),
                league(totals, 1, MOVE_WEIGHT, "이동 횟수 분산"),
                league(totals, 2, DISTANCE_WEIGHT, "이동 거리 분산"),
                league(totals, 3, HOLIDAY_WEIGHT, "휴일 가중치 분산"),
                league(totals, 4, TOTAL_DISTANCE_WEIGHT, "총 이동 거리")
        };
    }

    public Constraint sameDayTeamConflict(ConstraintFactory factory) {
        return day(byDay(regularMatches(factory)), TEAM_COUNT_DEVIATION, "하루 팀 수 위반");
    }

    public Constraint sameDayStadiumConflict(ConstraintFactory factory) {
        return day(byDay(regularMatches(factory)), STADIUM_COUNT_DEVIATION, "하루 구장 수 위반");
    }

    public Constraint sameDaySeriesCount(ConstraintFactory factory) {
        return day(byDay(regularMatches(factory)), SERIES_COUNT_DEVIATION, "하루 시리즈 수 위반");
    }

    public Constraint seriesLengthMismatch(ConstraintFactory factory) {
        return day(byDay(regularMatches(factory)), LENGTH_MISMATCH, "시리즈 길이 불일치");
    }

    public Constraint childrensDayHomeObligation(ConstraintFactory factory) {
        return day(byDay(regularMatches(factory)), CHILDREN_PENALTY, "어린이날 홈 의무");
    }

    public Constraint homeAwayStreakLimit(ConstraintFactory factory) {
        return streak(teamSummaries(factory, regularMatches(factory)));
    }

    public Constraint consecutiveSameMatchup(ConstraintFactory factory) {
        return factory.forEach(Match.class)
                .filter(match -> ScoreFormulas.isRegular(match)
                        && match.getCalendar().getPrev() != null
                        && match.getCalendar().getPrev().isRegular())
                .ifExists(Match.class,
                        equal(match -> match.getCalendar().getPrev(), Match::getCalendar),
                        filtering(ScoreFormulas::sameMatchup))
                .penalizeLong(ScoreFormulas.hard(1), match -> 1L)
                .asConstraint("연속 시리즈 동일 대진 금지");
    }

    public Constraint minimizeUnassigned(ConstraintFactory factory) {
        return factory.forEachIncludingNullVars(Match.class)
                .filter(match -> !ScoreFormulas.isRegular(match))
                .penalizeLong(ScoreFormulas.soft(0), match -> 1L)
                .asConstraint("미배정 또는 더미 최소화");
    }

    public Constraint stabilizeMoveCount(ConstraintFactory factory) {
        return league(leagueOf(factory), 1, MOVE_WEIGHT, "이동 횟수 분산");
    }

    public Constraint stabilizeDistance(ConstraintFactory factory) {
        return league(leagueOf(factory), 2, DISTANCE_WEIGHT, "이동 거리 분산");
    }

    public Constraint stabilizeHoliday(ConstraintFactory factory) {
        return league(leagueOf(factory), 3, HOLIDAY_WEIGHT, "휴일 가중치 분산");
    }

    public Constraint minimizeTotalDistance(ConstraintFactory factory) {
        return league(leagueOf(factory), 4, TOTAL_DISTANCE_WEIGHT, "총 이동 거리");
    }

    private static UniConstraintStream<Match> regularMatches(ConstraintFactory factory) {
        return factory.forEach(Match.class).filter(IS_REGULAR);
    }

    private static BiConstraintStream<Calendar, List<Match>> byDay(UniConstraintStream<Match> regular) {
        return regular.groupBy(MATCH_CALENDAR, MATCHES_ON_DAY);
    }

    private static UniConstraintStream<TeamSummary> teamSummaries(ConstraintFactory factory,
            UniConstraintStream<Match> regular) {
        return factory.forEach(Team.class)
                .join(regular, TEAM_PLAYS_JOINER)
                .groupBy(TEAM_KEY, TEAM_ROUTE)
                .map(SUMMARY_OF);
    }

    private static UniConstraintStream<TeamTotals> leagueTotals(ConstraintFactory factory,
            UniConstraintStream<TeamSummary> summaries) {
        return summaries.groupBy(SUMMARY_LIST)
                .join(factory.forEach(Team.class).groupBy(TEAM_COUNT))
                .map(TO_TOTALS);
    }

    private static UniConstraintStream<TeamTotals> leagueOf(ConstraintFactory factory) {
        UniConstraintStream<Match> regular = regularMatches(factory);
        return leagueTotals(factory, teamSummaries(factory, regular));
    }

    /**
     * The penalty function runs once in {@code map}. Filter and penalize only read that long.
     * Days with no regular match are absent, and a zero penalty opens no match.
     */
    private static Constraint day(BiConstraintStream<Calendar, List<Match>> days,
            BiFunction<Calendar, List<Match>, Long> penalty, String name) {
        return days.map(penalty)
                .filter(POSITIVE_LONG)
                .penalizeLong(ScoreFormulas.hard(0), UNBOX_LONG)
                .asConstraint(name);
    }

    private static Constraint streak(UniConstraintStream<TeamSummary> summaries) {
        return summaries.filter(HAS_STREAK)
                .penalizeLong(ScoreFormulas.hard(0), STREAK_PENALTY)
                .asConstraint("4연속 홈/원정 시리즈 금지");
    }

    /**
     * Teams with no regular series are absent from {@code summaries}. The team-fact count pads
     * those zeros so the variance divisor stays the league size.
     */
    private static Constraint league(UniConstraintStream<TeamTotals> totals, int softLevel,
            Function<TeamTotals, Long> weight, String name) {
        return totals.map(weight)
                .filter(POSITIVE_LONG)
                .penalizeLong(ScoreFormulas.soft(softLevel), UNBOX_LONG)
                .asConstraint(name);
    }

    /**
     * Incremental per team. Insert and retract touch one slot; {@link TeamRouteAccumulator#finish()}
     * scans that team's slots and sorts only a slot that holds two or more series.
     */
    private static final class TeamRouteCollector
            implements BiConstraintCollector<Team, Match, TeamRouteAccumulator, TeamSummary> {

        private static final Supplier<TeamRouteAccumulator> SUPPLIER = TeamRouteAccumulator::new;
        private static final TriFunction<TeamRouteAccumulator, Team, Match, Runnable> ACCUMULATOR =
                TeamRouteAccumulator::add;
        private static final Function<TeamRouteAccumulator, TeamSummary> FINISHER = TeamRouteAccumulator::finish;

        @Override
        public Supplier<TeamRouteAccumulator> supplier() {
            return SUPPLIER;
        }

        @Override
        public TriFunction<TeamRouteAccumulator, Team, Match, Runnable> accumulator() {
            return ACCUMULATOR;
        }

        @Override
        public Function<TeamRouteAccumulator, TeamSummary> finisher() {
            return FINISHER;
        }
    }
}
