package org.optaplanner.examples.baseball.reschedule;

import java.util.List;
import org.optaplanner.core.api.domain.solution.PlanningEntityCollectionProperty;
import org.optaplanner.core.api.domain.solution.PlanningScore;
import org.optaplanner.core.api.domain.solution.PlanningSolution;
import org.optaplanner.core.api.domain.solution.ProblemFactCollectionProperty;
import org.optaplanner.core.api.domain.solution.ProblemFactProperty;
import org.optaplanner.core.api.domain.valuerange.ValueRangeProvider;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.examples.baseball.domain.Team;

/**
 * 날짜 단위 재편성 문제. 설계: docs/RESCHEDULE_DAILY_ENGINE_DESIGN.md.
 * Hard 0 = 꼭 지키는 규칙 위반(DH-1·2·4·5), Hard 1 = 못 넣은 경기 수, Soft 0~5 = 기준({@link RescheduleSettings#levelAt}).
 */
@PlanningSolution
public class RescheduleSolution {

    public static final int HARD_LEVELS = 2;
    public static final int SOFT_LEVELS = RescheduleSettings.LEVELS;

    /** Team.getIndex() 순. */
    private List<Team> teamList;
    /** 기간의 모든 날, 날짜순(id = 위치). */
    private List<RDay> dayList;
    /** 고정 경기와 배정할 경기(id = 위치). */
    private List<RGame> gameList;
    /** Team.getIndex() 순. */
    private List<TeamHistory> historyList;
    private RescheduleSettings settings;
    private BendableLongScore score;

    public RescheduleSolution() {
    }

    public RescheduleSolution(List<Team> teamList, List<RDay> dayList, List<RGame> gameList,
            List<TeamHistory> historyList, RescheduleSettings settings) {
        this.teamList = teamList;
        this.dayList = dayList;
        this.gameList = gameList;
        this.historyList = historyList;
        this.settings = settings;
    }

    @ProblemFactCollectionProperty
    public List<Team> getTeamList() {
        return teamList;
    }

    public void setTeamList(List<Team> teamList) {
        this.teamList = teamList;
    }

    @ValueRangeProvider(id = "dayRange")
    @ProblemFactCollectionProperty
    public List<RDay> getDayList() {
        return dayList;
    }

    public void setDayList(List<RDay> dayList) {
        this.dayList = dayList;
    }

    @PlanningEntityCollectionProperty
    public List<RGame> getGameList() {
        return gameList;
    }

    public void setGameList(List<RGame> gameList) {
        this.gameList = gameList;
    }

    @ProblemFactCollectionProperty
    public List<TeamHistory> getHistoryList() {
        return historyList;
    }

    public void setHistoryList(List<TeamHistory> historyList) {
        this.historyList = historyList;
    }

    @ProblemFactProperty
    public RescheduleSettings getSettings() {
        return settings;
    }

    public void setSettings(RescheduleSettings settings) {
        this.settings = settings;
    }

    @PlanningScore(bendableHardLevelsSize = HARD_LEVELS, bendableSoftLevelsSize = SOFT_LEVELS)
    public BendableLongScore getScore() {
        return score;
    }

    public void setScore(BendableLongScore score) {
        this.score = score;
    }
}
