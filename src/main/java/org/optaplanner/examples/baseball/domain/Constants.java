package org.optaplanner.examples.baseball.domain;

import java.math.BigDecimal;
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
    public static String CHILDREN_DAY_START = "2025-05-05";
    public static String MATCH_START_DATE = "2025-03-22";
    public static String inputFileName = "data/baseball/input_2025.json";


    public enum TOLERANCE {
        TOTAL_DISTANCE(500),
        HOLIDAY(1.5),
        WEEKDAY_MOVE(1.5),
        TOTAL_MOVE(2.5);

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
