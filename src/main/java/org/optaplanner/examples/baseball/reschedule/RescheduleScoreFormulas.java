package org.optaplanner.examples.baseball.reschedule;

import java.util.List;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.examples.baseball.domain.Team;
import org.optaplanner.examples.baseball.score.ScoreFormulas;

/**
 * 재편성 점수 계산식. 채점기({@link RescheduleEasyScoreCalculator}), 결과의 평가 숫자, 서버 채점이 모두 이것을 쓴다.
 * 브라우저 {@code ui/core/reschedule.js}가 같은 사례에서 같은 값을 내야 한다(golden). 거리는 0.1km 정수.
 * <p>
 * 재편성 부분의 이동은 경기한 날마다 직전 경기 구장에서 그날 구장까지 센다. 3일 이상 쉬어도 0km로 보지 않는다(요구 §6, 결정 15).
 * 그날 구장 = 그 구단의 그날 경기 중 id가 가장 작은 경기의 홈 구장(규칙을 지킨 일정에서는 하나뿐이다).
 */
public final class RescheduleScoreFormulas {

    private RescheduleScoreFormulas() {
    }

    /** 한 번 채점한 모든 값. 배열은 Team.getIndex() 순. */
    public static final class Totals {
        public long ruleViolations;
        public long unplaced;
        /** 점수 단계 값({@link RescheduleSettings#LAST_DAY} 등의 자리), 모두 0 이상의 벌점. */
        public final long[] levelPenalty = new long[RescheduleSettings.LEVELS];
        public long[] lastDay;
        public long[] moves;
        public long[] distanceTenths;
        public long[] addedTenths;
        public long[] addedMoves;
        public int[] doubleHeaders;
        public long mondayGames;
        public long doubleHeaderTotal;
        public long addedTenthsTotal;
    }

    public static BendableLongScore evaluate(RescheduleSolution solution) {
        return score(totals(solution), solution.getSettings());
    }

    public static BendableLongScore score(Totals t, RescheduleSettings settings) {
        long[] soft = new long[RescheduleSettings.LEVELS];
        for (int level = 0; level < soft.length; level++) {
            soft[level] = -t.levelPenalty[settings.levelAt(level)];
        }
        return BendableLongScore.of(new long[] {-t.ruleViolations, -t.unplaced}, soft);
    }

    public static Totals totals(RescheduleSolution solution) {
        List<Team> teams = solution.getTeamList();
        List<RDay> days = solution.getDayList();
        List<RGame> games = solution.getGameList();
        RescheduleSettings st = solution.getSettings();
        int teamCount = teams.size();
        int dayCount = days.size();
        int[][] count = new int[teamCount][dayCount];
        RGame[][] first = new RGame[teamCount][dayCount];
        RGame[][] second = new RGame[teamCount][dayCount];
        // 날마다 구장별 대진(홈*구단수+원정)과 대진별 경기 수
        int stadiumCount = 0;
        for (Team team : teams) {
            stadiumCount = Math.max(stadiumCount, team.getStadiumIndex() + 1);
        }
        int[][] stadiumMatchup = new int[stadiumCount][dayCount];
        int[][] stadiumMatchupCount = new int[stadiumCount][dayCount];
        long stadiumExtra = 0L;
        Totals t = new Totals();
        int[][] matchupDayCount = new int[teamCount * teamCount][];
        for (RGame game : games) {
            RDay day = game.getDay();
            if (day == null) {
                t.unplaced++;
                continue;
            }
            int d = day.getIndex();
            if (day.isMonday()) {
                t.mondayGames++;
            }
            int h = game.getHome().getIndex();
            int a = game.getAway().getIndex();
            for (int team : new int[] {h, a}) {
                int c = count[team][d]++;
                if (c == 0 || game.getId() < first[team][d].getId()) {
                    if (c > 0) {
                        second[team][d] = first[team][d];
                    }
                    first[team][d] = game;
                } else if (c == 1 || game.getId() < second[team][d].getId()) {
                    second[team][d] = game;
                }
            }
            int matchup = h * teamCount + a;
            int[] perDay = matchupDayCount[matchup];
            if (perDay == null) {
                perDay = matchupDayCount[matchup] = new int[dayCount];
            }
            perDay[d]++;
            int s = game.getHome().getStadiumIndex();
            if (perDay[d] == 1) {
                // 이 대진이 이날 처음: 구장에 다른 대진이 있으면 위반
                if (stadiumMatchupCount[s][d] > 0) {
                    stadiumExtra++;
                }
                stadiumMatchupCount[s][d]++;
                stadiumMatchup[s][d] = matchup;
            }
        }
        for (int[] perDay : matchupDayCount) {
            if (perDay != null) {
                for (int n : perDay) {
                    if (n > 1) {
                        t.doubleHeaderTotal += n - 1;
                    }
                }
            }
        }
        long violations = stadiumExtra;
        t.lastDay = new long[teamCount];
        t.moves = new long[teamCount];
        t.distanceTenths = new long[teamCount];
        t.addedTenths = new long[teamCount];
        t.addedMoves = new long[teamCount];
        t.doubleHeaders = new int[teamCount];
        List<TeamHistory> histories = solution.getHistoryList();
        int maxRun = st.getMaxConsecutiveDays();
        for (int team = 0; team < teamCount; team++) {
            TeamHistory history = histories.get(team);
            int run = history.runAtStart();
            int prev = history.startLocation();
            long added = 0L;
            long moves = 0L;
            int dh = 0;
            int lastIndex = -1;
            for (int d = 0; d < dayCount; d++) {
                int c = count[team][d];
                if (c == 0) {
                    run = 0;
                    continue;
                }
                if (c == 2 && first[team][d].sameMatchup(second[team][d])) {
                    dh++;
                } else if (c >= 2) {
                    violations += c - 1;
                    dh += c - 1;
                }
                run++;
                if (run > maxRun) {
                    violations++;
                }
                lastIndex = d;
                Team location = first[team][d].getHome();
                if (prev >= 0) {
                    added += teams.get(prev).getDistanceTenthsTo(location.getIndex());
                    if (teams.get(prev).getStadiumIndex() != location.getStadiumIndex()) {
                        moves++;
                    }
                }
                prev = location.getIndex();
            }
            int dhTotal = dh + history.doubleHeadersUsed();
            if (dhTotal > st.getMaxDoubleHeaders()) {
                violations += dhTotal - st.getMaxDoubleHeaders();
            }
            t.doubleHeaders[team] = dh;
            t.addedTenths[team] = added;
            t.addedMoves[team] = moves;
            t.addedTenthsTotal += added;
            t.moves[team] = history.baseMoves() + moves;
            t.distanceTenths[team] = history.baseDistanceTenths() + added;
            t.lastDay[team] = lastIndex >= 0 ? days.get(lastIndex).getEpochDay() : history.lastPlayedEpochDay();
        }
        t.ruleViolations = violations;
        t.levelPenalty[RescheduleSettings.LAST_DAY] = lastDayPenalty(t.lastDay, st.getLastDayToleranceDays());
        t.levelPenalty[RescheduleSettings.FAIR_MOVES] = ScoreFormulas.scaledGapPenalty(t.moves, st.getMoveGap());
        t.levelPenalty[RescheduleSettings.FAIR_DISTANCE] =
                ScoreFormulas.distanceGapPenalty(t.distanceTenths, st.getDistanceGapTenths());
        t.levelPenalty[RescheduleSettings.ADDED_DISTANCE] = t.addedTenthsTotal;
        t.levelPenalty[RescheduleSettings.MONDAY] = t.mondayGames;
        t.levelPenalty[RescheduleSettings.DOUBLE_HEADER] = t.doubleHeaderTotal;
        return t;
    }

    /**
     * 구단 쌍마다 마지막 경기일 차이가 허용 일수를 넘은 만큼의 제곱 합. 0이면 「가장 늦게 − 가장 먼저 ≤ 허용」이다.
     * 경기가 하나도 없는 구단({@link TeamHistory#NO_DAY})은 뺀다.
     */
    public static long lastDayPenalty(long[] lastDay, int toleranceDays) {
        long sum = 0L;
        for (int i = 0; i < lastDay.length; i++) {
            if (lastDay[i] == TeamHistory.NO_DAY) {
                continue;
            }
            for (int j = i + 1; j < lastDay.length; j++) {
                if (lastDay[j] == TeamHistory.NO_DAY) {
                    continue;
                }
                long excess = Math.abs(lastDay[i] - lastDay[j]) - toleranceDays;
                if (excess > 0) {
                    sum += excess * excess;
                }
            }
        }
        return sum;
    }

    /** 가장 늦게 끝나는 구단과 가장 먼저 끝나는 구단의 차이(일). */
    public static long lastDaySpread(long[] lastDay) {
        long min = Long.MAX_VALUE;
        long max = Long.MIN_VALUE;
        for (long day : lastDay) {
            if (day != TeamHistory.NO_DAY) {
                min = Math.min(min, day);
                max = Math.max(max, day);
            }
        }
        return min == Long.MAX_VALUE ? 0L : max - min;
    }
}
