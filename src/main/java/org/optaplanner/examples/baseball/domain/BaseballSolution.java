package org.optaplanner.examples.baseball.domain;

import org.optaplanner.core.api.domain.solution.PlanningEntityCollectionProperty;
import org.optaplanner.core.api.domain.solution.PlanningScore;
import org.optaplanner.core.api.domain.solution.PlanningSolution;
import org.optaplanner.core.api.domain.solution.ProblemFactCollectionProperty;
import org.optaplanner.core.api.domain.solution.ProblemFactProperty;
import org.optaplanner.core.api.domain.valuerange.ValueRangeProvider;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.examples.common.domain.AbstractPersistable;

import java.util.List;

@PlanningSolution
public class BaseballSolution extends AbstractPersistable {

    private List<Match> matchList;
    private  List<Calendar> calendarList;
    private List<Team> teamList;
    private ScoreSettings settings;
    private BendableLongScore bendableLongScore;

    @PlanningEntityCollectionProperty
    public List<Match> getMatchList() {
        return matchList;
    }

    public void setMatchList(List<Match> matchList) {
        this.matchList = matchList;
    }

    @ValueRangeProvider(id = "calendarRange")
    @ProblemFactCollectionProperty
    public List<Calendar> getCalendarList() {
        return calendarList;
    }

    public void setCalendarList(List<Calendar> calendarList) {
        this.calendarList = calendarList;
    }

    @ProblemFactCollectionProperty
    public List<Team> getTeamList() {
        return teamList;
    }

    public void setTeamList(List<Team> teamList) {
        this.teamList = teamList;
    }

    /** 평준화 허용오차. 없으면 기본값. 제약 스트림이 이 사실과 조인하므로 항상 하나가 있어야 한다. */
    @ProblemFactProperty
    public ScoreSettings getSettings() {
        return settings == null ? ScoreSettings.DEFAULT : settings;
    }

    public void setSettings(ScoreSettings settings) {
        this.settings = settings;
    }

    @PlanningScore(bendableHardLevelsSize = 2, bendableSoftLevelsSize = 5)
    public BendableLongScore getBendableLongScore() {
        return bendableLongScore;
    }

    public void setBendableLongScore(BendableLongScore bendableLongScore) {
        this.bendableLongScore = bendableLongScore;
    }
}
