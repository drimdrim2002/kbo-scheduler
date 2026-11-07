package org.optaplanner.examples.baseball.reschedule;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.optaplanner.examples.baseball.domain.Team;

/**
 * 꼭 지키는 규칙(DH-1·2·4·5)을 어긴 곳을 사람이 읽는 문장으로 늘어놓는다. 서버 채점(/score)의 violations와,
 * 발표한 일정이 이미 규칙을 어길 때의 입력 오류 문장에 쓴다. 브라우저 reschedule.js와 문장까지 같아야 한다(golden).
 */
public final class RuleCheck {

    public record Violation(String code, String team, String from, String to, String text) {
    }

    private RuleCheck() {
    }

    public static List<Violation> violations(RescheduleSolution solution) {
        List<Team> teams = solution.getTeamList();
        List<RDay> days = solution.getDayList();
        RescheduleSettings st = solution.getSettings();
        int teamCount = teams.size();
        int dayCount = days.size();
        List<List<List<RGame>>> byTeamDay = new ArrayList<>();
        for (int t = 0; t < teamCount; t++) {
            List<List<RGame>> row = new ArrayList<>();
            for (int d = 0; d < dayCount; d++) {
                row.add(new ArrayList<>());
            }
            byTeamDay.add(row);
        }
        List<RGame> sorted = new ArrayList<>(solution.getGameList());
        sorted.sort(Comparator.comparing(RGame::getId));
        for (RGame g : sorted) {
            if (g.getDay() != null) {
                byTeamDay.get(g.getHome().getIndex()).get(g.getDay().getIndex()).add(g);
                byTeamDay.get(g.getAway().getIndex()).get(g.getDay().getIndex()).add(g);
            }
        }
        List<Violation> out = new ArrayList<>();
        // DH-1 구단 하루 1경기(더블헤더는 같은 홈·원정 2경기)
        for (int t = 0; t < teamCount; t++) {
            for (int d = 0; d < dayCount; d++) {
                List<RGame> list = byTeamDay.get(t).get(d);
                boolean ok = list.size() <= 1 || (list.size() == 2 && list.get(0).sameMatchup(list.get(1)));
                if (!ok) {
                    String date = iso(days.get(d).getDate());
                    out.add(new Violation("DH-1", teams.get(t).getName(), date, date,
                            teams.get(t).getName() + "이(가) " + label(days.get(d).getDate()) + "에 " + list.size()
                                    + "경기를 합니다. 한 구단은 하루 1경기(더블헤더 날은 같은 상대와 2경기)만 합니다."));
                }
            }
        }
        // DH-2 구장 하루 1대진
        for (int d = 0; d < dayCount; d++) {
            List<List<Team>> homesByStadium = new ArrayList<>();
            List<List<String>> matchupsByStadium = new ArrayList<>();
            for (RGame g : sorted) {
                if (g.getDay() == null || g.getDay().getIndex() != d) {
                    continue;
                }
                int s = g.getHome().getStadiumIndex();
                while (homesByStadium.size() <= s) {
                    homesByStadium.add(new ArrayList<>());
                    matchupsByStadium.add(new ArrayList<>());
                }
                String matchup = g.getHome().getName() + "-" + g.getAway().getName();
                if (!matchupsByStadium.get(s).contains(matchup)) {
                    matchupsByStadium.get(s).add(matchup);
                    homesByStadium.get(s).add(g.getHome());
                }
            }
            for (int s = 0; s < homesByStadium.size(); s++) {
                if (matchupsByStadium.get(s).size() > 1) {
                    Team host = homesByStadium.get(s).get(0);
                    String date = iso(days.get(d).getDate());
                    out.add(new Violation("DH-2", host.getName(), date, date,
                            host.getStadium() + "에서 " + label(days.get(d).getDate()) + "에 " + matchupsByStadium.get(s).size()
                                    + "대진이 열립니다. 한 구장은 하루 1대진만 엽니다."));
                }
            }
        }
        // DH-4 연속 경기일, DH-5 더블헤더 상한
        List<TeamHistory> histories = solution.getHistoryList();
        for (int t = 0; t < teamCount; t++) {
            String name = teams.get(t).getName();
            TeamHistory history = histories.get(t);
            int run = history.runAtStart();
            int runStart = 0;
            boolean inWindow = false;
            int dh = history.doubleHeadersUsed();
            for (int d = 0; d <= dayCount; d++) {
                boolean played = d < dayCount && !byTeamDay.get(t).get(d).isEmpty();
                if (played) {
                    if (run == 0) {
                        runStart = d;
                    }
                    run++;
                    inWindow = true;
                    List<RGame> list = byTeamDay.get(t).get(d);
                    if (list.size() >= 2) {
                        dh += list.size() - 1;
                    }
                    continue;
                }
                if (inWindow && run > st.getMaxConsecutiveDays()) {
                    // 기간 첫날부터 이어진 연속이면 기간 앞의 경기일도 함께 센다
                    LocalDate from = days.get(runStart).getDate().minusDays(runStart == 0 ? history.runAtStart() : 0);
                    LocalDate to = days.get(d - 1).getDate();
                    out.add(new Violation("DH-4", name, iso(from), iso(to),
                            name + "이(가) " + label(from) + "~" + label(to) + " " + run + "일 연속 경기합니다. 연속 경기일 상한은 "
                                    + st.getMaxConsecutiveDays() + "일입니다."));
                }
                run = 0;
                inWindow = false;
            }
            if (dh > st.getMaxDoubleHeaders()) {
                out.add(new Violation("DH-5", name, null, null,
                        name + "의 더블헤더가 " + dh + "번입니다. 더블헤더 상한은 " + st.getMaxDoubleHeaders() + "번입니다."));
            }
        }
        return out;
    }

    static String iso(LocalDate date) {
        return date == null ? null : date.toString();
    }

    /** 화면 날짜 표기: 9/20 */
    public static String label(LocalDate date) {
        return date.getMonthValue() + "/" + date.getDayOfMonth();
    }
}
