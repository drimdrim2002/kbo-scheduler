package org.optaplanner.examples.baseball.web;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Optional;
import java.util.regex.Pattern;
import org.json.simple.JSONObject;
import org.json.simple.parser.ParseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** 편성 결과를 디스크에 남긴다(공유 링크가 재시작 뒤에도 살도록). id는 캐시 키 앞 12자리 또는 "default". */
final class ResultStore {

    private static final Logger LOG = LoggerFactory.getLogger(ResultStore.class);
    private static final Pattern ID = Pattern.compile("[a-z0-9]{1,32}");

    private final Path dir;

    ResultStore(Path dir) throws IOException {
        this.dir = dir.toAbsolutePath().normalize();
        Files.createDirectories(this.dir);
    }

    static boolean validId(String id) {
        return id != null && ID.matcher(id).matches();
    }

    Path jsonPath(String id) {
        return dir.resolve(id + ".json");
    }

    Path pngPath(String id) {
        return dir.resolve(id + ".png");
    }

    boolean exists(String id) {
        return validId(id) && Files.isRegularFile(jsonPath(id));
    }

    Optional<JSONObject> load(String id) {
        if (!exists(id)) {
            return Optional.empty();
        }
        try {
            Object parsed = Json.parse(Files.readString(jsonPath(id), StandardCharsets.UTF_8));
            return Optional.ofNullable(Json.object(parsed));
        } catch (IOException | ParseException e) {
            LOG.warn("result {} unreadable", id, e);
            return Optional.empty();
        }
    }

    void save(String id, JSONObject payload) {
        if (!validId(id)) {
            throw new IllegalArgumentException("bad result id: " + id);
        }
        try {
            Path tmp = dir.resolve(id + ".json.tmp");
            Files.writeString(tmp, Json.str(payload), StandardCharsets.UTF_8);
            Files.move(tmp, jsonPath(id), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            LOG.warn("result {} not saved", id, e);
        }
    }

    void savePng(String id, byte[] png) {
        try {
            Files.write(pngPath(id), png);
        } catch (IOException e) {
            LOG.warn("og {} not saved", id, e);
        }
    }
}
