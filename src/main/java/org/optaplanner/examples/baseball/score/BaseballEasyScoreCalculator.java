package org.optaplanner.examples.baseball.score;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import java.util.TreeMap;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.core.api.score.calculator.EasyScoreCalculator;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Constants;
import org.optaplanner.examples.baseball.domain.Match;
import org.optaplanner.examples.baseball.domain.Team;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class BaseballEasyScoreCalculator implements EasyScoreCalculator<BaseballSolution, BendableLongScore> {

    private static final Logger logger = LoggerFactory.getLogger(BaseballEasyScoreCalculator.class);

    // hard
    // 1. 하루에 팀이 중복되면 안된다.
    // 2. 하루에 stadium이 중복되면 안된다.
    // 3. 동일한 match가 연속될 수 없다.

    // soft
    // 1. match 중 calendar가 null이거나 dummy 인 것을 최소화한다.
    // 2. 휴일 및 주말 평준화
    // 3. home/away 가 연속 3일 허용
    // 4. 거리 평준화
    @Override
    public BendableLongScore calculateScore(BaseballSolution baseballSolution) {
        // initialize score
        int duplicationHardScore = 0; // 하루에 10개 팀이 5경기를 해야 함
        int successiveHardScore = 0; // 동일한 팀과 2연전 불가

        int minimizeShortScore = 0; // short 최소화
        int stabilizeWeekdayDistanceScore = 0;
        int stabilizeDistanceScore = 0; // 거리 균등하게 배분
        int stabilizeHolidayScore = 0; // holiday 균등 배분
        int stabilizeWeekdayMoveScore = 0; // 주중 이동 균등 배분
        int stabilizeTotalMoveScore = 0; // 전체 이동 균등 배분
        int totalDistanceScore = 0; //

        TreeMap<Calendar, List<Match>> matchListByCalendar = makeCalendarListTreeMap(baseballSolution);

        Set<Calendar> calendarSet = matchListByCalendar.keySet();
        HashSet<String> prevMatch = new HashSet<>();
        HashMap<Team, TreeMap<LocalDateTime, Team>> visitOrderByTeam = new HashMap<>();

        for (Calendar calendar : calendarSet) {

            HashSet<String> teamDuplicationCheck = new HashSet<>();
            HashSet<String> stadiumDuplicationCheck = new HashSet<>();
            List<Match> matchList = matchListByCalendar.get(calendar);

            int calendarConsecutive = calendar.getConsecutive();
            for (Match match : matchList) {
                String homeTeam = match.getHome().getName();

                String awayTeam = match.getAway().getName();
                String matchDuplicationKey = homeTeam + awayTeam;
                if (prevMatch.contains(matchDuplicationKey)) {
                    successiveHardScore -= 1;
                }

                teamDuplicationCheck.add(homeTeam);
                teamDuplicationCheck.add(awayTeam);
                stadiumDuplicationCheck.add(match.getHome().getStadium());

                // visit order
                if (!visitOrderByTeam.containsKey(match.getHome())) {
                    visitOrderByTeam.put(match.getHome(), new TreeMap<>());
                }
                visitOrderByTeam.get(match.getHome()).put(match.getCalendar().getStartTime(), match.getHome());

                if (!visitOrderByTeam.containsKey(match.getAway())) {
                    visitOrderByTeam.put(match.getAway(), new TreeMap<>());
                }
                visitOrderByTeam.get(match.getAway()).put(match.getCalendar().getStartTime(), match.getHome());
            }
            prevMatch.clear();
            for (Match match : matchList) {
                String homeTeam = match.getHome().getName();
                String awayTeam = match.getAway().getName();
                prevMatch.add(homeTeam + awayTeam);
                prevMatch.add(awayTeam + homeTeam);

                if (match.getConsecutive() != calendarConsecutive) {
                    duplicationHardScore -= 1; // 2023년에는 2연전이 없으므로 별 문제 없지 않을까?
                }

                boolean isChildrenDay = calendar.getStartTime().toString().contains(Constants.CHILDREN_DAY_START);
                boolean awayTeamMatch = Constants.HOME_OBLIGATION_CHILDREN.contains(awayTeam);
                if (isChildrenDay && awayTeamMatch) { // 어린이날인 경우
                    duplicationHardScore -= 1; // 어린이 날에는 해당 팀은 무조건 홈경기를 해야 한다.
                }
            }

            // 10개 팀이 경기를 해야 한다.
            if (teamDuplicationCheck.size() != 10) {
                int min = Math.min(teamDuplicationCheck.size(), 10);
                int max = Math.max(teamDuplicationCheck.size(), 10);
                duplicationHardScore -= (max - min);
            }

            // 5개 구장에서 경기를 해야 한다.
            if (stadiumDuplicationCheck.size() != 5) {
                int min = Math.min(stadiumDuplicationCheck.size(), 5);
                int max = Math.max(stadiumDuplicationCheck.size(), 5);
                duplicationHardScore -= (max - min);
            }

            // 5 경기를 해야 한다.
            if (matchList.size() != 5) {
                int min = Math.min(matchList.size(), 5);
                int max = Math.max(matchList.size(), 5);
                duplicationHardScore -= (max - min);
            }
        }
        HashMap<Team, Integer> holidayByTeam = new HashMap<>();
        HashMap<Team, Integer> weekdayMoveByTeam = new HashMap<>();
        HashMap<Team, Integer> totalMoveByTeam = new HashMap<>();
        for (Match match : baseballSolution.getMatchList()) {

            if (match.getCalendar() == null || match.getCalendar().getId().equals(9999L)) {
                minimizeShortScore -= 1;
                continue;
            }

            if (match.getCalendar().getHoliday() > 0) {
                int prevQty = holidayByTeam.getOrDefault(match.getHome(), 0);
                holidayByTeam.put(match.getHome(), prevQty + match.getCalendar().getHoliday());
            }
        }

        HashMap<String, BigDecimal> distanceByTeam = new HashMap<>();
        HashMap<String, BigDecimal> weekdayDistanceByMap = new HashMap<>();
        for (Map.Entry<Team, TreeMap<LocalDateTime, Team>> visitOrderEntry : visitOrderByTeam.entrySet()) {
            Team team = visitOrderEntry.getKey();
            TreeMap<LocalDateTime, Team> visitOrders = visitOrderEntry.getValue();
            Team prevTeam = null;
            BigDecimal totalDistance = BigDecimal.ZERO;
            BigDecimal weekdayDistance = BigDecimal.ZERO;
            int weekdayMoveCount = 0;
            int totalMoveCount = 0;
            int consecutive = 1;
            boolean prevIsHome = false; // 처음에는 무엇이 되어도 상관 없다.
            LocalDateTime prevDate = null;
            for (Entry<LocalDateTime, Team> localDateTimeTeamEntry : visitOrders.entrySet()) {
                LocalDateTime localDateTime = localDateTimeTeamEntry.getKey();
                Team visitTeam = localDateTimeTeamEntry.getValue();
                boolean isHome = team.equals(visitTeam);

                if (prevTeam != null) {

                    BigDecimal distance = prevTeam.getDistanceTo(visitTeam);
                    totalDistance = totalDistance.add(distance);

                    if (isHome == prevIsHome) {
                        consecutive++;
                    } else {
                        consecutive = 1;
                    }

                    if (consecutive > 3) { // home 경기를 연속 3번 하지 않는다.
                        duplicationHardScore -= 1;
                    }

                    if (distance.compareTo(BigDecimal.ZERO) > 0) {
                        totalMoveCount += 1;
                        // 주중 이동 여부 판단
                        if (prevDate.getDayOfWeek().equals(DayOfWeek.TUESDAY)) {

                            weekdayDistance = weekdayDistance.add(distance);
                            weekdayMoveCount += 1;
                        }
                    }

                }
                prevIsHome = isHome;
                prevTeam = visitTeam;
                prevDate = localDateTime;
            }

            distanceByTeam.put(team.getName(), totalDistance);
            weekdayDistanceByMap.put(team.getName(), weekdayDistance);
            weekdayMoveByTeam.put(team, weekdayMoveCount);
            totalMoveByTeam.put(team, totalMoveCount);

        }

        // 총 통행 거리 기준으로 score 산출하기
        {
            BigDecimal sumDistance = calculateSumDistance(distanceByTeam);
            BigDecimal meanDistance = sumDistance.divide(BigDecimal.valueOf(10), RoundingMode.DOWN);
            BigDecimal distanceVariance = calculateDistanceVariance(distanceByTeam, meanDistance,
                Constants.TOLERANCE.TOTAL_DISTANCE.toBigDecimal());
            stabilizeDistanceScore -= distanceVariance.intValue();
            totalDistanceScore -= sumDistance.intValue();
        }

        // 주중 통행 거리 기준으로 score 산출하기
        {
            BigDecimal sumDistance = calculateSumDistance(weekdayDistanceByMap);
            BigDecimal meanDistance = sumDistance.divide(BigDecimal.valueOf(10), RoundingMode.DOWN);
            BigDecimal distanceVariance = calculateDistanceVariance(weekdayDistanceByMap, meanDistance,
                Constants.TOLERANCE.WEEKDAY_DISTANCE.toBigDecimal());
            stabilizeWeekdayDistanceScore -= distanceVariance.intValue();

        }

        {
            double holidayVariance = calculateHolidayScore(holidayByTeam);
            stabilizeHolidayScore -= holidayVariance;
        }

        {
            double weekdayVariance = calculateWeekdayScore(weekdayMoveByTeam);
            stabilizeWeekdayMoveScore -= weekdayVariance;
        }

        {
            double totalMoveScore = calculateTotalMoveScore(totalMoveByTeam);
            stabilizeTotalMoveScore -= totalMoveScore;
        }

        return BendableLongScore.of(new long[]{duplicationHardScore, successiveHardScore},
            new long[]{minimizeShortScore, stabilizeWeekdayMoveScore, stabilizeTotalMoveScore, stabilizeHolidayScore,
                stabilizeWeekdayDistanceScore, stabilizeDistanceScore,
                totalDistanceScore});


    }

    private double calculateHolidayScore(HashMap<Team, Integer> holidayByTeam) {
        double meanHolidayCount = 0.0;
        for (Team team : holidayByTeam.keySet()) {
            int holidayCnt = holidayByTeam.get(team);
            meanHolidayCount += holidayCnt;
        }
        meanHolidayCount /= 10;

        double holidayVariance = 0;
        for (Team team : holidayByTeam.keySet()) {
            int holidayCnt = holidayByTeam.get(team);
            double diff = Math.abs(holidayCnt - meanHolidayCount);
            diff /= Constants.TOLERANCE.HOLIDAY.toDouble();
            diff = Math.floor(diff);
            diff = Math.pow(diff, 2);
            holidayVariance += diff;
        }
        return holidayVariance;
    }

    private double calculateWeekdayScore(HashMap<Team, Integer> weekdayCoungByTeam) {
        double meanCount = 0.0;
        for (Team team : weekdayCoungByTeam.keySet()) {
            int holidayCnt = weekdayCoungByTeam.get(team);
            meanCount += holidayCnt;
        }
        meanCount /= 10;

        double variance = 0;
        for (Team team : weekdayCoungByTeam.keySet()) {
            int holidayCnt = weekdayCoungByTeam.get(team);
            double diff = Math.abs(holidayCnt - meanCount);
            diff /= Constants.TOLERANCE.WEEKDAY_MOVE.toDouble();
            diff = Math.floor(diff);
            diff = Math.pow(diff, 2);
            variance += diff;
        }
        return variance;
    }

    private double calculateTotalMoveScore(HashMap<Team, Integer> weekdayCoungByTeam) {
        double meanCount = 0.0;
        for (Team team : weekdayCoungByTeam.keySet()) {
            int holidayCnt = weekdayCoungByTeam.get(team);
            meanCount += holidayCnt;
        }
        meanCount /= 10;

        double variance = 0;
        for (Team team : weekdayCoungByTeam.keySet()) {
            int holidayCnt = weekdayCoungByTeam.get(team);
            double diff = Math.abs(holidayCnt - meanCount);
            diff /= Constants.TOLERANCE.TOTAL_MOVE.toDouble();
            diff = Math.floor(diff);
            diff = Math.pow(diff, 2);
            variance += diff;
        }
        return variance;
    }

    private BigDecimal calculateDistanceVariance(HashMap<String, BigDecimal> distanceByTeam, BigDecimal meanDistance,
        BigDecimal tolerance) {
        BigDecimal distanceVariance = BigDecimal.ZERO;
        for (BigDecimal distance : distanceByTeam.values()) {
            BigDecimal diff = distance.subtract(meanDistance).abs(); // positive, negative에 상관 없이 버림하기 위해서 처리

            BigDecimal penalty = BigDecimal.ZERO;
            if (diff.compareTo(tolerance) > 0) {
                penalty = diff.subtract(tolerance);
            }

            penalty = penalty.pow(2);

            distanceVariance = distanceVariance.add(penalty); // 차이가 클수록 가중치를 더한다.
        }
        return distanceVariance;
    }

    private BigDecimal calculateSumDistance(HashMap<String, BigDecimal> distanceByTeam) {
        BigDecimal sumDistance = BigDecimal.ZERO;
        for (BigDecimal distance : distanceByTeam.values()) {
            sumDistance = sumDistance.add(distance);
        }
        return sumDistance;
    }

    private TreeMap<Calendar, List<Match>> makeCalendarListTreeMap(BaseballSolution baseballSolution) {
        TreeMap<Calendar, List<Match>> matchListByCalendar = new TreeMap();
        for (Match match : baseballSolution.getMatchList()) {
            Calendar calendar = match.getCalendar();

            if (calendar == null) {
                calendar = baseballSolution.getCalendarList()
                    .get(baseballSolution.getCalendarList().size() - 1); //dummy calendar 지정
            }
            if (!matchListByCalendar.containsKey(calendar)) {
                matchListByCalendar.put(calendar, new ArrayList<>());
            }
            matchListByCalendar.get(calendar).add(match);
        }
        return matchListByCalendar;
    }

}
