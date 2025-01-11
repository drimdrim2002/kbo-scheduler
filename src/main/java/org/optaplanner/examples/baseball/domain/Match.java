package org.optaplanner.examples.baseball.domain;


import java.util.Objects;
import org.optaplanner.core.api.domain.entity.PlanningEntity;
import org.optaplanner.core.api.domain.entity.PlanningPin;
import org.optaplanner.core.api.domain.variable.PlanningVariable;
import org.optaplanner.examples.common.domain.AbstractPersistable;

@PlanningEntity
public class Match extends AbstractPersistable {

    private Team home;
    private Team away;
    private int consecutive;
    private boolean pinned;

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

    @PlanningVariable(valueRangeProviderRefs = {"calendarRange"})
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

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Match match = (Match) o;
        return consecutive == match.consecutive && pinned == match.pinned && Objects.equals(home, match.home)
            && Objects.equals(away, match.away) && Objects.equals(calendar, match.calendar);
    }

    @Override
    public int hashCode() {
        return Objects.hash(home, away, consecutive, pinned, calendar);
    }
}
