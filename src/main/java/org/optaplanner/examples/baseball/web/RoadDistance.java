package org.optaplanner.examples.baseball.web;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.ParseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 구장 사이 도로거리: 카카오모빌리티 길찾기(자동차) API 중계.
 *
 * <p>REST API 키는 비밀 키라 브라우저에 두지 않는다. 서버가 환경 변수 {@code KAKAO_REST_KEY}(로컬 .env → scripts/run-server.sh,
 * 공개 서버 /etc/kbo-scheduler/env → systemd EnvironmentFile)로만 갖고, 응답·로그 어디에도 키를 내보내지 않는다.
 * 화면은 {@code POST /api/v1/road-distance} {@code { pairs: [{ from: {lat, lon}, to: {lat, lon} }] }}로 묻는다.
 *
 * <p>사용량 보호: 한 요청 최대 {@value #MAX_PAIRS}쌍, 같은 좌표 쌍은 캐시(방향 무시, 소수 5자리), 방문자 주소당 10분에
 * {@value #PER_IP_PER_WINDOW}건, 하루(한국 시간) 전체 {@value #PER_DAY}건까지 카카오에 묻는다. 좌표는 한국 범위만 받는다.
 */
final class RoadDistance {

    private static final Logger LOG = LoggerFactory.getLogger(RoadDistance.class);
    static final String ENDPOINT = "https://apis-navi.kakaomobility.com/v1/directions";
    static final int MAX_PAIRS = 45;
    static final int PER_IP_PER_WINDOW = 200;
    static final long WINDOW_MS = 10 * 60_000L;
    static final int PER_DAY = 3000;
    private static final int CACHE_SIZE = 4000;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 카카오에 묻는 부분(점검에서 가짜로 바꾼다). 응답 본문을 돌려주고, HTTP 오류면 IOException. */
    interface Fetcher {
        String get(String url, String authorization) throws IOException;
    }

    /** 한 쌍의 결과: km(성공) 또는 error(사유, 사용자에게 보여 줄 말). */
    record Result(Double km, String error, boolean cached) {
        JSONObject toJson() {
            return km != null ? Json.obj("km", km, "cached", cached) : Json.obj("error", error);
        }
    }

    private final String restKey;
    private final Fetcher fetcher;
    private final Map<String, Double> cache = java.util.Collections.synchronizedMap(new LinkedHashMap<>(256, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Double> eldest) {
            return size() > CACHE_SIZE;
        }
    });
    private final Map<String, long[]> perIp = new ConcurrentHashMap<>(); // ip → [창 시작 ms, 건수]
    private LocalDate day = LocalDate.now(KST);
    private int dayCount = 0;
    private final ExecutorService pool = Executors.newFixedThreadPool(4, r -> {
        Thread t = new Thread(r, "kbo-road");
        t.setDaemon(true);
        return t;
    });

    RoadDistance(String restKey, Fetcher fetcher) {
        this.restKey = restKey == null ? "" : restKey.trim();
        this.fetcher = fetcher;
    }

    /** 환경 변수 KAKAO_REST_KEY로 만든다(없으면 꺼진 상태). */
    static RoadDistance fromEnv() {
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
        Fetcher http = (url, auth) -> {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(6))
                    .header("Authorization", auth).header("Accept", "application/json").GET().build();
            try {
                HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                if (res.statusCode() != 200) {
                    throw new IOException("HTTP " + res.statusCode());
                }
                return res.body();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException("중단됨", e);
            }
        };
        return new RoadDistance(System.getenv("KAKAO_REST_KEY"), http);
    }

    boolean available() {
        return !restKey.isEmpty();
    }

    /** 요청 본문 { pairs: [...] } → { results: [...], source }. 형식이 틀리면 IllegalArgumentException(400). */
    JSONObject handle(JSONObject body, String ip) {
        if (!available()) {
            throw new IllegalStateException("서버에 카카오 REST 키가 없어 도로거리를 계산할 수 없습니다.");
        }
        JSONArray pairs = Json.array(body.get("pairs"));
        if (pairs == null || pairs.isEmpty()) {
            throw new IllegalArgumentException("pairs가 없습니다.");
        }
        if (pairs.size() > MAX_PAIRS) {
            throw new IllegalArgumentException("한 번에 " + MAX_PAIRS + "쌍까지 계산합니다.");
        }
        List<double[]> coords = new ArrayList<>();
        for (Object o : pairs) {
            JSONObject p = Json.object(o);
            JSONObject from = p == null ? null : Json.object(p.get("from"));
            JSONObject to = p == null ? null : Json.object(p.get("to"));
            if (from == null || to == null) {
                throw new IllegalArgumentException("pairs의 각 항목은 { from: {lat, lon}, to: {lat, lon} }입니다.");
            }
            coords.add(new double[] { coord(from, "lat", 33.0, 39.0), coord(from, "lon", 124.0, 132.0),
                    coord(to, "lat", 33.0, 39.0), coord(to, "lon", 124.0, 132.0) });
        }
        List<Future<Result>> futures = new ArrayList<>();
        for (double[] c : coords) {
            futures.add(pool.submit(() -> one(c[0], c[1], c[2], c[3], ip)));
        }
        List<JSONObject> results = new ArrayList<>();
        for (Future<Result> f : futures) {
            Result r;
            try {
                r = f.get();
            } catch (Exception e) {
                r = new Result(null, "계산 중 오류", false);
            }
            results.add(r.toJson());
        }
        return Json.obj("results", Json.arr(results), "source", "kakao-mobility");
    }

    private static double coord(JSONObject o, String k, double min, double max) {
        double v = Json.asDouble(o.get(k), Double.NaN);
        if (!(v >= min && v <= max)) {
            throw new IllegalArgumentException(k + " 값이 한국 범위를 벗어났습니다.");
        }
        return v;
    }

    /** 방향을 무시한 캐시 키(소수 5자리 ≈ 1m). */
    static String key(double lat1, double lon1, double lat2, double lon2) {
        String a = String.format(Locale.ROOT, "%.5f,%.5f", lat1, lon1);
        String b = String.format(Locale.ROOT, "%.5f,%.5f", lat2, lon2);
        return a.compareTo(b) <= 0 ? a + "|" + b : b + "|" + a;
    }

    Result one(double lat1, double lon1, double lat2, double lon2, String ip) {
        if (haversineKm(lat1, lon1, lat2, lon2) < 0.05) {
            return new Result(0.0, null, true); // 같은 구장(50m 안)
        }
        String k = key(lat1, lon1, lat2, lon2);
        Double hit = cache.get(k);
        if (hit != null) {
            return new Result(hit, null, true);
        }
        String quota = take(ip);
        if (quota != null) {
            return new Result(null, quota, false);
        }
        String url = ENDPOINT + "?origin=" + fmt(lon1) + "," + fmt(lat1) + "&destination=" + fmt(lon2) + "," + fmt(lat2)
                + "&priority=RECOMMEND&summary=true";
        try {
            Double km = parseKm(fetcher.get(url, "KakaoAK " + restKey));
            if (km == null) {
                return new Result(null, "길을 찾지 못했습니다", false);
            }
            cache.put(k, km);
            return new Result(km, null, false);
        } catch (IOException | ParseException e) {
            LOG.warn("카카오 길찾기 실패: {}", e.getMessage()); // 키·주소(URL)는 남기지 않는다
            return new Result(null, "카카오 길찾기에 연결하지 못했습니다", false);
        }
    }

    private static String fmt(double v) {
        return String.format(Locale.ROOT, "%.6f", v);
    }

    /** 응답에서 첫 경로의 거리(m)를 km(소수 1자리)로. 경로가 없거나 result_code가 0이 아니면 null. */
    static Double parseKm(String body) throws ParseException {
        JSONObject o = Json.object(Json.parse(body));
        JSONArray routes = o == null ? null : Json.array(o.get("routes"));
        if (routes == null || routes.isEmpty()) {
            return null;
        }
        JSONObject r = Json.object(routes.get(0));
        if (r == null || Json.asLong(r.get("result_code"), -1) != 0) {
            return null;
        }
        JSONObject summary = Json.object(r.get("summary"));
        double m = summary == null ? Double.NaN : Json.asDouble(summary.get("distance"), Double.NaN);
        return Double.isFinite(m) ? Math.round(m / 100.0) / 10.0 : null;
    }

    /** 사용량 한도를 하나 쓴다. 넘으면 사유를, 아니면 null. */
    private synchronized String take(String ip) {
        LocalDate today = LocalDate.now(KST);
        if (!today.equals(day)) {
            day = today;
            dayCount = 0;
        }
        if (dayCount >= PER_DAY) {
            return "오늘 도로거리 계산 한도를 다 썼습니다. 내일 다시 해 주세요";
        }
        long now = System.currentTimeMillis();
        long[] w = perIp.computeIfAbsent(ip == null ? "?" : ip, x -> new long[] { now, 0 });
        if (now - w[0] > WINDOW_MS) {
            w[0] = now;
            w[1] = 0;
        }
        if (w[1] >= PER_IP_PER_WINDOW) {
            return "잠시 뒤에 다시 해 주세요(10분 사용량 초과)";
        }
        w[1]++;
        dayCount++;
        return null;
    }

    /** 직선거리(km) — 같은 구장 판별용. */
    static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double r = 6371.0088, p1 = Math.toRadians(lat1), p2 = Math.toRadians(lat2);
        double dp = p2 - p1, dl = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
        return 2 * r * Math.asin(Math.sqrt(a));
    }
}
