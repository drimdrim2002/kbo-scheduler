package org.optaplanner.examples.baseball.domain;

import org.optaplanner.examples.common.domain.AbstractPersistable;

import java.time.LocalDateTime;
import java.time.Month;

public class Calendar extends AbstractPersistable implements Comparable<Calendar> {

    private LocalDateTime startTime;
    private Calendar next;
    private Calendar prev;
    private int consecutive;
    private int weekend;
    private int holiday;
    private boolean dummy;
    private int slotIndex;
    private boolean childrenDay;
    private boolean allStarBreakTuesday;

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

    public boolean isChildrenDay() {
        return childrenDay;
    }

    public boolean isAllStarBreakTuesday() {
        return allStarBreakTuesday;
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
        childrenDay = startTime != null
                && startTime.toLocalDate().toString().equals(Constants.CHILDREN_DAY_START);
        allStarBreakTuesday = startTime != null
                && startTime.getMonth() == Month.JULY
                && startTime.getDayOfMonth() == 2;
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
