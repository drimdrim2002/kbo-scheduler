package org.optaplanner.examples.baseball.domain;

import org.optaplanner.examples.common.domain.AbstractPersistable;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class Calendar extends AbstractPersistable implements Comparable<Calendar> {

    private LocalDateTime startTime;
    private Calendar next;
    private Calendar prev;
    private int consecutive;
    private int weekend;
    private int holiday;
    private boolean dummy;
    private int slotIndex;
    /** 이 연전 기간에 홈이어야 하는 구단({@link Team#getIndex()} 비트). 0이면 홈 구장 지정이 없다. */
    private int homeObligationMask;
    /** 시작일의 epoch day. 시작일이 없으면 {@link #NO_DAY}. 점수 계산의 쉬는 날 셈이 날마다 날짜 계산을 하지 않게 미리 둔다. */
    private long startDay = NO_DAY;

    public static final long NO_DAY = Long.MIN_VALUE;

    public Calendar(long id, LocalDateTime startTime, int consecutive, int weekend, int holiday) {
        super(id);
        this.startTime = startTime;
        this.consecutive = consecutive;
        this.weekend = weekend;
        this.holiday = holiday;
        refreshPreprocessingFlags();
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
        refreshPreprocessingFlags();
    }

    public Calendar getNext() {
        return next;
    }

    public void setNext(Calendar next) {
        this.next = next;
    }

    public Calendar getPrev() {
        return prev;
    }

    public void setPrev(Calendar prev) {
        this.prev = prev;
    }

    public int getConsecutive() {
        return consecutive;
    }

    public void setConsecutive(int consecutive) {
        this.consecutive = consecutive;
    }

//    public int isWeekend() {
//        return weekend;
//    }

    public void setWeekend(int weekend) {
        this.weekend = weekend;
    }

//    public boolean isHoliday() {
//        return holiday;
//    }

    public void setHoliday(int holiday) {
        this.holiday = holiday;
    }

    public int getWeekend() {
        return weekend;
    }

    public int getHoliday() {
        return holiday;
    }

    public boolean isDummy() {
        return dummy;
    }

    public int getHomeObligationMask() {
        return homeObligationMask;
    }

    public void setHomeObligationMask(int homeObligationMask) {
        this.homeObligationMask = homeObligationMask;
    }

    /** 홈 구장 지정으로 이 연전 기간에 홈이어야 하는 구단인가. */
    public boolean requiresHome(Team team) {
        int index = team.getIndex();
        return homeObligationMask != 0 && index >= 0 && index < Integer.SIZE && (homeObligationMask & (1 << index)) != 0;
    }

    /** 시작일부터 연전 수만큼의 날 안에 date가 드는가(화면 {@code CalendarGen.slotIndexOfDate}와 같은 규칙). */
    public boolean containsDate(LocalDate date) {
        if (startTime == null || date == null || !isRegular()) {
            return false;
        }
        LocalDate start = startTime.toLocalDate();
        return !date.isBefore(start) && date.isBefore(start.plusDays(consecutive));
    }

    /**
     * {@code before} 연전 마지막 날의 다음 날부터 {@code after} 연전 첫날 전날까지 경기가 없는 날 수.
     * 바로 이어지면 0, 월요일 하루 쉬면 1. 어느 쪽이든 시작일이 없거나 순서가 거꾸로면 0.
     */
    public static long restDaysBetween(Calendar before, Calendar after) {
        if (before == null || after == null || before.startDay == NO_DAY || after.startDay == NO_DAY) {
            return 0L;
        }
        return Math.max(0L, after.startDay - (before.startDay + before.consecutive));
    }

    public int getSlotIndex() {
        return slotIndex;
    }

    public boolean isRegular() {
        return !dummy && slotIndex >= 0;
    }

    private void refreshPreprocessingFlags() {
        dummy = id != null && id == 9999L;
        slotIndex = (dummy || id == null) ? -1 : id.intValue();
        startDay = startTime == null ? NO_DAY : startTime.toLocalDate().toEpochDay();
    }

    @Override
    public String toString() {
        return "Calendar{" +
                "startTime=" + startTime +
                ", consecutive=" + consecutive +
                ", weekend=" + weekend +
                ", holiday=" + holiday +
                '}';
    }


    @Override
    public int compareTo(Calendar o) {

        if (this.startTime.isEqual(o.startTime)) {
            return this.id.compareTo(o.id);
        } else {
            return this.startTime.compareTo(o.startTime);
        }

    }
}
