package org.optaplanner.examples.baseball.reschedule;

import java.time.DayOfWeek;
import java.time.LocalDate;
import org.optaplanner.examples.common.domain.AbstractPersistable;

/** 재편성 기간의 날 하나. id = index = 기간 첫날부터 0, 1, 2… 월요일도 뺄 수 없다(월요일은 Soft로만 줄인다). */
public final class RDay extends AbstractPersistable {

    private final int index;
    private final LocalDate date;
    private final long epochDay;
    private final boolean monday;

    public RDay(int index, LocalDate date) {
        super(index);
        this.index = index;
        this.date = date;
        this.epochDay = date.toEpochDay();
        this.monday = date.getDayOfWeek() == DayOfWeek.MONDAY;
    }

    public int getIndex() {
        return index;
    }

    public LocalDate getDate() {
        return date;
    }

    public long getEpochDay() {
        return epochDay;
    }

    public boolean isMonday() {
        return monday;
    }

    @Override
    public String toString() {
        return date.toString();
    }
}
