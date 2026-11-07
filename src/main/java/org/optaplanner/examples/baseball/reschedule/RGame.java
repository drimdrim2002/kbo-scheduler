package org.optaplanner.examples.baseball.reschedule;

import org.optaplanner.core.api.domain.entity.PlanningEntity;
import org.optaplanner.core.api.domain.entity.PlanningPin;
import org.optaplanner.core.api.domain.variable.PlanningVariable;
import org.optaplanner.examples.baseball.domain.Team;
import org.optaplanner.examples.common.domain.AbstractPersistable;

/**
 * 재편성 경기 하나. 날짜가 비어 있으면(null) 못 넣은 경기다. 같은 홈·원정의 두 경기가 같은 날이면 더블헤더다.
 * id = 해의 경기 목록 위치, key = 화면과 주고받는 경기 이름({@code M:12|2025-07-03}, {@code R:LG-KIA}).
 */
@PlanningEntity
public class RGame extends AbstractPersistable {

    public static final String CANCELLED = "CANCELLED";
    public static final String REMAINING = "REMAINING";

    private String key;
    private Team home;
    private Team away;
    private String source;
    private boolean pinned;
    private RDay day;

    public RGame() {
    }

    public RGame(long id, String key, Team home, Team away, String source) {
        super(id);
        this.key = key;
        this.home = home;
        this.away = away;
        this.source = source;
    }

    public String getKey() {
        return key;
    }

    public Team getHome() {
        return home;
    }

    public Team getAway() {
        return away;
    }

    public String getSource() {
        return source;
    }

    /** 발표한 경기: 날짜를 바꾸지 않는다. */
    @PlanningPin
    public boolean isPinned() {
        return pinned;
    }

    public void setPinned(boolean pinned) {
        this.pinned = pinned;
    }

    @PlanningVariable(valueRangeProviderRefs = "dayRange", nullable = true)
    public RDay getDay() {
        return day;
    }

    public void setDay(RDay day) {
        this.day = day;
    }

    /** 같은 홈·같은 원정인가(더블헤더가 될 수 있는 짝). */
    public boolean sameMatchup(RGame other) {
        return other != null && home == other.home && away == other.away;
    }

    public boolean involves(Team team) {
        return home == team || away == team;
    }

    @Override
    public String toString() {
        return key + "@" + day;
    }
}
