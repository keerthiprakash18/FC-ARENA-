package in.fcarena.app;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.View;

/**
 * Original FC ARENA native launch film.
 *
 * Runs entirely with lightweight Canvas drawing so even offline cold launches
 * have a deterministic, branded 5.5s presentation. No remote video or image
 * requests, bitmap allocations or layout changes in the frame loop.
 */
final class ArenaLaunchView extends View {
    static final long REVEAL_DURATION_MS = 5_500L;

    private static final int NAVY = 0xFF06101E;
    private static final int CYAN = 0xFF55BCEB;
    private static final int GOLD = 0xFFEBBD6E;
    private static final int WHITE = 0xFFEAF3FC;
    private static final int MUTED = 0xFF9BB3CB;

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Drawable crest;
    private final float density;
    private final boolean motionEnabled;
    private final String tagline;
    private final Runnable startPresentation;
    private final Runnable soundToggle;
    private final float[] dustX = new float[42];
    private final float[] dustY = new float[42];
    private final float[] dustSpeed = new float[42];
    private RadialGradient stadiumGlow;
    private LinearGradient pitchLight;
    private long startedAt = -1L;
    private float progress;
    private boolean drawn;
    private boolean soundEnabled;

    ArenaLaunchView(Context context, boolean motionEnabled, boolean soundEnabled,
                    Runnable onFirstFrame, Runnable onSoundToggle) {
        super(context);
        this.motionEnabled = motionEnabled;
        this.soundEnabled = soundEnabled;
        this.startPresentation = onFirstFrame;
        this.soundToggle = onSoundToggle;
        this.crest = context.getDrawable(R.drawable.fc_arena_launcher);
        this.tagline = context.getString(R.string.launch_tagline);
        this.density = getResources().getDisplayMetrics().density;
        for (int i = 0; i < dustX.length; i++) {
            dustX[i] = ((i * 73 + 29) % 101) / 101f;
            dustY[i] = ((i * 37 + 11) % 97) / 97f;
            dustSpeed[i] = 0.3f + (i % 7) * 0.14f;
        }
        setClickable(true);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
        setContentDescription("FC ARENA cinematic launch. Tap the sound control at bottom to toggle intro audio.");
    }

    void setSoundEnabled(boolean enabled) {
        soundEnabled = enabled;
        invalidate();
    }

    @Override
    protected void onDetachedFromWindow() {
        removeCallbacks(startPresentation);
        startedAt = -1L;
        super.onDetachedFromWindow();
    }

    boolean hasMotion() {
        return motionEnabled;
    }

    void finishReveal() {
        progress = 1f;
        startedAt = -1L;
        invalidate();
    }

    @Override
    protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
        if (width < 1 || height < 1) return;
        stadiumGlow = new RadialGradient(width / 2f, height * .54f,
                Math.max(width * .8f, height * .42f),
                new int[]{0xFF1E4568, 0xFF0B1A2C, NAVY},
                new float[]{0f, .42f, 1f}, Shader.TileMode.CLAMP);
        pitchLight = new LinearGradient(width * .14f, 0f, width * .86f, 0f,
                new int[]{0x3359A9DA, CYAN, GOLD, 0x3359A9DA}, null, Shader.TileMode.CLAMP);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        if (!drawn) {
            drawn = true;
            if (motionEnabled) startedAt = SystemClock.uptimeMillis();
            post(startPresentation);
        }
        if (startedAt >= 0L) {
            progress = Math.min(1f, (SystemClock.uptimeMillis() - startedAt)
                    / (float) REVEAL_DURATION_MS);
            if (progress < 1f) postInvalidateOnAnimation();
        } else if (!motionEnabled) {
            progress = 1f;
        }

        canvas.drawColor(NAVY);
        final float w = getWidth(), h = getHeight();
        final float cx = w * .5f, cy = h * .49f;

        // Floodlight halo: brightens gently instead of flashing the whole screen.
        paint.setShader(stadiumGlow);
        paint.setStyle(Paint.Style.FILL);
        paint.setAlpha((int) (170f * ease(fraction(0f, .36f))));
        canvas.drawRect(0f, 0f, w, h, paint);
        resetPaint();

        // Edge floodlights and moving particles are all generated locally.
        final float glow = fraction(.05f, .38f) * (1f - .35f * fraction(.78f, 1f));
        drawLight(canvas, w * .09f, h * .15f, w * .35f, h * .35f, glow);
        drawLight(canvas, w * .91f, h * .15f, w * .65f, h * .35f, glow);
        drawParticles(canvas, w, h, fraction(.13f, .94f));

        // Arena outline materializes before the crest to convey football.
        drawPitch(canvas, cx, cy, Math.min(w * .42f, dp(188)), dp(140),
                ease(fraction(.07f, .48f)));

        // Gold and cyan orbit arcs converge to the club identity.
        float orbit = fraction(.17f, .6f);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(1.6f));
        paint.setColor(CYAN);
        paint.setAlpha((int) (210 * Math.sin(Math.PI * Math.min(1f, orbit))));
        float rotation = 160f * (1f - ease(orbit));
        canvas.drawArc(cx - dp(82), cy - dp(82), cx + dp(82), cy + dp(82),
                rotation + 30f, 105f * orbit, false, paint);
        paint.setColor(GOLD);
        canvas.drawArc(cx - dp(91), cy - dp(91), cx + dp(91), cy + dp(91),
                rotation + 215f, 90f * orbit, false, paint);
        resetPaint();

        float crestAppear = ease(fraction(.26f, .59f));
        if (crestAppear > 0f) {
            canvas.save();
            canvas.translate(cx, cy - dp(36));
            float scale = .78f + .22f * crestAppear;
            canvas.scale(scale, scale);
            int half = Math.round(dp(62));
            crest.setBounds(-half, -half, half, half);
            crest.setAlpha((int) (255f * crestAppear));
            crest.draw(canvas);
            canvas.restore();
        }

        // Original editorial typography; center aligned beneath the official crest.
        drawText(canvas, "F C   A R E N A", cx, cy + dp(73), dp(23), WHITE,
                Typeface.DEFAULT_BOLD, fraction(.53f, .72f));
        drawText(canvas, tagline, cx, cy + dp(106), dp(11), GOLD,
                Typeface.DEFAULT, fraction(.67f, .83f));

        // Premium punctuation: an underline that arrives with the musical resolution.
        float line = ease(fraction(.73f, .92f));
        paint.setColor(GOLD);
        paint.setStrokeWidth(dp(1.5f));
        paint.setAlpha((int) (205 * line));
        canvas.drawLine(cx - dp(34) * line, cy + dp(124),
                cx + dp(34) * line, cy + dp(124), paint);
        resetPaint();

        if (motionEnabled) {
            drawText(canvas, soundEnabled ? "♪  SOUND ON" : "♪  SOUND OFF",
                    cx, h - dp(62), dp(10), MUTED, Typeface.DEFAULT,
                    fraction(.1f, .3f));
        }
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_UP
                && event.getY() >= getHeight() - dp(100)
                && motionEnabled) {
            performClick();
            soundToggle.run();
            return true;
        }
        return true; // Prevent presses from reaching the WebView underneath.
    }

    @Override
    public boolean performClick() {
        super.performClick();
        return true;
    }

    private void drawLight(Canvas canvas, float x1, float y1, float x2, float y2,
                           float amount) {
        paint.setColor(CYAN);
        paint.setAlpha((int) (110 * amount));
        paint.setStrokeWidth(dp(1.3f));
        canvas.drawLine(x1, y1, x2, y2, paint);
        paint.setColor(WHITE);
        paint.setAlpha((int) (130 * amount));
        canvas.drawCircle(x1, y1, dp(2.8f), paint);
        resetPaint();
    }

    private void drawParticles(Canvas canvas, float w, float h, float amount) {
        for (int i = 0; i < dustX.length; i++) {
            float y = (dustY[i] * h + h * amount * dustSpeed[i] * .12f) % h;
            paint.setColor(i % 5 == 0 ? GOLD : CYAN);
            paint.setAlpha((int) ((35 + i % 4 * 16) * amount * (1f - fraction(.88f, 1f))));
            canvas.drawCircle(dustX[i] * w, y, dp(.65f + (i % 3) * .24f), paint);
        }
        resetPaint();
    }

    private void drawPitch(Canvas canvas, float cx, float cy, float halfW,
                           float halfH, float amount) {
        if (pitchLight == null || amount <= 0f) return;
        float visible = .15f + .85f * amount;
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(1.05f));
        paint.setShader(pitchLight);
        paint.setAlpha((int) (160 * visible));
        float left = cx - halfW, right = cx + halfW, top = cy - halfH, bottom = cy + halfH;
        canvas.drawRoundRect(left, top, right, bottom, dp(7), dp(7), paint);
        canvas.drawLine(cx, top, cx, bottom, paint);
        canvas.drawCircle(cx, cy, dp(51), paint);
        canvas.drawRect(left, cy - dp(43), left + dp(35), cy + dp(43), paint);
        canvas.drawRect(right - dp(35), cy - dp(43), right, cy + dp(43), paint);
        resetPaint();
    }

    private void drawText(Canvas canvas, String text, float x, float y, float size,
                          int color, Typeface typeface, float alpha) {
        if (alpha <= 0f) return;
        paint.setTypeface(typeface);
        paint.setTextSize(size);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setColor(color);
        paint.setAlpha((int) (255 * ease(alpha)));
        canvas.drawText(text, x, y, paint);
        resetPaint();
    }

    private void resetPaint() {
        paint.setShader(null);
        paint.setStyle(Paint.Style.FILL);
        paint.setAlpha(255);
    }

    private float fraction(float start, float end) {
        return Math.max(0f, Math.min(1f, (progress - start) / (end - start)));
    }

    private float ease(float t) {
        return t * t * (3f - 2f * t);
    }

    private float dp(float value) {
        return density * value;
    }
}
