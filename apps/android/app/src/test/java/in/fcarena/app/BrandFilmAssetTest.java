package in.fcarena.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;

/**
 * Prevent publishing an APK with the visual splash but without the exact
 * user-approved audio/video brand film. This check runs without an emulator.
 */
public final class BrandFilmAssetTest {
    private static final String NAME = "fc_arena_brand_film_v3.mp4";
    private static final String SHA256 =
            "588023aa21a2880e18c50b856b72ffca0fafaf04be44e2328ce510e02e4a6da2";

    private static File filmFile() {
        String working = System.getProperty("user.dir");
        File[] candidates = {
                new File(working, "src/main/assets/" + NAME),
                new File(working, "app/src/main/assets/" + NAME),
                new File(working, "apps/android/app/src/main/assets/" + NAME)
        };
        for (File candidate : candidates) if (candidate.isFile()) return candidate;
        return candidates[0];
    }

    @Test public void finalWatermarkCleanedBrandFilmIsBundledUnchanged() throws Exception {
        File file = filmFile();
        assertTrue("The approved 7-second MP4 must be bundled before release: "
                + file.getAbsolutePath(), file.isFile());
        assertEquals("The approved 1080p video with original AAC soundtrack must be intact",
                4_325_250L, file.length());
        byte[] header = new byte[12];
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream input = new FileInputStream(file)) {
            int count = input.read(header);
            assertTrue(count >= 8);
            assertEquals("ftyp", new String(header, 4, 4,
                    java.nio.charset.StandardCharsets.US_ASCII));
            digest.update(header, 0, count);
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
        }
        StringBuilder result = new StringBuilder();
        for (byte b : digest.digest()) {
            result.append(String.format(java.util.Locale.ROOT, "%02x", b & 0xff));
        }
        assertEquals("Cinematic MP4 must match final approved watermark-cleaned release asset",
                SHA256, result.toString());
    }
}
