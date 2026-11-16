package in.fcarena.app;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.util.Log;

import java.io.IOException;

/**
 * Original, offline FC ARENA cinematic score.
 *
 * The 5.48-second PCM WAV is pre-rendered at build time and bundled in res/raw.
 * Playback therefore begins without startup CPU-intensive audio synthesis,
 * network access or a third-party copyrighted music service.
 *
 * This is MUSIC routed to the MEDIA volume stream, not an Android notification
 * or system effect. Silent/vibrate ringer mode does not automatically mute media.
 * Sound is user-toggleable and will not interrupt already-active music playback.
 */
final class ArenaLaunchSound {
    private static final String TAG = "FCArenaIntroAudio";
    static final long SCORE_DURATION_MS = 5_480L;

    private MediaPlayer player;
    private boolean stopped;

    private ArenaLaunchSound(MediaPlayer player) {
        this.player = player;
    }

    static AudioAttributes mediaAttributes() {
        return new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();
    }

    static ArenaLaunchSound start(Context context, long elapsedMs) {
        AudioManager manager =
                (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (manager == null) {
            Log.w(TAG, "Launch BGM disabled: no audio service.");
            return null;
        }
        if (manager.getStreamVolume(AudioManager.STREAM_MUSIC) <= 0) {
            Log.i(TAG, "Launch BGM muted: raise Media volume, not ringtone volume.");
            return null;
        }
        if (manager.isMusicActive()) {
            Log.i(TAG, "Launch BGM skipped: another audio stream is active.");
            return null;
        }

        if (elapsedMs >= SCORE_DURATION_MS - 150L) {
            return null; // A nearly finished intro should not start a late soundtrack.
        }

        MediaPlayer mediaPlayer = null;
        try {
            mediaPlayer = new MediaPlayer();
            final ArenaLaunchSound sound = new ArenaLaunchSound(mediaPlayer);
            final long positionMs = Math.max(0L, elapsedMs);

            mediaPlayer.setAudioAttributes(mediaAttributes());

            try (AssetFileDescriptor asset =
                         context.getResources().openRawResourceFd(R.raw.fc_arena_intro_bgm)) {
                if (asset == null) {
                    Log.w(TAG, "Launch BGM asset was not found.");
                    mediaPlayer.release();
                    return null;
                }
                mediaPlayer.setDataSource(asset.getFileDescriptor(),
                        asset.getStartOffset(), asset.getLength());
            }

            mediaPlayer.setOnPreparedListener(prepared -> {
                if (sound.stopped) return;
                try {
                    prepared.setVolume(0.92f, 0.92f);
                    if (positionMs > 0L) {
                        prepared.seekTo((int) Math.min(positionMs, SCORE_DURATION_MS - 150L));
                    }
                    prepared.start();
                    Log.i(TAG, "Playing bundled FC ARENA BGM on STREAM_MUSIC.");
                } catch (IllegalStateException error) {
                    Log.w(TAG, "BGM could not start: " + error.getClass().getSimpleName());
                    sound.stop();
                }
            });
            mediaPlayer.setOnCompletionListener(completed -> sound.stop());
            mediaPlayer.setOnErrorListener((errored, what, extra) -> {
                Log.w(TAG, "BGM playback failed: media error=" + what + ", extra=" + extra);
                sound.stop();
                return true;
            });
            mediaPlayer.prepareAsync();
            return sound;
        } catch (IOException | RuntimeException error) {
            Log.w(TAG, "BGM preparation failed: " + error.getClass().getSimpleName());
            if (mediaPlayer != null) {
                try { mediaPlayer.release(); } catch (RuntimeException ignored) { }
            }
            return null; // Never block the user from entering FC ARENA.
        }
    }

    void stop() {
        if (stopped) return;
        stopped = true;
        MediaPlayer current = player;
        player = null;
        if (current != null) {
            try {
                current.setOnPreparedListener(null);
                current.setOnCompletionListener(null);
                current.setOnErrorListener(null);
                current.release();
            } catch (RuntimeException ignored) {
                // Release failures must not affect the dashboard or app lifecycle.
            }
        }
    }
}
