package org.optaplanner.examples.baseball.web;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.ParseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 연도별 구단 간 거리를 디스크에 남긴다: 한 해에 파일 하나({@code <year>.json}).
 *
 * <p>내용은 화면의 방향별 거리 목록 그대로 {@code { year, savedAt, teams, distances }}다. 나중에 DB로 옮길 때는 이 클래스만 바꾼다.
 * 같은 해를 동시에 저장하면 나중 저장이 남는다.
 */
final class DistanceStore {

    private static final Logger LOG = LoggerFactory.getLogger(DistanceStore.class);
    private static final Pattern FILE = Pattern.compile("(\\d{4})\\.json");
    static final int MIN_YEAR = 2000;
    static final int MAX_YEAR = 2100;
    static final int MAX_DISTANCES = 2000;
    static final int MAX_TEAMS = 50;
    static final int MAX_NAME = 40;
    static final double MAX_KM = 2000.0;

    private final Path dir;

    /** 디렉터리는 처음 저장할 때 만든다. */
    DistanceStore(Path dir) {
        this.dir = dir.toAbsolutePath().normalize();
    }

    /** 주소의 연도 조각. 네 자리 숫자이고 범위 안이면 그 해, 아니면 IllegalArgumentException(400). */
    static int parseYear(String text) {
        if (text == null || !text.matches("\\d{4}")) {
            throw new IllegalArgumentException("연도는 네 자리 숫자입니다.");
        }
        int year = Integer.parseInt(text);
        if (year < MIN_YEAR || year > MAX_YEAR) {
            throw new IllegalArgumentException("연도가 범위를 벗어났습니다: " + year);
        }
        return year;
    }

    private Path path(int year) {
        return dir.resolve(year + ".json");
    }

    /** 저장된 해 목록(오래된 해부터): [{ year, savedAt, count }]. */
    JSONArray list() throws IOException {
        List<Integer> years = new ArrayList<>();
        if (Files.isDirectory(dir)) {
            try (Stream<Path> files = Files.list(dir)) {
                files.forEach((f) -> {
                    Matcher m = FILE.matcher(f.getFileName().toString());
                    if (m.matches()) {
                        years.add(Integer.parseInt(m.group(1)));
                    }
                });
            }
        }
        years.sort(null);
        List<JSONObject> out = new ArrayList<>();
        for (int year : years) {
            load(year).ifPresent((o) -> out.add(summary(o)));
        }
        return Json.arr(out);
    }

    private static JSONObject summary(JSONObject saved) {
        JSONArray distances = Json.array(saved.get("distances"));
        return Json.obj("year", saved.get("year"), "savedAt", saved.get("savedAt"),
                "count", (long) (distances == null ? 0 : distances.size()));
    }

    Optional<JSONObject> load(int year) {
        Path p = path(year);
        if (!Files.isRegularFile(p)) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(Json.object(Json.parse(Files.readString(p, StandardCharsets.UTF_8))));
        } catch (IOException | ParseException e) {
            LOG.warn("distances {} unreadable", year, e);
            return Optional.empty();
        }
    }

    /** 요청의 distances·teams를 검사해 저장하고 요약을 돌려준다. 값이 틀리면 IllegalArgumentException(400), 쓰기 실패는 IOException(500). */
    synchronized JSONObject save(int year, JSONObject body) throws IOException {
        JSONObject record = Json.obj("year", (long) year, "savedAt", Instant.now().toString(),
                "teams", cleanTeams(Json.array(body.get("teams"))), "distances", cleanDistances(Json.array(body.get("distances"))));
        Files.createDirectories(dir);
        Path tmp = dir.resolve(year + ".json.tmp");
        Files.writeString(tmp, Json.str(record), StandardCharsets.UTF_8);
        Files.move(tmp, path(year), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        return summary(record);
    }

    private static JSONArray cleanDistances(JSONArray raw) {
        if (raw == null || raw.isEmpty()) {
            throw new IllegalArgumentException("저장할 거리가 없습니다.");
        }
        if (raw.size() > MAX_DISTANCES) {
            throw new IllegalArgumentException("거리가 너무 많습니다(최대 " + MAX_DISTANCES + "개).");
        }
        List<JSONObject> out = new ArrayList<>();
        for (Object o : raw) {
            JSONObject d = Json.object(o);
            if (d == null) {
                throw new IllegalArgumentException("거리 항목의 형식이 맞지 않습니다.");
            }
            double km = Json.asDouble(d.get("distance"), Double.NaN);
            if (!(km >= 0 && km <= MAX_KM)) {
                throw new IllegalArgumentException("거리는 0~" + (long) MAX_KM + "km입니다.");
            }
            JSONObject clean = Json.obj("from", name(d.get("from")), "to", name(d.get("to")), "distance", km,
                    "estimated", Json.asBool(d.get("estimated"), false));
            if ("ROAD".equals(d.get("source"))) {
                clean.put("source", "ROAD");
            }
            out.add(clean);
        }
        return Json.arr(out);
    }

    /** 구장 위치(불러올 때 지금 위치와 다른 구단을 알리는 데 쓴다). 없어도 된다. */
    private static JSONArray cleanTeams(JSONArray raw) {
        List<JSONObject> out = new ArrayList<>();
        if (raw == null) {
            return Json.arr(out);
        }
        if (raw.size() > MAX_TEAMS) {
            throw new IllegalArgumentException("구단이 너무 많습니다(최대 " + MAX_TEAMS + "개).");
        }
        for (Object o : raw) {
            JSONObject t = Json.object(o);
            if (t == null) {
                throw new IllegalArgumentException("구단 항목의 형식이 맞지 않습니다.");
            }
            double lat = Json.asDouble(t.get("latitude"), Double.NaN);
            double lon = Json.asDouble(t.get("longitude"), Double.NaN);
            if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) {
                throw new IllegalArgumentException("구장 위치 값이 맞지 않습니다.");
            }
            out.add(Json.obj("name", name(t.get("name")), "latitude", lat, "longitude", lon));
        }
        return Json.arr(out);
    }

    private static String name(Object v) {
        String s = v instanceof String text ? text.trim() : "";
        if (s.isEmpty() || s.length() > MAX_NAME) {
            throw new IllegalArgumentException("구단 이름은 1~" + MAX_NAME + "자입니다.");
        }
        return s;
    }
}
