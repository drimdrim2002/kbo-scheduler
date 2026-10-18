package org.optaplanner.examples.baseball.domain;


import java.util.List;
import org.optaplanner.core.api.domain.entity.PlanningEntity;
import org.optaplanner.core.api.domain.entity.PlanningPin;
import org.optaplanner.core.api.domain.valuerange.ValueRangeProvider;
import org.optaplanner.core.api.domain.variable.PlanningVariable;
import org.optaplanner.examples.common.domain.AbstractPersistable;

@PlanningEntity
public class Match extends AbstractPersistable {
    private Team home;
    private Team away;
    private int consecutive;
    private boolean pinned;
    private List<Calendar> possibleCalendars;

    // planning variable
    private Calendar calendar;


    public Match() {

    }

    public Match(long id, Team home, Team away, int consecutive) {
        super(id);
        this.home = home;
        this.away = away;
        this.consecutive = consecutive;
    }

    @PlanningPin
    public boolean isPinned() {
        return pinned;
    }

    public void setPinned(boolean pinned) {
        this.pinned = pinned;
    }



    public Team getHome() {
        return home;
    }

    public void setHome(Team home) {
        this.home = home;
    }

    public Team getAway() {
        return away;
    }

    public void setAway(Team away) {
        this.away = away;
    }

    public int getConsecutive() {
        return consecutive;
    }

    public void setConsecutive(int consecutive) {
        this.consecutive = consecutive;
    }

    /**
     * Regular slots whose series length equals this match. Swap and pillar-swap moves reject a
     * destination outside this range, so a 3-game series cannot land on the 2-game or 4-game slot.
     */
    @ValueRangeProvider(id = "matchCalendarRange")
    public List<Calendar> getPossibleCalendars() {
        return possibleCalendars;
    }

    public void setPossibleCalendars(List<Calendar> possibleCalendars) {
        this.possibleCalendars = possibleCalendars;
    }

    @PlanningVariable(valueRangeProviderRefs = {"matchCalendarRange"})
    public Calendar getCalendar() {
        return calendar;
    }

    public void setCalendar(Calendar calendar) {
        this.calendar = calendar;
    }

    @Override
    public String toString() {
        return "Match{" +
                "home=" + home +
                ", away=" + away +
                ", consecutive=" + consecutive +
                '}';
    }
}
