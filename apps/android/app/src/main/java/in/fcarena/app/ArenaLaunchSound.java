package in.fcarena.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Process;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Original five-second FC ARENA launch score.
 *
 * Synthesized offline on a worker thread: cinematic pad, bass pulse, ascending
 * arpeggio and short stadium-style resolve. No third-party copyrighted audio,
 * network call, streaming service, extra permission or bundled multi-MB file.
 *
 * Always respects device silent/vibrate mode and existing music playback.
 */
final class ArenaLaunchSound {
    private static final int RATE = 22_050;
    private static final double DURATION = 5.48;
    private final AtomicBoolean stopped = new AtomicBoolean(false);
    private volatile AudioTrack track;

    private ArenaLaunchSound() {}

    static ArenaLaunchSound start(Context context) {
        final AudioManager manager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (manager == null || manager.getRingerMode() != AudioManager.RINGER_MODE_NORMAL
                || manager.isMusicActive()) return null;

        ArenaLaunchSound sound = new ArenaLaunchSound();
        Thread worker = new Thread(sound::renderAndPlay, "fc-arena-launch-score");
        worker.setDaemon(true);
        worker.start();
        return sound;
    }

    void stop() {
        stopped.set(true);
        AudioTrack current = track;
        if (current != null) {
            try { current.pause(); } catch (IllegalStateException ignored) { }
            try { current.flush(); } catch (IllegalStateException ignored) { }
            try { current.release(); } catch (RuntimeException ignored) { }
            track = null;
        }
    }

    private void renderAndPlay() {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO);
        final int frames = (int) (RATE * DURATION);
        final short[] pcm = new short[frames];
        // Minor-key cinematic progression: Dm / Bb / F / C -> Dm resolution.
        final double[][] chords = {
                {146.83, 174.61, 220.00}, {116.54, 146.83, 174.61},
                {130.81, 164.81, 220.00}, {130.81, 164.81, 196.00},
                {146.83, 174.61, 220.00}
        };
        final double[] melody = {293.66, 349.23, 440.00, 523.25,
                587.33, 698.46, 880.00, 698.46, 880.00, 587.33};
        int noise = 1234567;
        double metallic = 0.0;
        for (int i = 0; i < frames && !stopped.get(); i++) {
            double t = i / (double) RATE;
            int chordIndex = Math.min(4, (int) (t / 1.1));
            double[] chord = chords[chordIndex];
            double pad = 0.0;
            // Warm, beating detuned harmonics, gently rising in the mix.
            for (double f : chord) {
                pad += Math.sin(2 * Math.PI * f * t + .07 * Math.sin(2 * Math.PI * .9 * t))
                        + .25 * Math.sin(2 * Math.PI * f * 2.005 * t);
            }
            pad *= .038 * Math.min(1, Math.max(0, (t - .15) / 1.5));
            // Deep low pulse: soft attack, rapid decay, no abrasive clipping.
            double phase = t % 1.1;
            double kick = phase < .34
                    ? Math.sin(2 * Math.PI * (54 - phase * 62) * phase)
                      * .16 * Math.exp(-phase * 15)
                    : 0.0;
            // Glassy ascending notes appear after the football pitch reveals.
            double step = (t - 1.35) / .37;
            double pluck = 0.0;
            if (step >= 0 && step < melody.length) {
                int index = (int) step;
                double elapsed = (step - index) * .37;
                double f = melody[index];
                double envelope = (1 - Math.exp(-elapsed * 120)) * Math.exp(-elapsed * 9);
                pluck = envelope * (.18 * Math.sin(2 * Math.PI * f * t)
                        + .044 * Math.sin(2 * Math.PI * 2.01 * f * t));
            }
            // Air shimmer and stadium-rise, deterministic noise not random garbage.
            noise ^= noise << 13; noise ^= noise >>> 17; noise ^= noise << 5;
            double white = (noise & 65535) / 32768.0 - 1.0;
            metallic = metallic * .91 + white * .09;
            double rise = Math.max(0, Math.min(1, (t - 2.4) / 2.2));
            double air = metallic * .025 * rise;
            // Final two-note resolve and low cinematic impact.
            double resolve = 0;
            if (t > 4.4) {
                double d = t - 4.4;
                resolve = (.17 * Math.sin(2 * Math.PI * 293.66 * d)
                        + .09 * Math.sin(2 * Math.PI * 440 * d))
                        * (1 - Math.exp(-d * 20)) * Math.exp(-d * 2.6);
            }
            double envelope = Math.min(1, t / .22) * Math.min(1, (DURATION - t) / .46);
            double mix = (pad + kick + pluck + air + resolve) * Math.max(0, envelope);
            // Fixed conservative gain; respects system media volume.
            pcm[i] = (short) (32767 * Math.max(-1, Math.min(1, mix * .70)));
        }
        if (stopped.get()) return;
        AudioTrack created = null;
        try {
            created = new AudioTrack.Builder()
                    .setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                    .setAudioFormat(new AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(RATE).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .setBufferSizeInBytes(pcm.length * 2)
                    .build();
            if (created.getState() != AudioTrack.STATE_INITIALIZED || stopped.get()) return;
            track = created;
            int count = created.write(pcm, 0, pcm.length, AudioTrack.WRITE_BLOCKING);
            if (count == pcm.length && !stopped.get()) created.play();
        } catch (RuntimeException ignored) {
            // Optional launch audio must never stop the application.
        } finally {
            if (stopped.get() && created != null) {
                try { created.release(); } catch (RuntimeException ignored) { }
                if (track == created) track = null;
            }
        }
    }
}
