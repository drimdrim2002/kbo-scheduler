package org.optaplanner.examples.baseball.domain;

import java.math.BigDecimal;
import java.time.MonthDay;
import java.util.Arrays;
import java.util.HashSet;

public class Constants {

//    public static String PLAN_END_TIME = "2024-12-31 00:00:00";
//
//    public static String CHILDREN_DAY_START = "2024-05-03";
//    public static String MATCH_START_DATE = "2024-03-23";

    public static String PLAN_END_TIME = "2100-12-31 00:00:00";


    public static final String[] HOME_OBLIGATION_CHILDREN_ARR = {"두산", "키움", "한화", "NC", "롯데"};
    public static final HashSet<String> HOME_OBLIGATION_CHILDREN = new HashSet<>(
        Arrays.asList(HOME_OBLIGATION_CHILDREN_ARR));
    /** 예전 방식(홈 구장 지정이 없을 때)의 어린이날. 시즌 해의 이 날이 든 연전 기간에 기본 홈 구단을 둔다. */
    public static final MonthDay CHILDREN_DAY = MonthDay.of(5, 5);
    public static String MATCH_START_DATE = "2025-03-22";
    public static String inputFileName = "data/baseball/input_2025.json";


    public enum TOLERANCE {
        TOTAL_DISTANCE(300),
        HOLIDAY(1.5),
        WEEKDAY_MOVE(1.5),
        TOTAL_MOVE(2);

        private final double tolerance;

        TOLERANCE(double tolerance) {
            this.tolerance = tolerance;
        }

        public Double toDouble() {
            return Double.valueOf(tolerance);
        }

        public BigDecimal toBigDecimal() {
            return BigDecimal.valueOf(tolerance);
        }
    }
}
