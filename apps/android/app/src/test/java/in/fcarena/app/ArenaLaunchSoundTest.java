package in.fcarena.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.app.Application;
import android.content.Context;
import android.media.AudioAttributes;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, application = Application.class)
public class ArenaLaunchSoundTest {
    private static String ascii(byte[] b, int start, int length) {
        return new String(b, start, length, StandardCharsets.US_ASCII);
    }

    private static int le32(byte[] b, int offset) {
        return (b[offset] & 255) | ((b[offset + 1] & 255) << 8)
                | ((b[offset + 2] & 255) << 16) | ((b[offset + 3] & 255) << 24);
    }

    private static int le16(byte[] b, int offset) {
        return (b[offset] & 255) | ((b[offset + 1] & 255) << 8);
    }

    @Test public void cinematicSoundIsMediaMusicNotSystemEffect() {
        AudioAttributes attributes = ArenaLaunchSound.mediaAttributes();
        assertEquals(AudioAttributes.USAGE_MEDIA, attributes.getUsage());
        assertEquals(AudioAttributes.CONTENT_TYPE_MUSIC, attributes.getContentType());
        assertEquals(5_480L, ArenaLaunchSound.SCORE_DURATION_MS);
    }

    @Test public void fiveSecondOfflineBgmIsBundledAsValidPcmWave() throws IOException {
        Context context = RuntimeEnvironment.getApplication();
        try (InputStream input = context.getResources().openRawResource(R.raw.fc_arena_intro_bgm)) {
            byte[] header = new byte[44];
            int count = 0;
            while (count < header.length) {
                int read = input.read(header, count, header.length - count);
                if (read < 0) break;
                count += read;
            }
            assertEquals("A 44-byte WAV header is required", 44, count);
            assertEquals("RIFF", ascii(header, 0, 4));
            assertEquals("WAVE", ascii(header, 8, 4));
            assertEquals("fmt ", ascii(header, 12, 4));
            assertEquals("data", ascii(header, 36, 4));
            assertEquals("PCM format", 1, le16(header, 20));
            assertEquals("Mono audio", 1, le16(header, 22));
            assertEquals("22.05 kHz soundtrack", 22050, le32(header, 24));
            assertEquals("16-bit PCM", 16, le16(header, 34));
            assertTrue("Intro score should contain five seconds of samples",
                    le32(header, 40) >= (5 * 22050 * 2));
        }
    }
}
