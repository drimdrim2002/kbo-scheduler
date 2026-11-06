package org.optaplanner.examples.baseball.score;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Constants;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.Team;
import org.optaplanner.examples.baseball.score.ScoreFormulas.TeamTotals;

/**
 * 올스타 휴식기처럼 두 연전 사이에 경기 없는 날이 {@link ScoreFormulas#LONG_BREAK_REST_DAYS}일 이상이면
 * 그 사이 이동은 거리 0·이동 횟수 0이고, 홈·원정 연속은 이어 센다.
 */
class LongBreakTravelTest {

    private static BaseballSolution initialPlan2025() {
        var input = BaseballApp.readJsonFile(Constants.inputFileName);
        BaseballSolution solution = BaseballApp.makeSolution(input);
        BaseballApp.setInitialPlan(input, solution);
        return solution;
    }

    @Test
    void onlyTheAllStarBreakIsALongBreakIn2025() {
        List<Calendar> regular = initialPlan2025().getCalendarList().stream().filter(Calendar::isRegular)
                .sorted(Comparator.comparingInt(Calendar::getSlotIndex)).toList();
        List<String> breaks = new ArrayList<>();
        for (int i = 1; i < regular.size(); i++) {
            long rest = Calendar.restDaysBetween(regular.get(i - 1), regular.get(i));
            assertThat(rest).isBetween(0L, 6L);
            if (ScoreFormulas.isLongBreak(regular.get(i - 1), regular.get(i))) {
                breaks.add(regular.get(i - 1).getStartTime().toLocalDate() + "→" + regular.get(i).getStartTime().toLocalDate() + " " + rest);
            }
        }
        // 7/8(화) 3연전 끝 7/10 → 7/11~16 휴식 → 7/17(목) 4연전
        assertThat(breaks).containsExactly("2025-07-08→2025-07-17 6");
    }

    @Test
    void theBreakLegCountsNoDistanceAndNoMoveButTheStreakRunsOn() {
        BaseballSolution solution = initialPlan2025();
        TeamTotals totals = ScoreFormulas.computeTeamTotals(solution.getTeamList(), solution.getMatchList());
        int teamsThatWouldHaveMoved = 0;
        for (Team team : solution.getTeamList()) {
            List<Match> route = solution.getMatchList().stream()
                    .filter(m -> m.getCalendar() != null && m.getCalendar().isRegular())
                    .filter(m -> m.getHome() == team || m.getAway() == team)
                    .sorted(Comparator.comparingInt((Match m) -> m.getCalendar().getSlotIndex())).toList();
            long fullDistance = 0L;
            long fullMoves = 0L;
            long breakLeg = -1L;
            long streak = 0L;
            int run = 1;
            for (int i = 1; i < route.size(); i++) {
                Match from = route.get(i - 1);
                Match to = route.get(i);
                long leg = from.getHome().getDistanceTenthsTo(to.getHome().getIndex());
                fullDistance += leg;
                fullMoves += leg > 0L ? 1L : 0L;
                if (ScoreFormulas.isLongBreak(from.getCalendar(), to.getCalendar())) {
                    assertThat(breakLeg).as("%s: one break leg", team.getName()).isEqualTo(-1L);
                    breakLeg = leg;
                }
                if ((from.getHome() == team) == (to.getHome() == team)) {
                    run++;
                    streak += run > 3 ? 1L : 0L;
                } else {
                    run = 1;
                }
            }
            assertThat(breakLeg).as("%s: break leg found", team.getName()).isGreaterThanOrEqualTo(0L);
            int t = team.getIndex();
            assertThat(totals.distanceTenths[t]).as(team.getName()).isEqualTo(fullDistance - breakLeg);
            assertThat(totals.moveCount[t]).as(team.getName()).isEqualTo(fullMoves - (breakLeg > 0L ? 1L : 0L));
            assertThat(totals.streakPenalty[t]).as(team.getName()).isEqualTo(streak);
            teamsThatWouldHaveMoved += breakLeg > 0L ? 1 : 0;
        }
        assertThat(teamsThatWouldHaveMoved).isPositive();
    }
}
