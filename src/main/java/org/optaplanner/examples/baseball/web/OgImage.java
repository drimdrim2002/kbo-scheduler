package org.optaplanner.examples.baseball.web;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.GraphicsEnvironment;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import javax.imageio.ImageIO;

/** 공유 링크 미리보기(OG) 이미지 1200×630. java.awt 헤드리스로 그린다. 외부 의존성 없음. */
final class OgImage {

    private static final int W = 1200;
    private static final int H = 630;
    private static final Color NAVY = new Color(0x0A, 0x1E, 0x3C);
    private static final Color BLUE = new Color(0x1F, 0x5F, 0xD6);
    private static final Color GRAY = new Color(0x9A, 0xA8, 0xC2);
    private static final Color LIGHT = new Color(0xF4, 0xF6, 0xFA);
    private static final List<String> FAMILIES = List.of("Apple SD Gothic Neo", "AppleGothic", "Noto Sans CJK KR",
            "Noto Sans KR", "NanumGothic", "Malgun Gothic", "SansSerif");

    private OgImage() {
    }

    record Spec(String title, String subtitle, String[] labels, String[] values, long realKm, long engineKm, String footer) {
    }

    static String fontFamily() {
        String[] available = GraphicsEnvironment.getLocalGraphicsEnvironment().getAvailableFontFamilyNames();
        List<String> names = Arrays.asList(available);
        for (String f : FAMILIES) {
            if (names.contains(f)) {
                return f;
            }
        }
        return Font.SANS_SERIF;
    }

    static byte[] render(Spec spec) throws IOException {
        BufferedImage img = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            String family = fontFamily();
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, W, H);
            g.setColor(NAVY);
            g.fillRect(0, 0, W, 14);
            // 제목
            g.setFont(new Font(family, Font.BOLD, 54));
            g.setColor(NAVY);
            g.drawString(fit(g, spec.title(), W - 120), 60, 110);
            g.setFont(new Font(family, Font.PLAIN, 28));
            g.setColor(new Color(0x4A, 0x5A, 0x78));
            g.drawString(fit(g, spec.subtitle(), W - 120), 60, 160);
            // 숫자 카드 3개
            int cardW = (W - 120 - 40) / 3;
            for (int i = 0; i < Math.min(3, spec.values().length); i++) {
                int x = 60 + i * (cardW + 20);
                g.setColor(LIGHT);
                g.fillRoundRect(x, 200, cardW, 170, 24, 24);
                g.setFont(new Font(family, Font.PLAIN, 24));
                g.setColor(GRAY);
                g.drawString(spec.labels()[i], x + 24, 240);
                g.setFont(new Font(family, Font.BOLD, 52));
                g.setColor(i == 0 ? BLUE : NAVY);
                g.drawString(fit(g, spec.values()[i], cardW - 48), x + 24, 320);
            }
            // 실제 vs 엔진 막대
            long max = Math.max(1L, Math.max(spec.realKm(), spec.engineKm()));
            int barX = 60, barW = W - 120 - 220;
            drawBar(g, family, "실제 2025 일정", spec.realKm(), max, barX, 420, barW, GRAY);
            drawBar(g, family, "매치봇 결과", spec.engineKm(), max, barX, 490, barW, BLUE);
            // 바닥
            g.setFont(new Font(family, Font.PLAIN, 24));
            g.setColor(GRAY);
            g.drawString(spec.footer(), 60, H - 40);
        } finally {
            g.dispose();
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    private static void drawBar(Graphics2D g, String family, String label, long km, long max, int x, int y, int w,
            Color color) {
        g.setFont(new Font(family, Font.PLAIN, 24));
        g.setColor(NAVY);
        g.drawString(label, x, y - 10);
        int len = (int) Math.round(w * (km / (double) max));
        g.setColor(LIGHT);
        g.fillRoundRect(x, y, w, 34, 12, 12);
        g.setColor(color);
        g.fillRoundRect(x, y, Math.max(12, len), 34, 12, 12);
        g.setFont(new Font(family, Font.BOLD, 28));
        g.setColor(NAVY);
        g.drawString(String.format("%,d km", km), x + w + 20, y + 27);
        g.setStroke(new BasicStroke(1f));
    }

    private static String fit(Graphics2D g, String text, int maxWidth) {
        String t = text == null ? "" : text;
        while (t.length() > 1 && g.getFontMetrics().stringWidth(t) > maxWidth) {
            t = t.substring(0, t.length() - 2) + "…";
        }
        return t;
    }
}
