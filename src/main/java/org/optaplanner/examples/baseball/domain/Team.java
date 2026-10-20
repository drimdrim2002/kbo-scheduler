package org.optaplanner.examples.baseball.domain;

import org.optaplanner.examples.common.domain.AbstractPersistable;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;

public class Team extends AbstractPersistable {
    private String name;
    private String stadium;
    private HashMap<String, BigDecimal> distanceMap;
    private int index;
    private int stadiumIndex;
    private long[] distanceTenthsByTeamIndex;
    /** 어린이날 시리즈를 홈에서 치러야 하는 구단. 기본값은 {@link Constants#HOME_OBLIGATION_CHILDREN}. */
    private boolean childrenDayHome;
//    private HashMap<String, BigDecimal> distanceFrom;

    public Team() {

    }
    public Team(long id, String name, String stadium) {
        super(id);
        this.name = name;
        this.stadium = stadium;
        this.childrenDayHome = Constants.HOME_OBLIGATION_CHILDREN.contains(name);
    }

    public Team(long id, String name, String stadium, HashMap<String, BigDecimal> distanceMap) {
        super(id);
        this.name = name;
        this.stadium = stadium;
        this.distanceMap = distanceMap;
        this.childrenDayHome = Constants.HOME_OBLIGATION_CHILDREN.contains(name);
//        this.distanceFrom = distanceFrom;
    }

    public boolean isChildrenDayHome() {
        return childrenDayHome;
    }

    public void setChildrenDayHome(boolean childrenDayHome) {
        this.childrenDayHome = childrenDayHome;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getStadium() {
        return stadium;
    }

    public void setStadium(String stadium) {
        this.stadium = stadium;
    }

    public HashMap<String, BigDecimal> getDistanceMap() {
        return distanceMap;
    }

    public void setDistanceMap(HashMap<String, BigDecimal> distanceMap) {
        this.distanceMap = distanceMap;
    }

    public BigDecimal getDistanceTo(Team team) {
        return this.distanceMap.get(team.getName());
    }

    public int getIndex() {
        return index;
    }

    public int getStadiumIndex() {
        return stadiumIndex;
    }

    public boolean isIndexPrepared() {
        return distanceTenthsByTeamIndex != null;
    }

    public long getDistanceTenthsTo(int teamIndex) {
        if (!isIndexPrepared()) {
            throw new IllegalStateException("Team index is not prepared");
        }
        return distanceTenthsByTeamIndex[teamIndex];
    }

    public static long toTenths(BigDecimal distance) {
        if (distance == null) {
            return 0L;
        }
        return distance.movePointRight(1).setScale(0, RoundingMode.HALF_UP).longValue();
    }

    public static List<Team> prepareIndices(Collection<Team> teams) {
        ArrayList<Team> sorted = new ArrayList<>(teams);
        sorted.sort(Comparator.comparing(Team::getId));
        HashMap<String, Integer> stadiumIndexByName = new HashMap<>();
        int nextStadiumIndex = 0;
        for (int i = 0; i < sorted.size(); i++) {
            Team team = sorted.get(i);
            team.index = i;
            String stadiumName = team.stadium == null ? "" : team.stadium;
            Integer assigned = stadiumIndexByName.get(stadiumName);
            if (assigned == null) {
                assigned = nextStadiumIndex;
                stadiumIndexByName.put(stadiumName, assigned);
                nextStadiumIndex++;
            }
            team.stadiumIndex = assigned;
        }
        int teamCount = sorted.size();
        for (Team team : sorted) {
            long[] tenths = new long[teamCount];
            HashMap<String, BigDecimal> distances = team.distanceMap;
            for (int otherIndex = 0; otherIndex < teamCount; otherIndex++) {
                Team other = sorted.get(otherIndex);
                BigDecimal distance = distances == null ? null : distances.get(other.getName());
                tenths[otherIndex] = toTenths(distance);
            }
            team.distanceTenthsByTeamIndex = tenths;
        }
        return sorted;
    }

//    public HashMap<String, BigDecimal> getDistanceFrom() {
//        return distanceFrom;
//    }
//
//    public void setDistanceFrom(HashMap<String, BigDecimal> distanceFrom) {
//        this.distanceFrom = distanceFrom;
//    }

    @Override
    public String toString() {
        return "Team{" +
                "name='" + name + '\'' +
                ", stadium='" + stadium + '\'' +
                '}';
    }
}
