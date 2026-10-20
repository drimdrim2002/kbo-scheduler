package org.optaplanner.examples.baseball.score;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.optaplanner.core.api.score.stream.ConstraintStreamImplType;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.ScoreSettings;
import org.optaplanner.examples.baseball.domain.Team;
import org.optaplanner.test.api.score.stream.ConstraintVerifier;

class BaseballConstraintProviderTest {

    private final ConstraintVerifier<BaseballConstraintProvider, BaseballSolution> verifier =
            ConstraintVerifier.build(new BaseballConstraintProvider(), BaseballSolution.class, Match.class)
                    .withConstraintStreamImplType(ConstraintStreamImplType.BAVET);

    @Test
    void sameDayStadiumConflict() {
        Match[] matches = sharedStadiumDay();
        verifier.verifyThat(BaseballConstraintProvider::sameDayStadiumConflict)
                .given(matches[0], matches[1])
                .penalizesBy(4L);
    }

    @Test
    void sameDayTeamConflict() {
        Match[] matches = sharedStadiumDay();
        verifier.verifyThat(BaseballConstraintProvider::sameDayTeamConflict)
                .given(matches[0], matches[1])
                .penalizesBy(6L);
    }

    @Test
    void sameDaySeriesCount() {
        Match[] matches = sharedStadiumDay();
        verifier.verifyThat(BaseballConstraintProvider::sameDaySeriesCount)
                .given(matches[0], matches[1])
                .penalizesBy(3L);
    }

    @Test
    void seriesLengthMismatch() {
        Team home = team(0L, "H", "잠실");
        Team away = team(1L, "A", "사직");
        Team.prepareIndices(List.of(home, away));
        Calendar shorter = calendar(0L, LocalDateTime.of(2025, 4, 1, 0, 0), 3, 0, 0);
        Match mismatch = new Match(0L, home, away, 2);
        mismatch.setCalendar(shorter);
        verifier.verifyThat(BaseballConstraintProvider::seriesLengthMismatch)
                .given(mismatch)
                .penalizesBy(1L);

        Calendar sameLength = calendar(1L, LocalDateTime.of(2025, 4, 4, 0, 0), 3, 0, 0);
        Match matching = new Match(1L, home, away, 3);
        matching.setCalendar(sameLength);
        verifier.verifyThat(BaseballConstraintProvider::seriesLengthMismatch)
                .given(matching)
                .penalizesBy(0L);
    }

    @Test
    void childrensDayHomeObligation() {
        Team doosan = team(0L, "두산", "잠실");
        Team lg = team(1L, "LG", "잠실");
        Team host = team(2L, "KIA", "광주");
        Team.prepareIndices(List.of(doosan, lg, host));
        Calendar children = calendar(0L, LocalDateTime.of(2025, 5, 5, 0, 0), 3, 0, 0);
        assertThat(children.isChildrenDay()).isTrue();

        Match obligated = new Match(0L, host, doosan, 3);
        obligated.setCalendar(children);
        verifier.verifyThat(BaseballConstraintProvider::childrensDayHomeObligation)
                .given(obligated)
                .penalizesBy(1L);

        Match notObligated = new Match(1L, host, lg, 3);
        notObligated.setCalendar(children);
        verifier.verifyThat(BaseballConstraintProvider::childrensDayHomeObligation)
                .given(notObligated)
                .penalizesBy(0L);
    }

    @Test
    void consecutiveSameMatchup() {
        Team kia = team(0L, "KIA", "광주");
        Team nc = team(1L, "NC", "창원");
        Team.prepareIndices(List.of(kia, nc));
        Calendar day0 = calendar(0L, LocalDateTime.of(2025, 3, 22, 0, 0), 3, 0, 0);
        Calendar day1 = calendar(1L, LocalDateTime.of(2025, 3, 25, 0, 0), 3, 0, 0);
        link(day0, day1);
        assertThat(day1.getPrev()).isSameAs(day0);

        Match first = new Match(0L, kia, nc, 3);
        first.setCalendar(day0);
        Match flipped = new Match(1L, nc, kia, 3);
        flipped.setCalendar(day1);
        verifier.verifyThat(BaseballConstraintProvider::consecutiveSameMatchup)
                .given(first, flipped)
                .penalizesBy(1L);

        Calendar gap0 = calendar(10L, LocalDateTime.of(2025, 4, 1, 0, 0), 3, 0, 0);
        Calendar gap1 = calendar(11L, LocalDateTime.of(2025, 4, 4, 0, 0), 3, 0, 0);
        Calendar gap2 = calendar(12L, LocalDateTime.of(2025, 4, 8, 0, 0), 3, 0, 0);
        link(gap0, gap1, gap2);
        assertThat(gap2.getPrev()).isSameAs(gap1);

        Match early = new Match(2L, kia, nc, 3);
        early.setCalendar(gap0);
        Match later = new Match(3L, kia, nc, 3);
        later.setCalendar(gap2);
        verifier.verifyThat(BaseballConstraintProvider::consecutiveSameMatchup)
                .given(early, later, gap1)
                .penalizesBy(0L);
    }

    @Test
    void homeAwayStreakLimit() {
        Object[] four = homeStreakFacts(4);
        verifier.verifyThat(BaseballConstraintProvider::homeAwayStreakLimit)
                .given(four)
                .penalizesBy(2L);

        Object[] three = homeStreakFacts(3);
        verifier.verifyThat(BaseballConstraintProvider::homeAwayStreakLimit)
                .given(three)
                .penalizesBy(0L);
    }

    @Test
    void minimizeUnassigned() {
        Team home = team(0L, "H", "잠실");
        Team away = team(1L, "A", "사직");
        Team.prepareIndices(List.of(home, away));

        Match unassigned = new Match(0L, home, away, 3);
        verifier.verifyThat(BaseballConstraintProvider::minimizeUnassigned)
                .given(unassigned)
                .penalizesBy(1L);

        Calendar dummy = calendar(9999L, LocalDateTime.of(2100, 12, 31, 0, 0), 0, 0, 0);
        assertThat(dummy.isDummy()).isTrue();
        Match onDummy = new Match(1L, home, away, 3);
        onDummy.setCalendar(dummy);
        verifier.verifyThat(BaseballConstraintProvider::minimizeUnassigned)
                .given(onDummy)
                .penalizesBy(1L);

        Calendar regular = calendar(0L, LocalDateTime.of(2025, 3, 22, 0, 0), 3, 0, 0);
        assertThat(regular.isRegular()).isTrue();
        Match assigned = new Match(2L, home, away, 3);
        assigned.setCalendar(regular);
        verifier.verifyThat(BaseballConstraintProvider::minimizeUnassigned)
                .given(assigned)
                .penalizesBy(0L);
    }

    @Test
    void stabilizeHoliday() {
        List<Team> teams = tenTeams(BigDecimal.ZERO);
        Calendar low = calendar(0L, LocalDateTime.of(2025, 6, 1, 0, 0), 3, 0, 10);
        Calendar high = calendar(1L, LocalDateTime.of(2025, 6, 4, 0, 0), 3, 0, 25);
        List<Match> matches = new ArrayList<>();
        for (int i = 0; i < 9; i++) {
            Match match = new Match(i, teams.get(i), teams.get((i + 1) % 9), 3);
            match.setCalendar(low);
            matches.add(match);
        }
        Match outlier = new Match(9L, teams.get(9), teams.get(0), 3);
        outlier.setCalendar(high);
        matches.add(outlier);

        verifier.verifyThat(BaseballConstraintProvider::stabilizeHoliday)
                .given(facts(teams, matches))
                .penalizesBy(90L);
    }

    @Test
    void moveVariancePenaltyMatchesHandExample() {
        long[] moves = new long[10];
        Arrays.fill(moves, 30L);
        moves[9] = 50L;
        assertThat(ScoreFormulas.moveVariancePenalty(moves)).isEqualTo(9000L);
    }

    @Test
    void holidayVariancePenaltyMatchesHandExample() {
        long[] holiday = new long[10];
        Arrays.fill(holiday, 10L);
        holiday[9] = 25L;
        assertThat(ScoreFormulas.holidayVariancePenalty(holiday)).isEqualTo(90L);
    }

    @Test
    void distanceVariancePenaltyAndTotalKmMatchHandExample() {
        long[] tenths = new long[10];
        Arrays.fill(tenths, 10_000L);
        tenths[9] = 20_000L;
        assertThat(ScoreFormulas.distanceVariancePenalty(tenths)).isEqualTo(360_000L);
        assertThat(ScoreFormulas.totalDistanceKm(tenths)).isEqualTo(11_000L);
    }

    @Test
    void stabilizeMoveCountSmoke() {
        // One team has four positive legs and the other nine stay at zero: floor(|4-0.4|/2)^2 * 100 = 100.
        List<Team> teams = tenTeams(BigDecimal.ONE);
        Match[] matches = new Match[5];
        for (int i = 0; i < matches.length; i++) {
            Calendar day = calendar(i, LocalDateTime.of(2025, 3, 22, 0, 0).plusDays(i * 3L), 3, 0, 0);
            matches[i] = new Match(i, teams.get(i + 1), teams.get(0), 3);
            matches[i].setCalendar(day);
        }
        verifier.verifyThat(BaseballConstraintProvider::stabilizeMoveCount)
                .given(facts(teams, Arrays.asList(matches)))
                .penalizesBy(100L);
    }

    @Test
    void stabilizeDistanceSmoke() {
        // One 1000 km leg and nine zeros: mean 100 km, excess 600 km, 600^2 = 360000.
        List<Team> teams = tenTeams(BigDecimal.ZERO);
        teams.get(0).getDistanceMap().put(teams.get(1).getName(), new BigDecimal("1000"));
        teams = Team.prepareIndices(teams);
        Calendar day0 = calendar(0L, LocalDateTime.of(2025, 3, 22, 0, 0), 3, 0, 0);
        Calendar day1 = calendar(1L, LocalDateTime.of(2025, 3, 25, 0, 0), 3, 0, 0);
        Match first = new Match(0L, teams.get(0), teams.get(2), 3);
        first.setCalendar(day0);
        Match second = new Match(1L, teams.get(1), teams.get(0), 3);
        second.setCalendar(day1);

        verifier.verifyThat(BaseballConstraintProvider::stabilizeDistance)
                .given(facts(teams, List.of(first, second)))
                .penalizesBy(360_000L);
    }

    private static Match[] sharedStadiumDay() {
        Team homeA = team(0L, "H1", "잠실");
        Team awayA = team(1L, "A1", "사직");
        Team homeB = team(2L, "H2", "잠실");
        Team awayB = team(3L, "A2", "고척");
        Team.prepareIndices(List.of(homeA, awayA, homeB, awayB));
        Calendar day = calendar(0L, LocalDateTime.of(2025, 3, 22, 0, 0), 3, 0, 0);
        Match first = new Match(0L, homeA, awayA, 3);
        first.setCalendar(day);
        Match second = new Match(1L, homeB, awayB, 3);
        second.setCalendar(day);
        return new Match[] {first, second};
    }

    private static Object[] homeStreakFacts(int days) {
        Team home = team(0L, "A", "사직");
        Team away = team(1L, "B", "잠실");
        Team.prepareIndices(List.of(home, away));
        Calendar[] calendars = new Calendar[days];
        Match[] matches = new Match[days];
        for (int i = 0; i < days; i++) {
            calendars[i] = calendar(i, LocalDateTime.of(2025, 4, 1, 0, 0).plusDays(i * 3L), 3, 0, 0);
            matches[i] = new Match(i, home, away, 3);
            matches[i].setCalendar(calendars[i]);
        }
        link(calendars);
        Object[] facts = new Object[days + 2];
        System.arraycopy(matches, 0, facts, 0, days);
        facts[days] = home;
        facts[days + 1] = away;
        return facts;
    }

    private static List<Team> tenTeams(BigDecimal crossKm) {
        List<Team> teams = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            teams.add(team(i, "T" + i, "S" + i));
        }
        for (Team from : teams) {
            HashMap<String, BigDecimal> distances = new HashMap<>();
            for (Team to : teams) {
                distances.put(to.getName(), from == to ? BigDecimal.ZERO : crossKm);
            }
            from.setDistanceMap(distances);
        }
        return Team.prepareIndices(teams);
    }

    /** 리그 합계 제약은 허용오차 사실(ScoreSettings)과 조인하므로 기본 설정을 함께 준다. */
    private static Object[] facts(List<?> teams, List<?> matches) {
        Object[] all = new Object[teams.size() + matches.size() + 1];
        int index = 0;
        all[index++] = ScoreSettings.DEFAULT;
        for (Object team : teams) {
            all[index++] = team;
        }
        for (Object match : matches) {
            all[index++] = match;
        }
        return all;
    }

    private static Team team(long id, String name, String stadium) {
        return new Team(id, name, stadium, new HashMap<>());
    }

    private static Calendar calendar(long id, LocalDateTime start, int consecutive, int weekend, int holiday) {
        return new Calendar(id, start, consecutive, weekend, holiday);
    }

    private static void link(Calendar... calendars) {
        for (int i = 0; i < calendars.length; i++) {
            calendars[i].setPrev(i == 0 ? null : calendars[i - 1]);
            calendars[i].setNext(i + 1 == calendars.length ? null : calendars[i + 1]);
        }
    }
}
