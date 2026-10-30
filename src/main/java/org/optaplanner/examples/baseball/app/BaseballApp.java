package org.optaplanner.examples.baseball.app;

import java.util.Map.Entry;
import org.apache.poi.xssf.usermodel.XSSFCell;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.optaplanner.core.api.solver.Solver;
import org.optaplanner.core.api.solver.SolverFactory;
import org.optaplanner.examples.baseball.domain.*;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.solver.BaseballSolutionInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.Month;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.IntStream;

public class BaseballApp {

    public static final String DATA_DIR_NAME = "baseball";
    private static final Logger logger = LoggerFactory.getLogger(BaseballApp.class);
    private static final DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public static void main(String[] args) {

        try {
            // 데이터 읽기
            JSONObject jsonObject = readJsonFile();

            // solution 만들기
            BaseballSolution unsolvedSolution = makeSolution(jsonObject);

            // initialPlan 순서를 쓰지 않는 Hard 0/0 초기해
            BaseballSolutionInitializer.initialize(unsolvedSolution);

            exportResult(unsolvedSolution, false);

            // solving
            SolverFactory<BaseballSolution> solverFactory = SolverFactory.createFromXmlResource(
                "org/optaplanner/examples/baseball/solver/baseballSolverConfig.xml");
            Solver<BaseballSolution> solver = solverFactory.buildSolver();
            BaseballSolution solvedSolution = solver.solve(unsolvedSolution);

            // export result
            exportResult(solvedSolution, true);

        } catch (Exception e) {
            e.printStackTrace();
            logger.error(e.getMessage());
        }


    }

    private static void exportResult(BaseballSolution baseballSolution, boolean solved) {
        String status = solved ? "solved" : "unsolved";

        exportExcelFile(baseballSolution, status);


    }

    private static void exportExcelFile(BaseballSolution baseballSolution, String status) {

        XSSFWorkbook workbook = createWorkBook(baseballSolution);

        createExcelFile(status, workbook);
    }

    private static void createExcelFile(String status, XSSFWorkbook workbook) {
        long currentMilliseconds = System.currentTimeMillis();
        String fileName = status + "_" + String.valueOf(currentMilliseconds).substring(0, 10);
        logger.info("fileName: " + fileName);
        File file = new File("data/baseball/" + status + "/" + fileName + ".xlsx");
        FileOutputStream fos = null;
        try {
            fos = new FileOutputStream(file);
            workbook.write(fos);
        } catch (FileNotFoundException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            try {
                if (workbook != null) {
                    workbook.close();
                }
                if (fos != null) {
                    fos.close();
                }

            } catch (IOException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }
        }
    }

    private static XSSFWorkbook createWorkBook(BaseballSolution baseballSolution) {

        TreeMap<LocalDateTime, List<Match>> matchResultsOrderByTime = createMatchResultsOrderByTime(baseballSolution);

        // 워크북 생성
        XSSFWorkbook workbook = new XSSFWorkbook();

        createScheduleSheet(matchResultsOrderByTime, workbook);

        createDistanceAnalysisSheet(matchResultsOrderByTime, workbook);

        createHolidayAnalysis(baseballSolution, workbook);

        createHolidayDetails(baseballSolution, workbook);

        return workbook;
    }

    private static void createHolidayDetails(BaseballSolution baseballSolution, XSSFWorkbook workbook) {
        HashMap<String, Integer> holidayScoreByTeam = new HashMap<>();
        HashMap<String, Integer> childrenSDaysByTeam = new HashMap<>();
        HashMap<String, Integer> weekendByTeam = new HashMap<>();
        HashMap<String, Integer> holidayByTeam = new HashMap<>();
        for (Match match : baseballSolution.getMatchList()) {
            Team homeTeam = match.getHome();
            Calendar calendar = match.getCalendar();
            boolean holiday = calendar.getHoliday() > 0;
            if (holiday) {
                int prevQty = holidayScoreByTeam.getOrDefault(homeTeam.getName(), 0);
                holidayScoreByTeam.put(homeTeam.getName(), prevQty + calendar.getHoliday());

                if (calendar.getStartTime().getMonth().equals(Month.MAY)
                    && calendar.getStartTime().getDayOfMonth() == 5) {
                    childrenSDaysByTeam.put(homeTeam.getName(), 1);
                }

                if (calendar.getWeekend() > 0) {
                    int weekendQty = weekendByTeam.getOrDefault(homeTeam.getName(), 0);
                    weekendByTeam.put(homeTeam.getName(), weekendQty + calendar.getWeekend() * 2);

                } else {
                    int holidayQty = holidayByTeam.getOrDefault(homeTeam.getName(), 0);
                    holidayByTeam.put(homeTeam.getName(), holidayQty + 1);
                }
            }
        }

        // 워크시트 생성
        XSSFSheet sheet = workbook.createSheet("holidayDetails");
        // 행 생성
        XSSFRow row = sheet.createRow(0);
        // 쎌 생성
        XSSFCell cell;
        // 헤더 정보 구성
        cell = row.createCell(0);
        cell.setCellValue("team");

        cell = row.createCell(1);
        cell.setCellValue("holidayType");

        cell = row.createCell(2);
        cell.setCellValue("count");

        int rowIndex = 0;

        for (Entry<String, Integer> stringIntegerEntry : holidayScoreByTeam.entrySet()) {
            String teamName = stringIntegerEntry.getKey();

//            rowIndex = createHolidayDetailRow(sheet, rowIndex, teamName, "HolidayCount", holidayScoreByTeam);

            rowIndex = createHolidayDetailRow(sheet, rowIndex, teamName, "Children's day", childrenSDaysByTeam);

            rowIndex = createHolidayDetailRow(sheet, rowIndex, teamName, "Weekend", weekendByTeam);

            rowIndex = createHolidayDetailRow(sheet, rowIndex, teamName, "Holiday", holidayByTeam);


        }

    }

    private static int createHolidayDetailRow(XSSFSheet sheet, int rowIndex, String teamName, String columnName,
        HashMap<String, Integer> holidayCountByTeam) {

        if (!holidayCountByTeam.containsKey(teamName)) {
            return rowIndex;
        }

        rowIndex += 1;
        XSSFRow row = sheet.createRow(rowIndex);

        XSSFCell cell = row.createCell(0);
        cell.setCellValue(teamName);

        cell = row.createCell(1);
        cell.setCellValue(columnName);

        cell = row.createCell(2);
        cell.setCellValue(holidayCountByTeam.get(teamName));

        return rowIndex;
    }

    private static void createHolidayAnalysis(BaseballSolution baseballSolution, XSSFWorkbook workbook) {
        HashMap<String, Integer> holidayByTeam = new HashMap<>();
        for (Match match : baseballSolution.getMatchList()) {
            Team homeTeam = match.getHome();
            Calendar calendar = match.getCalendar();
            boolean holiday = calendar.getHoliday() > 0;
            if (holiday) {
                int prevQty = holidayByTeam.getOrDefault(homeTeam.getName(), 0);
                holidayByTeam.put(homeTeam.getName(), prevQty + calendar.getHoliday());
            }
        }

        // 워크시트 생성
        XSSFSheet sheet = workbook.createSheet("holidayAnalysis");
        // 행 생성
        XSSFRow row = sheet.createRow(0);
        // 쎌 생성
        XSSFCell cell;
        // 헤더 정보 구성
        cell = row.createCell(0);
        cell.setCellValue("team");

        cell = row.createCell(1);
        cell.setCellValue("holidayCount");

        int rowIndex = 1;
        for (String team : holidayByTeam.keySet()) {
            row = sheet.createRow(rowIndex);
            // 헤더 정보 구성
            cell = row.createCell(0);
            cell.setCellValue(team);

            cell = row.createCell(1);
            cell.setCellValue(holidayByTeam.get(team));
            rowIndex++;
        }
    }

    private static TreeMap<LocalDateTime, List<Match>> createMatchResultsOrderByTime(
        BaseballSolution baseballSolution) {
        TreeMap<LocalDateTime, List<Match>> matchResultsOrderByTime = new TreeMap<>();
        for (Match match : baseballSolution.getMatchList()) {
            LocalDateTime localDateTime = match.getCalendar().getStartTime();
            if (!matchResultsOrderByTime.containsKey(localDateTime)) {
                matchResultsOrderByTime.put(localDateTime, new ArrayList<>());
            }
            matchResultsOrderByTime.get(localDateTime).add(match);
        }
        return matchResultsOrderByTime;
    }

    private static void createDistanceAnalysisSheet(TreeMap<LocalDateTime, List<Match>> matchResultsOrderByTime,
        XSSFWorkbook workbook) {
        HashMap<Team, Queue<Match>> visitOrderByTeam = new HashMap<>();
        for (LocalDateTime startTIme : matchResultsOrderByTime.keySet()) {
            for (Match match : matchResultsOrderByTime.get(startTIme)) {
                if (!visitOrderByTeam.containsKey(match.getHome())) {
                    visitOrderByTeam.put(match.getHome(), new LinkedList<>());
                }
                visitOrderByTeam.get(match.getHome()).add(match);
                if (!visitOrderByTeam.containsKey(match.getAway())) {
                    visitOrderByTeam.put(match.getAway(), new LinkedList<>());
                }
                visitOrderByTeam.get(match.getAway()).add(match);
            }
        }
        // 워크시트 생성
        XSSFSheet sheet = workbook.createSheet("distanceAnalysis");
        // 행 생성
        XSSFRow row = sheet.createRow(0);
        // 쎌 생성
        XSSFCell cell;
        // 헤더 정보 구성
        cell = row.createCell(0);
        cell.setCellValue("team");

        cell = row.createCell(1);
        cell.setCellValue("home/away");

        cell = row.createCell(2);
        cell.setCellValue("opposite");

        cell = row.createCell(3);
        cell.setCellValue("distance");

        cell = row.createCell(4);
        cell.setCellValue("totalDistance");

        cell = row.createCell(5);
        cell.setCellValue("matchDate");

        cell = row.createCell(6);
        cell.setCellValue("dayOfWeek");

        cell = row.createCell(7);
        cell.setCellValue("weekdayOrWeekend");

        cell = row.createCell(8);
        cell.setCellValue("path");

        int rowIndex = 1;
        for (Team team : visitOrderByTeam.keySet()) {
            Queue<Match> visitOrder = visitOrderByTeam.get(team);
            BigDecimal totalDistance = BigDecimal.ZERO;
            Team prevTeam = null;
            Match prevMatch = null;
            for (Match match : visitOrder) {

                BigDecimal distanceFromPrevTeam = BigDecimal.ZERO;
                if (prevTeam != null) {
                    distanceFromPrevTeam = prevTeam.getDistanceTo(match.getHome());
                }
                totalDistance = totalDistance.add(distanceFromPrevTeam);

                row = sheet.createRow(rowIndex);
                cell = row.createCell(0);
                cell.setCellValue(team.getName());

                boolean homeMatch = team.equals(match.getHome());
                cell = row.createCell(1);
                cell.setCellValue(homeMatch ? "Home" : "Away");

                Team opposite;
                if (homeMatch) {
                    opposite = match.getAway();
                } else {
                    opposite = match.getHome();
                }

                cell = row.createCell(2);
                cell.setCellValue(opposite.getName());

                cell = row.createCell(3);
                cell.setCellValue(distanceFromPrevTeam.doubleValue());

                cell = row.createCell(4);
                cell.setCellValue(totalDistance.doubleValue());

                cell = row.createCell(5);
                cell.setCellValue(match.getCalendar().getStartTime().toString());

                cell = row.createCell(6);
                cell.setCellValue(match.getCalendar().getStartTime().getDayOfWeek().toString());

                cell = row.createCell(7);
                String weekdayOrWeekend = "주말 이동";
                if (prevMatch != null) {
                    LocalDateTime prevDate = prevMatch.getCalendar().getStartTime();
                    if (prevDate.getDayOfWeek().equals(DayOfWeek.TUESDAY)) {
                        weekdayOrWeekend = "주중 이동";
                    }
                } else {
                    weekdayOrWeekend = "주중 이동";
                }

                cell.setCellValue(weekdayOrWeekend);

                cell = row.createCell(8);

                String to = match.getHome().getStadium();
                if (prevMatch != null) {
                    String from = prevMatch.getHome().getStadium();
                    cell.setCellValue(from + "-->" + to);
                } else {
                    cell.setCellValue(to + "-->" + to);
                }

                prevTeam = match.getHome();
                prevMatch = match;

                rowIndex++;
            }
        }
    }


    private static void createScheduleSheet(TreeMap<LocalDateTime, List<Match>> matchResultsOrderByTime,
        XSSFWorkbook workbook) {
        XSSFSheet scheduleSheet = workbook.createSheet("schedule");
        // 행 생성
        XSSFRow row = scheduleSheet.createRow(0);
        // 쎌 생성
        XSSFCell cell;

        // 헤더 정보 구성
        cell = row.createCell(0);
        cell.setCellValue("date");

        cell = row.createCell(1);
        cell.setCellValue("home");

        cell = row.createCell(2);
        cell.setCellValue("away");

        cell = row.createCell(3);
        cell.setCellValue("stadium");

        cell = row.createCell(4);
        cell.setCellValue("matches");

        cell = row.createCell(5);
        cell.setCellValue("holiday score");

        cell = row.createCell(6);
        cell.setCellValue("children's day");

        cell = row.createCell(7);
        cell.setCellValue("weekend");

        cell = row.createCell(8);
        cell.setCellValue("holiday");

        int rowIndex = 1;
        for (LocalDateTime startTime : matchResultsOrderByTime.keySet()) {
            for (Match match : matchResultsOrderByTime.get(startTime)) {
                row = scheduleSheet.createRow(rowIndex);
                cell = row.createCell(0);
                cell.setCellValue(startTime.toLocalDate().toString());

//                logger.info(match.toString());
                cell = row.createCell(1);
                cell.setCellValue(match.getHome().getName());

                cell = row.createCell(2);
                cell.setCellValue(match.getAway().getName());

                cell = row.createCell(3);
                cell.setCellValue(match.getHome().getStadium());

                cell = row.createCell(4);
                cell.setCellValue(match.getConsecutive());

                cell = row.createCell(5);
//                boolean holiday = match.getCalendar().getHoliday() > 0 ? true : false;
                cell.setCellValue(match.getCalendar().getHoliday());

                cell = row.createCell(6);
                Calendar calendar = match.getCalendar();
                if (calendar.getStartTime().getMonth() == Month.MAY && calendar.getStartTime().getDayOfMonth() == 5) {
                    cell.setCellValue(2);
                } else {
                    cell.setCellValue(0);
                }

                cell = row.createCell(7);
                if (calendar.getWeekend() > 0) {
                    cell.setCellValue(2);
                } else {
                    cell.setCellValue(0);
                }

                cell = row.createCell(8);
                if (calendar.getHoliday() > 0 && calendar.getWeekend() == 0) {
                    cell.setCellValue(calendar.getHoliday());
                } else {
                    cell.setCellValue(0);

                }
                rowIndex++;
            }
        }
    }

    public static void setInitialPlan(JSONObject jsonObject, BaseballSolution unsolvedSolution) {
        JSONArray initialPlanArray = (JSONArray) jsonObject.get("initialPlan");
        HashMap<String, Queue<Match>> matchHashMap = new HashMap<>();
        for (Match match : unsolvedSolution.getMatchList()) {
            String home = match.getHome().getName();
            String away = match.getAway().getName();
            String consecutive = String.valueOf(match.getConsecutive());
            String key = home + away + consecutive;
            if (!matchHashMap.containsKey(key)) {
                matchHashMap.put(key, new LinkedList<>());
            }
            matchHashMap.get(key).add(match);
        }

        HashMap<LocalDateTime, Calendar> calendarHashMap = new HashMap<>();
        for (Calendar calendar : unsolvedSolution.getCalendarList()) {
            LocalDateTime startTIme = calendar.getStartTime();
            calendarHashMap.put(startTIme, calendar);
        }

        for (Object o : initialPlanArray) {

            JSONObject initialPlanInfo = (JSONObject) o;
            LocalDateTime datetime = LocalDateTime.parse((String) initialPlanInfo.get("datetime"), formatter);
            String home = initialPlanInfo.get("home").toString();
            String away = initialPlanInfo.get("away").toString();
            String consecutive = initialPlanInfo.get("consecutive").toString();
            String key = home + away + consecutive;

            Match match = matchHashMap.get(key).poll();
            if (match != null) {
                Calendar calendar = calendarHashMap.get(datetime);
                match.setCalendar(calendar);
                LocalDateTime matchStartTime = calendar.getStartTime();
                boolean isFirstDay = matchStartTime.toString().contains(Constants.MATCH_START_DATE);
                if (isFirstDay) { // 개막전 고정
                    match.setPinned(true);
                    logger.info("initial plan fixed: " + initialPlanInfo);
                }
//                } else if (matchStartTime.getMonth().equals(Month.MAY)
//                    && matchStartTime.getDayOfMonth() == 5) { // 어린이날 고정
//                    match.setPinned(true);
//                    logger.info(initialPlanInfo.toString());
//
//                }
            }
        }
    }

    public static BaseballSolution makeSolution(JSONObject jsonObject) {
        HashMap<String, HashMap<String, BigDecimal>> totalDistanceMap = makeDistanceMatrix(jsonObject);

        HashMap<String, Team> teamHashMap = makeTeamInfo(jsonObject, totalDistanceMap);
        List<Team> teamList = Team.prepareIndices(teamHashMap.values());

        List<Match> matchList = makeMatchInfo(jsonObject, teamHashMap);

        List<Calendar> calendarList = new ArrayList<>();
        JSONArray periodArray = (JSONArray) jsonObject.get("calendar");
        Calendar prev = null;
        for (int i = 0; i < periodArray.size(); i++) {
            JSONObject calendarInfo = (JSONObject) periodArray.get(i);
            LocalDateTime startTime =
                LocalDateTime.parse(calendarInfo.get("datetime").toString(), formatter);
            long consecutive = (Long) calendarInfo.get("consecutive");
            Long holiday = (Long) calendarInfo.get("holiday");
            Long weekend = (Long) calendarInfo.get("weekend");

            Calendar period = new Calendar(i, startTime, (int) consecutive, weekend.intValue(), holiday.intValue());
            period.setPrev(prev);
            calendarList.add(period);
            prev = period;
        }
        LocalDateTime lastDate = LocalDateTime.parse(Constants.PLAN_END_TIME, formatter);
        Calendar dummy = new Calendar(9999L, lastDate, 0, 0, 0);
        dummy.setPrev(calendarList.get(calendarList.size() - 1));
        calendarList.add(dummy);

        for (Calendar period : calendarList) {
            if (period.getPrev() != null) {
                period.getPrev().setNext(period);
            }
        }
        assignPossibleCalendars(matchList, calendarList);

        BaseballSolution baseballSolution = new BaseballSolution();
        baseballSolution.setMatchList(matchList);
        baseballSolution.setCalendarList(calendarList);
        baseballSolution.setId(0L);
        baseballSolution.setTeamList(teamList);
        // 홈 구장 지정이 따로 없으면 예전대로 어린이날 기본 홈 구단. 웹은 ProblemCodec이 events로 다시 정한다
        HomeObligations.applyChildrenDay(teamList, calendarList, Constants.HOME_OBLIGATION_CHILDREN);

        return baseballSolution;
    }

    private static void assignPossibleCalendars(List<Match> matchList, List<Calendar> calendarList) {
        Map<Integer, List<Calendar>> byLength = new HashMap<>();
        for (Calendar calendar : calendarList) {
            if (!calendar.isRegular()) {
                continue;
            }
            byLength.computeIfAbsent(calendar.getConsecutive(), key -> new ArrayList<>()).add(calendar);
        }
        byLength.replaceAll((length, calendars) -> List.copyOf(calendars));
        for (Match match : matchList) {
            List<Calendar> possible = byLength.get(match.getConsecutive());
            if (possible == null || possible.isEmpty()) {
                throw new IllegalArgumentException("no regular slot of length " + match.getConsecutive());
            }
            match.setPossibleCalendars(possible);
        }
    }

    private static List<Match> makeMatchInfo(JSONObject jsonObject, HashMap<String, Team> teamHashMap) {
        List<Match> matchList = new ArrayList<>();
        JSONArray matchJsonArray = (JSONArray) jsonObject.get("matches");
        IntStream.range(0, matchJsonArray.size()).forEach(i -> {
            JSONObject matchInfo = (JSONObject) matchJsonArray.get(i);
            Team homeTeam = teamHashMap.get(matchInfo.get("home"));
            Team awayTeam = teamHashMap.get(matchInfo.get("away"));
            long consecutive = (Long) matchInfo.get("consecutive");
            Match match = new Match(i, homeTeam, awayTeam, (int) consecutive);
            matchList.add(match);
        });
        // JSON match order follows initialPlan. Sort so later consumers do not inherit that order.
        matchList.sort(Comparator
                .comparingInt(Match::getConsecutive)
                .thenComparingInt(match -> match.getHome().getIndex())
                .thenComparingInt(match -> match.getAway().getIndex())
                .thenComparingLong(match -> match.getId()));
        return matchList;
    }

    private static HashMap<String, Team> makeTeamInfo(JSONObject jsonObject,
        HashMap<String, HashMap<String, BigDecimal>> totalDistanceMap) {
        HashMap<String, Team> teamHashMap = new HashMap<>();
        JSONArray teamJsonArray = (JSONArray) jsonObject.get("teams");
        IntStream.range(0, teamJsonArray.size()).forEach(i -> {
            JSONObject teamInfo = (JSONObject) teamJsonArray.get(i);
            String name = (String) teamInfo.get("name");
            String stadium = (String) teamInfo.get("stadium");
            Set<String> toSet = totalDistanceMap.get(name).keySet();
            HashMap<String, BigDecimal> distanceTo = new HashMap<>();
            for (String to : toSet) {
                BigDecimal distance = totalDistanceMap.get(name).get(to);
                distanceTo.put(to, distance);
            }
            Team team = new Team(i, name, stadium, distanceTo);
            teamHashMap.put(name, team);
        });
        return teamHashMap;
    }

    private static HashMap<String, HashMap<String, BigDecimal>> makeDistanceMatrix(JSONObject jsonObject) {
        HashMap<String, HashMap<String, BigDecimal>> totalDistanceMap = new HashMap<>();
        JSONArray distanceMatrixArray = (JSONArray) jsonObject.get("distanceMatrix");
        for (Object o : distanceMatrixArray) {
            JSONObject distanceInfo = (JSONObject) o;
            String from = (String) distanceInfo.get("from");
            String to = (String) distanceInfo.get("to");
            BigDecimal distance = BigDecimal.valueOf((Double) distanceInfo.get("distance"));
            if (!totalDistanceMap.containsKey(from)) {
                totalDistanceMap.put(from, new HashMap<>());
            }
            totalDistanceMap.get(from).put(to, distance);
        }
        return totalDistanceMap;
    }

    public static JSONObject readJsonFile() {
        return readJsonFile(Constants.inputFileName);
    }

    public static JSONObject readJsonFile(String path) {
        JSONParser parser = new JSONParser();
        JSONObject jsonObject;
        try {
            Reader reader = new FileReader(path);
//            Reader reader = new FileReader("../../../data/baseball/input.json");
            jsonObject = (JSONObject) parser.parse(reader);

        } catch (Exception e) {
            e.printStackTrace();
            logger.error(e.getMessage());
            throw new IllegalArgumentException("No json file");
        }
        return jsonObject;
    }
}
