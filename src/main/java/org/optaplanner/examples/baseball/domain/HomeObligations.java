package org.optaplanner.examples.baseball.domain;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

/**
 * 홈 구장 지정: 연전 기간({@link Calendar})마다 홈이어야 하는 구단. 채점(H0-e)·초기해·탐색은 모두
 * {@link Calendar#getHomeObligationMask()}만 본다. 화면 입력({@code problem.events[]})은 웹 계층이 이 마스크로 바꾼다.
 */
public final class HomeObligations {

    private HomeObligations() {
    }

    /** 구단 이름 → {@link Team#getIndex()} 비트. 모르는 이름은 건너뛴다. */
    public static int maskOf(List<Team> teams, Collection<String> names) {
        int mask = 0;
        for (Team team : teams) {
            if (names.contains(team.getName())) {
                mask |= 1 << team.getIndex();
            }
        }
        return mask;
    }

    /** date가 든 정규 연전 기간. 없으면(휴식일·시즌 밖) null. */
    public static Calendar slotContaining(List<Calendar> calendars, LocalDate date) {
        for (Calendar calendar : calendars) {
            if (calendar != null && calendar.containsDate(date)) {
                return calendar;
            }
        }
        return null;
    }

    public static void clear(List<Calendar> calendars) {
        for (Calendar calendar : calendars) {
            if (calendar != null) {
                calendar.setHomeObligationMask(0);
            }
        }
    }

    /**
     * 예전 방식: 시즌 해(첫 연전 기간의 해)의 어린이날이 든 연전 기간에 names를 홈 의무로 둔다.
     * 어린이날이 경기일이 아니면 아무것도 하지 않는다.
     *
     * @return 의무를 둔 연전 기간, 없으면 null
     */
    public static Calendar applyChildrenDay(List<Team> teams, List<Calendar> calendars, Collection<String> names) {
        clear(calendars);
        LocalDate first = null;
        for (Calendar calendar : calendars) {
            if (calendar != null && calendar.isRegular() && calendar.getStartTime() != null) {
                LocalDate start = calendar.getStartTime().toLocalDate();
                if (first == null || start.isBefore(first)) {
                    first = start;
                }
            }
        }
        if (first == null) {
            return null;
        }
        Calendar children = slotContaining(calendars, Constants.CHILDREN_DAY.atYear(first.getYear()));
        if (children != null) {
            children.setHomeObligationMask(maskOf(teams, names));
        }
        return children;
    }
}
