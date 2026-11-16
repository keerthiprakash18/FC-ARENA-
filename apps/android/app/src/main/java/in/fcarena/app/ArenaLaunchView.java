package in.fcarena.app;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.os.SystemClock;
import android.view.View;

/**
 * Original FC ARENA cold-launch cinematic. The underlying WebView loads in
 * parallel. MainActivity alone controls the visual-state-safe handoff.
 */
final class ArenaLaunchView extends View {
    static final long REVEAL_DURATION_MS = 5_450L;
    private static final int NAVY = 0xFF05080D;
    private static final int BLUE = 0xFF65CFFF;
    private static final int GOLD = 0xFFE5BF70;
    private static final int IVORY = 0xFFFFF9EC;
    private static final int PARTICLES = 28;

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path beam = new Path();
    private final Drawable crest;
    private final boolean motionEnabled;
    private final Runnable onFirstFrame;
    private final String tagline;
    private final float density;
    private RadialGradient glow;
    private RadialGradient leftFloodlight;
    private RadialGradient rightFloodlight;
    private LinearGradient horizon;
    private boolean started;
    private long startedAt = -1L;
    private float progress;

    ArenaLaunchView(Context context, boolean motionEnabled, Runnable onFirstFrame) {
        super(context);
        this.motionEnabled = motionEnabled;
        this.onFirstFrame = onFirstFrame;
        this.crest = context.getDrawable(R.drawable.fc_arena_launcher);
        this.tagline = context.getString(R.string.launch_tagline);
        this.density = getResources().getDisplayMetrics().density;
        this.progress = motionEnabled ? 0f : 1f;
        setClickable(true);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    boolean hasMotion() { return motionEnabled; }

    void finishReveal() {
        startedAt = -1L;
        progress = 1f;
        invalidate();
    }

    @Override protected void onDetachedFromWindow() {
        removeCallbacks(onFirstFrame);
        startedAt = -1L;
        super.onDetachedFromWindow();
    }

    @Override protected void onSizeChanged(int w, int h, int oldW, int oldH) {
        if (w <= 0 || h <= 0) return;
        float cx = w * 0.5f, cy = h * 0.5f;
        float radius = Math.max(w, h) * 0.75f;
        glow = new RadialGradient(cx, cy * 1.03f, radius,
                new int[]{0xFF1B3952, 0xFF0B1C2C, NAVY},
                new float[]{0f, 0.52f, 1f}, Shader.TileMode.CLAMP);
        leftFloodlight = new RadialGradient(w * 0.08f, h * 0.15f, w * 0.83f,
                new int[]{0x805FCFFF, 0x193C90D5, 0x0005080D},
                new float[]{0f, 0.48f, 1f}, Shader.TileMode.CLAMP);
        rightFloodlight = new RadialGradient(w * 0.92f, h * 0.15f, w * 0.83f,
                new int[]{0x80E6BB73, 0x163C90D5, 0x0005080D},
                new float[]{0f, 0.48f, 1f}, Shader.TileMode.CLAMP);
        horizon = new LinearGradient(0f, h * 0.55f, 0f, h,
                new int[]{0x001C5D83, 0x402A5C82, 0x0205080D},
                new float[]{0f, 0.55f, 1f}, Shader.TileMode.CLAMP);
    }

    @Override protected void onDraw(Canvas canvas) {
        if (!started) {
            started = true;
            if (motionEnabled) startedAt = SystemClock.uptimeMillis();
            post(onFirstFrame);
        }
        if (startedAt >= 0L) {
            progress = clamp((SystemClock.uptimeMillis() - startedAt)
                    / (float) REVEAL_DURATION_MS);
            if (progress < 1f) postInvalidateOnAnimation();
        }
        float w = getWidth(), h = getHeight();
        float cx = w / 2f, cy = h / 2f, t = progress;
        canvas.drawColor(NAVY);

        if (glow != null) {
            paint.setShader(glow);
            paint.setAlpha(145 + Math.round(110 * ease(0.02f, 0.3f, t)));
            canvas.drawRect(0, 0, w, h, paint);
            paint.setShader(null);
        }

        drawStadium(canvas, w, h, cx, cy, t);
        drawParticles(canvas, cx, cy, t);
        drawLogo(canvas, cx, cy, t);
        drawText(canvas, cx, cy, h, t);
        paint.setStyle(Paint.Style.FILL);
        paint.setShader(null);
        paint.setAlpha(255);
    }

    private void drawStadium(Canvas canvas, float w, float h,
                             float cx, float cy, float t) {
        float a = ease(0.03f, 0.28f, t);
        if (a <= 0f) return;
        if (leftFloodlight != null) {
            paint.setShader(leftFloodlight);
            paint.setAlpha(Math.round(180f * a));
            canvas.drawRect(0, 0, w, h, paint);
            paint.setShader(rightFloodlight);
            paint.setAlpha(Math.round(140f * a));
            canvas.drawRect(0, 0, w, h, paint);
            paint.setShader(horizon);
            canvas.drawRect(0, 0, w, h, paint);
            paint.setShader(null);
        }
        drawBeam(canvas, w * 0.1f, h * 0.1f, cx * 0.64f, h * 0.67f,
                BLUE, 28f * a);
        drawBeam(canvas, w * 0.9f, h * 0.1f, cx * 1.36f, h * 0.67f,
                GOLD, 23f * a);

        // A football stadium perspective, not a copy of another app's splash.
        paint.setStyle(Paint.Style.STROKE);
        paint.setColor(BLUE);
        paint.setStrokeWidth(dp(1f));
        paint.setAlpha(Math.round(59f * ease(0.1f, 0.42f, t)));
        float horizonY = h * 0.74f;
        for (int i = -4; i <= 4; i++) {
            canvas.drawLine(cx + i * w * 0.055f, horizonY,
                    cx + i * w * 0.15f, h, paint);
        }
        for (int i = 0; i < 5; i++) {
            float fraction = i / 4f;
            float warp = fraction * fraction;
            float y = horizonY + (h - horizonY) * warp;
            canvas.drawLine(w * (0.29f - 0.25f * warp), y,
                    w * (0.71f + 0.25f * warp), y, paint);
        }
        paint.setStyle(Paint.Style.FILL);
    }

    private void drawBeam(Canvas canvas, float x, float y,
                          float endX, float endY, int color, float alpha) {
        beam.reset();
        beam.moveTo(x - dp(10f), y);
        beam.lineTo(x + dp(10f), y);
        beam.lineTo(endX + dp(112f), endY);
        beam.lineTo(endX - dp(112f), endY);
        beam.close();
        paint.setColor(color);
        paint.setAlpha(Math.round(alpha));
        canvas.drawPath(beam, paint);
    }

    private void drawParticles(Canvas canvas, float cx, float cy, float t) {
        float a = ease(0.19f, 0.54f, t);
        if (a <= 0f) return;
        float centerY = cy - dp(19f);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(1.3f));
        for (int i = 0; i < 3; i++) {
            paint.setColor(i == 1 ? GOLD : BLUE);
            paint.setAlpha(Math.round((i == 1 ? 95f : 55f) * a));
            canvas.drawCircle(cx, centerY, dp(89f + i * 18f
                    + 2f * (float)Math.sin(t * 14f + i)), paint);
        }
        paint.setStyle(Paint.Style.FILL);
        for (int i = 0; i < PARTICLES; i++) {
            double angle = i * 2.3999632297 + t * (i % 2 == 0 ? 1.25 : -0.6);
            float orbit = dp(96f + (i * 37 % 145));
            float x = cx + (float)Math.cos(angle) * orbit;
            float y = centerY + (float)Math.sin(angle) * orbit * 1.2f;
            float shimmer = 0.55f + 0.45f * (float)Math.sin(t * 38f + i * 1.5f);
            paint.setColor(i % 5 == 0 ? GOLD : BLUE);
            paint.setAlpha(Math.round(140f * a * Math.max(0.12f, shimmer)));
            canvas.drawCircle(x, y, dp(0.7f + (i % 3) * 0.45f), paint);
        }
    }

    private void drawLogo(Canvas canvas, float cx, float cy, float t) {
        float reveal = ease(0.26f, 0.63f, t);
        if (reveal <= 0f || crest == null) return;
        canvas.save();
        canvas.translate(cx, cy - dp(19f));
        float scale = 0.73f + 0.27f * reveal;
        canvas.scale(scale, scale);
        int radius = Math.round(dp(76f));
        crest.setBounds(-radius, -radius, radius, radius);
        crest.setAlpha(Math.round(255f * reveal));
        crest.draw(canvas);
        canvas.restore();

        float flare = ease(0.68f, 0.8f, t) * (1f - ease(0.88f, 0.96f, t));
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(2.5f));
        paint.setColor(GOLD);
        paint.setAlpha(Math.round(155f * flare));
        canvas.drawCircle(cx, cy - dp(19f), dp(95f), paint);
        paint.setStyle(Paint.Style.FILL);
    }

    private void drawText(Canvas canvas, float cx, float cy, float h, float t) {
        float reveal = ease(0.53f, 0.77f, t);
        if (reveal <= 0f) return;
        paint.setTypeface(Typeface.create("sans-serif-black", Typeface.BOLD));
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTextSize(dp(26f));
        paint.setColor(IVORY);
        paint.setAlpha(Math.round(250f * reveal));
        canvas.drawText("FC ARENA", cx, cy + dp(128f), paint);

        paint.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        paint.setTextSize(dp(10.5f));
        paint.setColor(GOLD);
        paint.setAlpha(Math.round(240f * ease(0.7f, 0.86f, t)));
        canvas.drawText(tagline, cx, cy + dp(157f), paint);

        paint.setTypeface(Typeface.DEFAULT);
        paint.setTextSize(dp(10f));
        paint.setColor(0xFF93B5C9);
        paint.setAlpha(Math.round(155f * ease(0.78f, 0.94f, t)));
        canvas.drawText("ENTER THE ARENA", cx, h - dp(56f), paint);
    }

    private static float clamp(float value) {
        return Math.max(0f, Math.min(1f, value));
    }
    private static float ease(float start, float end, float t) {
        float x = clamp((t - start) / (end - start));
        return x * x * (3f - 2f * x);
    }
    private float dp(float value) { return value * density; }
}
