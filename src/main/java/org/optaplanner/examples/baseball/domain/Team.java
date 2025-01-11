package org.optaplanner.examples.baseball.domain;

import java.util.Objects;
import org.optaplanner.examples.common.domain.AbstractPersistable;

import java.math.BigDecimal;
import java.util.HashMap;

public class Team extends AbstractPersistable {

    private String name;
    private String stadium;
    private HashMap<String, BigDecimal> distanceMap;
//    private HashMap<String, BigDecimal> distanceFrom;

    public Team() {

    }

    public Team(long id, String name, String stadium) {
        super(id);
        this.name = name;
        this.stadium = stadium;
    }

    public Team(long id, String name, String stadium, HashMap<String, BigDecimal> distanceMap) {
        super(id);
        this.name = name;
        this.stadium = stadium;
        this.distanceMap = distanceMap;
//        this.distanceFrom = distanceFrom;
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

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Team team = (Team) o;
        return Objects.equals(name, team.name) && Objects.equals(stadium, team.stadium);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, stadium);
    }
}
