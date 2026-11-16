package in.fcarena.app;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.SurfaceTexture;
import android.graphics.Typeface;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.util.Log;
import android.view.Gravity;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.io.IOException;

/**
 * Plays the user-approved, seven-second FC ARENA original brand film on cold
 * Android launches. The MP4 is bundled in the APK, never fetched at startup.
 *
 * TextureView (rather than SurfaceView) is intentional: its last frame can
 * crossfade together with the native splash into the already-loaded WebView.
 * MediaPlayer's AAC soundtrack is the only intro music source.
 */
final class ArenaLaunchFilmView extends FrameLayout
        implements TextureView.SurfaceTextureListener {
    static final String FILM_ASSET = "fc_arena_brand_film_v3.mp4";
    static final long FILM_DURATION_MS = 7_000L;

    interface Completion {
        void onFinished(boolean completed);
    }

    interface SoundPreference {
        void onChanged(boolean enabled);
    }

    private static final String TAG = "FCArenaBrandFilm";
    private final TextureView video;
    private final TextView audioButton;
    private final Completion completion;
    private final SoundPreference preference;
    private final float density;
    private MediaPlayer player;
    private Surface surface;
    private int sourceWidth = 1080;
    private int sourceHeight = 1920;
    private boolean soundEnabled;
    private boolean finished;
    private boolean released;

    static boolean hasBundledFilm(Context context) {
        try (AssetFileDescriptor asset = context.getAssets().openFd(FILM_ASSET)) {
            return asset != null && asset.getLength() > 100_000L;
        } catch (IOException | RuntimeException unavailable) {
            return false;
        }
    }

    ArenaLaunchFilmView(Context context, boolean initialSound,
                        SoundPreference preference, Completion completion) {
        super(context);
        this.soundEnabled = initialSound;
        this.preference = preference;
        this.completion = completion;
        density = getResources().getDisplayMetrics().density;
        setBackgroundColor(Color.BLACK);

        video = new TextureView(context);
        video.setOpaque(true);
        video.setSurfaceTextureListener(this);
        addView(video, new FrameLayout.LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));

        audioButton = new TextView(context);
        audioButton.setTextColor(0xFFE8E8E8);
        audioButton.setTextSize(11f);
        audioButton.setTypeface(Typeface.DEFAULT_BOLD);
        audioButton.setGravity(Gravity.CENTER);
        audioButton.setPadding(dp(15), dp(9), dp(15), dp(9));
        audioButton.setBackgroundColor(0x990A0D14);
        audioButton.setClickable(true);
        audioButton.setFocusable(true);
        audioButton.setOnClickListener(view -> {
            soundEnabled = !soundEnabled;
            preference.onChanged(soundEnabled);
            applySoundVolume();
            updateSoundLabel();
        });
        FrameLayout.LayoutParams buttonLayout = new FrameLayout.LayoutParams(
                LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        buttonLayout.bottomMargin = dp(24);
        addView(audioButton, buttonLayout);
        updateSoundLabel();
    }

    private int dp(float value) {
        return Math.round(value * density);
    }

    private void updateSoundLabel() {
        if (!soundEnabled) {
            audioButton.setText("♪  SOUND OFF");
            audioButton.setContentDescription("Turn on the FC ARENA opening music");
            return;
        }
        AudioManager manager =
                (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (manager != null && manager.getStreamVolume(AudioManager.STREAM_MUSIC) == 0) {
            audioButton.setText("♪  MEDIA MUTED");
            audioButton.setContentDescription("Media volume is zero; raise it to hear the intro");
        } else {
            audioButton.setText("♪  SOUND ON");
            audioButton.setContentDescription("Turn off the FC ARENA opening music");
        }
    }

    private void applySoundVolume() {
        MediaPlayer current = player;
        if (current == null || released) return;
        try {
            AudioManager manager =
                    (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            boolean otherMusic = manager != null && manager.isMusicActive()
                    && !current.isPlaying();
            float volume = soundEnabled && !otherMusic ? 0.94f : 0f;
            current.setVolume(volume, volume);
        } catch (RuntimeException error) {
            Log.w(TAG, "Unable to update launch media volume.");
        }
    }

    @Override
    public void onSurfaceTextureAvailable(SurfaceTexture texture, int width, int height) {
        if (released || player != null) return;
        try {
            surface = new Surface(texture);
            MediaPlayer current = new MediaPlayer();
            player = current;
            current.setSurface(surface);
            current.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
            try (AssetFileDescriptor asset = getContext().getAssets().openFd(FILM_ASSET)) {
                current.setDataSource(asset.getFileDescriptor(),
                        asset.getStartOffset(), asset.getLength());
            }

            current.setOnVideoSizeChangedListener((p, w, h) -> {
                if (w > 0 && h > 0) {
                    sourceWidth = w;
                    sourceHeight = h;
                    updateVideoTransform();
                }
            });
            current.setOnPreparedListener(prepared -> {
                if (released) return;
                try {
                    applySoundVolume();
                    prepared.start();
                    Log.i(TAG, "FC ARENA 7-second brand film started with bundled AAC audio.");
                } catch (RuntimeException exception) {
                    Log.w(TAG, "Brand film could not start: " + exception.getClass().getSimpleName());
                    finish(false);
                }
            });
            current.setOnCompletionListener(completed -> {
                Log.i(TAG, "FC ARENA brand film completed.");
                finish(true);
            });
            current.setOnErrorListener((failed, what, extra) -> {
                Log.w(TAG, "Brand film playback error " + what + "/" + extra);
                finish(false);
                return true;
            });
            current.setOnInfoListener((p, what, extra) -> {
                if (what == MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START) {
                    Log.i(TAG, "Brand film first video frame displayed.");
                }
                return false;
            });
            current.prepareAsync();
        } catch (IOException | RuntimeException error) {
            Log.w(TAG, "Brand film unavailable: " + error.getClass().getSimpleName());
            finish(false);
        }
    }

    @Override
    public void onSurfaceTextureSizeChanged(SurfaceTexture texture, int width, int height) {
        updateVideoTransform();
    }

    @Override
    public boolean onSurfaceTextureDestroyed(SurfaceTexture texture) {
        if (!released && !finished) finish(false);
        release();
        return true;
    }

    @Override
    public void onSurfaceTextureUpdated(SurfaceTexture texture) { }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        updateVideoTransform();
    }

    private void updateVideoTransform() {
        int width = video.getWidth(), height = video.getHeight();
        if (width <= 0 || height <= 0 || sourceWidth <= 0 || sourceHeight <= 0) return;
        float scale = Math.max(width / (float) sourceWidth,
                height / (float) sourceHeight);
        Matrix matrix = new Matrix();
        matrix.setScale(sourceWidth * scale / width,
                sourceHeight * scale / height, width / 2f, height / 2f);
        video.setTransform(matrix);
    }

    private void finish(boolean completed) {
        if (finished || released) return;
        finished = true;
        completion.onFinished(completed);
    }

    void release() {
        if (released) return;
        released = true;
        if (player != null) {
            MediaPlayer current = player;
            player = null;
            try {
                current.setOnPreparedListener(null);
                current.setOnCompletionListener(null);
                current.setOnErrorListener(null);
                current.setOnVideoSizeChangedListener(null);
                current.setOnInfoListener(null);
                current.release();
            } catch (RuntimeException ignored) {
                // Never interrupt an already loading dashboard.
            }
        }
        if (surface != null) {
            surface.release();
            surface = null;
        }
    }

    @Override
    protected void onDetachedFromWindow() {
        release();
        super.onDetachedFromWindow();
    }
}
