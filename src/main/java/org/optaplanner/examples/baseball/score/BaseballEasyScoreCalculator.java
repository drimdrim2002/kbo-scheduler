package org.optaplanner.examples.baseball.score;

import java.util.List;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.core.api.score.calculator.EasyScoreCalculator;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.Team;

public class BaseballEasyScoreCalculator implements EasyScoreCalculator<BaseballSolution, BendableLongScore> {

    @Override
    public BendableLongScore calculateScore(BaseballSolution baseballSolution) {
        List<Team> teamList = baseballSolution.getTeamList();
        if (teamList == null || teamList.isEmpty()) {
            throw new IllegalStateException("teamList is null or empty");
        }
        for (Team team : teamList) {
            if (!team.isIndexPrepared()) {
                throw new IllegalStateException("team index is not prepared");
            }
        }

        List<Calendar> calendarList = baseballSolution.getCalendarList();
        if (calendarList == null) {
            calendarList = List.of();
        }
        List<Match> matchList = baseballSolution.getMatchList();
        if (matchList == null) {
            matchList = List.of();
        }
        return ScoreFormulas.evaluate(teamList, calendarList, matchList);
    }
}
