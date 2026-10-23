package org.optaplanner.examples.baseball.web;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.json.simple.JSONObject;
import org.json.simple.parser.ParseException;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.core.api.solver.SolutionManager;
import org.optaplanner.core.api.solver.SolverFactory;
import org.optaplanner.core.config.solver.SolverConfig;
import org.optaplanner.examples.baseball.bench.BenchSupport;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * KBO 일정 편성 서버. JDK 내장 HttpServer 하나로 정적 UI(ui/)와 REST·SSE API를 함께 낸다.
 *
 * <pre>
 * GET  /api/v1/info                      서버 정보·한도·큐 길이
 * POST /api/v1/solve                     { problem, options, mode } → { jobId, status }
 * GET  /api/v1/solve/{jobId}             상태·마지막 best·done
 * GET  /api/v1/solve/{jobId}/events      SSE: queued | status | seed-best | best | done | error
 * POST /api/v1/solve/{jobId}/stop        조기 종료
 * POST /api/v1/score                     { problem, plan?, mode } → { score, scoreString }
 * GET  /...                              ui/ 아래 정적 파일 (/ → index.html)
 * </pre>
 *
 * 실행: {@code java ... BaseballWebServer [--port 8080] [--ui ui] [--max-seconds 30] [--seeds N]}
 */
public final class BaseballWebServer {

    private static final Logger LOG = LoggerFactory.getLogger(BaseballWebServer.class);
    private static final String NAME = "kbo-scheduler";
    private static final String VERSION = "0.1.0";
    static final long KEEPALIVE_SEC = 5;
    private static final Map<String, String> MIME = Map.ofEntries(
            Map.entry("html", "text/html; charset=utf-8"), Map.entry("js", "text/javascript; charset=utf-8"),
            Map.entry("css", "text/css; charset=utf-8"), Map.entry("json", "application/json; charset=utf-8"),
            Map.entry("svg", "image/svg+xml"), Map.entry("png", "image/png"), Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"), Map.entry("ico", "image/x-icon"), Map.entry("woff2", "font/woff2"),
            Map.entry("woff", "font/woff"), Map.entry("txt", "text/plain; charset=utf-8"),
            Map.entry("md", "text/markdown; charset=utf-8"), Map.entry("map", "application/json"));

    private final ServerLimits limits;
    private final Path uiRoot;
    private final Path showRoot;
    private final JobManager jobs;
    private final Showcase showcase;
    private final SolutionManager<BaseballSolution, BendableLongScore> scorer;
    private HttpServer server;

    BaseballWebServer(ServerLimits limits, Path uiRoot, Path dataDir, Path inputFile) throws IOException {
        this.limits = limits;
        this.uiRoot = uiRoot == null ? null : uiRoot.toAbsolutePath().normalize();
        this.showRoot = this.uiRoot == null ? null : this.uiRoot.resolve("show");
        ResultStore store = new ResultStore(dataDir);
        this.jobs = new JobManager(limits, store);
        jobs.startSweeper();
        this.showcase = new Showcase(jobs, store, limits, inputFile);
        SolverConfig config = BenchSupport.solverConfig(0, 1, "NONE", null, null);
        this.scorer = SolutionManager.create(SolverFactory.create(config));
    }

    public static void main(String[] args) throws IOException {
        System.setProperty("java.awt.headless", "true");
        int port = 8080;
        Path ui = Path.of("ui");
        Path data = Path.of("data", "results");
        Path input = Path.of(org.optaplanner.examples.baseball.domain.Constants.inputFileName);
        ServerLimits base = ServerLimits.defaults();
        long maxSeconds = base.maxSeconds();
        int seeds = base.defaultSeeds();
        for (int i = 0; i + 1 < args.length; i += 2) {
            switch (args[i]) {
                case "--port" -> port = Integer.parseInt(args[i + 1]);
                case "--ui" -> ui = Path.of(args[i + 1]);
                case "--max-seconds" -> maxSeconds = Long.parseLong(args[i + 1]);
                case "--seeds" -> seeds = Integer.parseInt(args[i + 1]);
                case "--data" -> data = Path.of(args[i + 1]);
                case "--input" -> input = Path.of(args[i + 1]);
                default -> throw new IllegalArgumentException("알 수 없는 인자: " + args[i]);
            }
        }
        ServerLimits limits = new ServerLimits(Math.min(base.defaultSeconds(), maxSeconds), maxSeconds, seeds,
                Math.max(seeds, base.maxSeeds()), base.maxJobsPerIp(), base.cacheSize(), base.maxBodyBytes());
        BaseballWebServer app = new BaseballWebServer(limits, Files.isDirectory(ui) ? ui : null, data, input);
        app.start(port);
        app.showcase.ensureDefault();
        LOG.info("{} {} listening on http://localhost:{} (ui={}, seeds={}, maxSeconds={})", NAME, VERSION, port,
                app.uiRoot, limits.defaultSeeds(), limits.maxSeconds());
    }

    void start(int port) throws IOException {
        server = HttpServer.create(new InetSocketAddress(port), 64);
        server.createContext("/", this::dispatch);
        server.setExecutor(Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "kbo-http");
            t.setDaemon(true);
            return t;
        }));
        server.start();
    }

    void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    int port() {
        return server.getAddress().getPort();
    }

    // ───────────── 라우팅 ─────────────

    private void dispatch(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        String method = ex.getRequestMethod();
        cors(ex.getResponseHeaders());
        try {
            if ("OPTIONS".equals(method)) {
                ex.sendResponseHeaders(204, -1);
                return;
            }
            if (path.startsWith("/api/v1/")) {
                api(ex, method, path.substring("/api/v1/".length()));
            } else if (path.startsWith("/og/") && "GET".equals(method)) {
                og(ex, path.substring(4));
            } else if ("GET".equals(method) || "HEAD".equals(method)) {
                serveStatic(ex, path);
            } else {
                sendJson(ex, 405, Json.obj("error", "지원하지 않는 메서드"));
            }
        } catch (JobManager.RejectedException e) {
            sendJson(ex, e.httpStatus, Json.obj("error", e.getMessage()));
        } catch (ParseException | IllegalArgumentException e) {
            sendJson(ex, 400, Json.obj("error", e.getMessage() == null ? e.toString() : e.getMessage()));
        } catch (Exception e) {
            LOG.error("{} {} failed", method, path, e);
            sendJson(ex, 500, Json.obj("error", e.getMessage() == null ? e.toString() : e.getMessage()));
        } finally {
            ex.close();
        }
    }

    private void api(HttpExchange ex, String method, String rest) throws IOException, ParseException {
        if ("compare".equals(rest) && "GET".equals(method)) {
            Optional<JSONObject> c = showcase.compare();
            if (c.isPresent()) {
                sendJson(ex, 200, c.get());
            } else {
                sendJson(ex, 503, Json.obj("error", "기본 결과를 준비하는 중입니다.", "status", showcase.defaultStatus()));
            }
            return;
        }
        if (rest.startsWith("results/") && "GET".equals(method)) {
            String id = rest.substring("results/".length());
            Optional<JSONObject> r = ResultStore.validId(id) ? showcase.result(id) : Optional.empty();
            if (r.isPresent()) {
                sendJson(ex, 200, r.get());
            } else {
                sendJson(ex, 404, Json.obj("error", "결과가 없습니다: " + id));
            }
            return;
        }
        if ("info".equals(rest) && "GET".equals(method)) {
            sendJson(ex, 200, Json.obj("name", NAME, "version", VERSION, "engine", "OptaPlanner multistart",
                    "defaultResult", showcase.defaultStatus(),
                    "defaultSeconds", limits.defaultSeconds(), "maxSeconds", limits.maxSeconds(),
                    "defaultSeeds", (long) limits.defaultSeeds(), "maxSeeds", (long) limits.maxSeeds(),
                    "queueLength", (long) jobs.queueLength()));
            return;
        }
        if ("solve".equals(rest) && "POST".equals(method)) {
            JSONObject body = readJsonObject(ex);
            JSONObject problem = Json.object(body.get("problem"));
            if (problem == null) {
                throw new IllegalArgumentException("problem이 없습니다.");
            }
            JSONObject optionsRaw = Json.object(body.get("options"));
            if (optionsRaw == null) {
                optionsRaw = new JSONObject();
            }
            if (body.get("mode") != null && optionsRaw.get("mode") == null) {
                optionsRaw.put("mode", body.get("mode"));
            }
            SolveOptions options = SolveOptions.from(optionsRaw, limits);
            SolveJob job = jobs.submit(problem, options, clientIp(ex));
            sendJson(ex, 202, Json.obj("jobId", job.id, "status", job.status().name(), "options", options.toJson()));
            return;
        }
        if ("score".equals(rest) && "POST".equals(method)) {
            JSONObject body = readJsonObject(ex);
            JSONObject problem = Json.object(body.get("problem"));
            if (problem == null) {
                throw new IllegalArgumentException("problem이 없습니다.");
            }
            String mode = Json.asString(body.get("mode"), "INITIAL");
            if (!"INITIAL".equals(mode)) {
                throw new IllegalArgumentException("이번 버전은 mode=INITIAL만 지원합니다.");
            }
            BaseballSolution solution = ProblemCodec.toSolution(problem);
            boolean full = ProblemCodec.applyPlan(solution, problem, Json.array(body.get("plan")));
            BendableLongScore score;
            synchronized (scorer) {
                score = scorer.update(solution);
            }
            sendJson(ex, 200, Json.obj("score", Json.score(score), "scoreString", score.toString(), "complete", full));
            return;
        }
        if (rest.startsWith("solve/")) {
            String[] parts = rest.substring("solve/".length()).split("/");
            SolveJob job = jobs.get(parts[0]);
            if (job == null) {
                sendJson(ex, 404, Json.obj("error", "작업이 없습니다: " + parts[0]));
                return;
            }
            if (parts.length == 1 && "GET".equals(method)) {
                sendJson(ex, 200, job.statusJson());
                return;
            }
            if (parts.length == 2 && "events".equals(parts[1]) && "GET".equals(method)) {
                stream(ex, job);
                return;
            }
            if (parts.length == 2 && "stop".equals(parts[1]) && "POST".equals(method)) {
                jobs.stop(job);
                sendJson(ex, 200, Json.obj("jobId", job.id, "status", job.status().name()));
                return;
            }
        }
        sendJson(ex, 404, Json.obj("error", "없는 API: " + rest));
    }

    // ───────────── SSE ─────────────

    private void stream(HttpExchange ex, SolveJob job) throws IOException {
        Headers h = ex.getResponseHeaders();
        h.set("Content-Type", "text/event-stream; charset=utf-8");
        h.set("Cache-Control", "no-cache");
        h.set("X-Accel-Buffering", "no");
        ex.sendResponseHeaders(200, 0);
        BlockingQueue<SolveJob.Event> q = job.subscribe();
        try (OutputStream os = ex.getResponseBody()) {
            while (true) {
                // 5초마다 주석 줄: 프록시(Cloudflare 100초)가 끊지 않게 하고, 탭을 닫은 사람을 쓰기 실패로 빨리 알아챈다
                // (JobManager가 아무도 보지 않는 대기 작업을 뺀다)
                SolveJob.Event e = q.poll(KEEPALIVE_SEC, TimeUnit.SECONDS);
                if (e == null) {
                    os.write(": keep-alive\n\n".getBytes(StandardCharsets.UTF_8));
                    os.flush();
                    continue;
                }
                os.write(("event: " + e.name() + "\ndata: " + e.data() + "\n\n").getBytes(StandardCharsets.UTF_8));
                os.flush();
                if ("done".equals(e.name()) || "error".equals(e.name())) {
                    return;
                }
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        } catch (IOException ioe) {
            LOG.debug("sse client left job {}", job.id);
        } finally {
            job.unsubscribe(q);
        }
    }

    // ───────────── OG 이미지 ─────────────

    private void og(HttpExchange ex, String rest) throws IOException {
        String id = rest.endsWith(".png") ? rest.substring(0, rest.length() - 4) : rest;
        Optional<byte[]> png = showcase.og(id);
        if (png.isEmpty()) {
            sendJson(ex, 404, Json.obj("error", "결과가 없습니다: " + id));
            return;
        }
        ex.getResponseHeaders().set("Content-Type", "image/png");
        ex.getResponseHeaders().set("Cache-Control", "public, max-age=86400");
        ex.sendResponseHeaders(200, png.get().length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(png.get());
        }
    }

    // ───────────── 정적 파일 ─────────────

    /**
     * 경로 규칙: {@code /}·{@code /compare}는 보여주는 문(ui/show/)이 있으면 그것, 없으면 위저드.
     * {@code /r/<id>}는 ui/show/r.html. {@code /studio/...}는 위저드(ui/). 그 밖의 경로는 ui/show/ → ui/ 순서로 찾는다.
     */
    private Path resolveStatic(String path) {
        String rel = path.endsWith("/") ? path + "index.html" : path;
        if (rel.startsWith("/r/") && showRoot != null) {
            return showRoot.resolve("r.html");
        }
        if ("/compare".equals(rel) && showRoot != null) {
            return showRoot.resolve("compare.html");
        }
        if (rel.startsWith("/studio/")) {
            String sub = rel.substring("/studio/".length());
            return uiRoot.resolve(sub.isEmpty() ? "index.html" : sub).normalize();
        }
        if ("/studio".equals(rel)) {
            return uiRoot.resolve("index.html");
        }
        if (showRoot != null) {
            Path inShow = showRoot.resolve(rel.substring(1)).normalize();
            if (inShow.startsWith(showRoot) && Files.isRegularFile(inShow)) {
                return inShow;
            }
        }
        return uiRoot.resolve(rel.substring(1)).normalize();
    }

    private void serveStatic(HttpExchange ex, String path) throws IOException {
        if (uiRoot == null) {
            sendJson(ex, 404, Json.obj("error", "정적 UI 디렉터리가 없습니다. --ui 로 지정하세요."));
            return;
        }
        Path file = resolveStatic(path);
        if (!file.startsWith(uiRoot) || !Files.isRegularFile(file)) {
            sendJson(ex, 404, Json.obj("error", "없는 파일: " + path));
            return;
        }
        String name = file.getFileName().toString();
        String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : "";
        long size = Files.size(file);
        long mtime = Files.getLastModifiedTime(file).toMillis();
        String etag = etag(mtime, size);
        Headers h = ex.getResponseHeaders();
        h.set("Content-Type", MIME.getOrDefault(ext, "application/octet-stream"));
        // no-cache = 브라우저가 매번 재검증. ETag·Last-Modified가 있으면 안 바뀐 파일은 304(본문 없음)로 끝난다.
        // Cloudflare는 Browser Cache TTL "Respect Existing Headers"(2026-10-24 설정)라 이 헤더를 그대로 전달한다.
        h.set("Cache-Control", "no-cache");
        h.set("ETag", etag);
        h.set("Last-Modified", httpDate(mtime));
        if (notModified(ex.getRequestHeaders().getFirst("If-None-Match"), etag,
                ex.getRequestHeaders().getFirst("If-Modified-Since"), mtime)) {
            ex.sendResponseHeaders(304, -1);
            ex.close();
            return;
        }
        if ("HEAD".equals(ex.getRequestMethod())) {
            ex.sendResponseHeaders(200, -1);
            return;
        }
        ex.sendResponseHeaders(200, size);
        try (OutputStream os = ex.getResponseBody(); InputStream in = Files.newInputStream(file)) {
            in.transferTo(os);
        }
    }

    // ───────────── 공통 ─────────────

    private static void cors(Headers h) {
        h.set("Access-Control-Allow-Origin", "*");
        h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        h.set("Access-Control-Allow-Headers", "Content-Type");
    }

    private JSONObject readJsonObject(HttpExchange ex) throws IOException, ParseException {
        byte[] bytes;
        try (InputStream in = ex.getRequestBody()) {
            bytes = in.readNBytes(limits.maxBodyBytes() + 1);
        }
        if (bytes.length > limits.maxBodyBytes()) {
            throw new IllegalArgumentException("요청 본문이 너무 큽니다.");
        }
        Object parsed = Json.parse(new String(bytes, StandardCharsets.UTF_8));
        JSONObject o = Json.object(parsed);
        if (o == null) {
            throw new IllegalArgumentException("JSON 객체가 필요합니다.");
        }
        return o;
    }

    private static void sendJson(HttpExchange ex, int status, Object body) throws IOException {
        byte[] bytes = Json.str(body).getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String clientIp(HttpExchange ex) {
        return clientIp(ex.getRemoteAddress().getAddress(), ex.getRequestHeaders().getFirst("X-Real-IP"));
    }

    /**
     * IP당 동시 1작업 제한에 쓰는 방문자 주소.
     * 같은 기계의 Caddy를 거쳐 온 요청(루프백)일 때만 Caddy가 넣은 X-Real-IP를 믿는다. Caddy는 Cloudflare 대역에서 온
     * 요청에서만 CF-Connecting-IP를 방문자 주소로 받아 X-Real-IP로 넘긴다(deploy/Caddyfile). 그 밖의 요청이 보낸
     * X-Forwarded-For·CF-Connecting-IP 같은 헤더는 누구나 꾸밀 수 있어 보지 않는다.
     */
    static String clientIp(java.net.InetAddress remote, String realIp) {
        if (remote.isLoopbackAddress() && realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return remote.getHostAddress();
    }

    // ───────────── 정적 파일 캐시 검증 (ETag = 수정 시각 + 크기) ─────────────

    /** 강한 ETag: 같은 파일은 수정 시각(ms)과 크기가 같으면 내용도 같다고 본다(배포는 git pull이라 바뀌면 둘 중 하나는 달라진다). */
    static String etag(long mtimeMillis, long size) {
        return "\"" + Long.toHexString(mtimeMillis) + "-" + Long.toHexString(size) + "\"";
    }

    /** RFC 7231 날짜(GMT). */
    static String httpDate(long millis) {
        return DateTimeFormatter.RFC_1123_DATE_TIME.format(Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC));
    }

    /**
     * 304로 답해도 되는가. If-None-Match가 있으면 그것만 본다(RFC 7232: 있으면 If-Modified-Since는 무시).
     * 목록·약한 표시(W/)·*를 받아들인다. 앞의 Caddy가 압축하면서 ETag 뒤에 {@code -gzip}·{@code -zstd}를 붙여 내보내므로
     * ({@code "abc-1f"} → {@code "abc-1f-gzip"}), 그 꼬리가 붙은 태그도 같은 파일로 본다. If-Modified-Since는 초 단위로 비교한다(헤더에 ms가 없다).
     */
    static boolean notModified(String ifNoneMatch, String etag, String ifModifiedSince, long mtimeMillis) {
        if (ifNoneMatch != null && !ifNoneMatch.isBlank()) {
            String base = etag.endsWith("\"") ? etag.substring(0, etag.length() - 1) : etag; // 닫는 따옴표 뗀 것
            for (String tag : ifNoneMatch.split(",")) {
                String t = tag.trim();
                if (t.startsWith("W/")) {
                    t = t.substring(2);
                }
                if ("*".equals(t) || t.equals(etag) || (t.startsWith(base + "-") && t.endsWith("\""))) {
                    return true;
                }
            }
            return false;
        }
        if (ifModifiedSince != null && !ifModifiedSince.isBlank()) {
            try {
                long since = ZonedDateTime.parse(ifModifiedSince.trim(), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant().toEpochMilli();
                return mtimeMillis / 1000 <= since / 1000;
            } catch (DateTimeParseException e) {
                return false;
            }
        }
        return false;
    }

}
