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
import android.view.View;

/** Starts on the platform splash's crest and adds pitch markings while the WebView loads. */
final class ArenaLaunchView extends View {
    static final long REVEAL_DURATION_MS = 650L;
    private final int background;
    private final int gold;
    private final int white;
    private final Drawable crest;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final float density;
    private final boolean motionEnabled;
    private final String tagline;
    private final Runnable startPresentation;
    private RadialGradient floodlights;
    private LinearGradient pitchSweep;
    private long revealStartedAt = -1L;
    private float progress;
    private boolean drawn;

    ArenaLaunchView(Context context, boolean motionEnabled, Runnable onFirstFrame) {
        super(context);
        this.motionEnabled = motionEnabled;
        background = context.getColor(R.color.fc_navy);
        gold = context.getColor(R.color.fc_gold);
        white = context.getColor(R.color.fc_white);
        crest = context.getDrawable(R.drawable.fc_arena_launcher);
        tagline = context.getString(R.string.launch_tagline);
        density = getResources().getDisplayMetrics().density;
        int halfCrest = Math.round(dp(58));
        crest.setBounds(-halfCrest, -halfCrest, halfCrest, halfCrest);
        setClickable(true); // Keep a tap on the reveal from reaching covered WebView controls.
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
        startPresentation = onFirstFrame;
    }

    @Override
    protected void onDetachedFromWindow() {
        removeCallbacks(startPresentation);
        revealStartedAt = -1L;
        super.onDetachedFromWindow();
    }

    boolean hasMotion() {
        return motionEnabled;
    }

    void finishReveal() {
        revealStartedAt = -1L;
        progress = 1f;
        invalidate();
    }

    @Override
    protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
        if (width <= 0 || height <= 0) return;
        floodlights = new RadialGradient(width / 2f, height / 2f, Math.max(1f, width * 0.65f),
                new int[]{0xFF1C3653, 0xFF0C1B2B, background},
                new float[]{0f, 0.46f, 1f}, Shader.TileMode.CLAMP);
        pitchSweep = new LinearGradient(0f, 0f, width / 2f, 0f,
                new int[]{0x004F89B8, 0xFF75B7E8, gold},
                new float[]{0f, 0.63f, 1f}, Shader.TileMode.MIRROR);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        if (!drawn) {
            drawn = true;
            if (motionEnabled) revealStartedAt = SystemClock.uptimeMillis();
            post(startPresentation);
        }
        if (revealStartedAt >= 0L) {
            progress = Math.min(1f, (SystemClock.uptimeMillis() - revealStartedAt) / (float) REVEAL_DURATION_MS);
            if (progress < 1f) postInvalidateOnAnimation();
        }
        canvas.drawColor(background);
        float centerX = getWidth() / 2f;
        float centerY = getHeight() / 2f;
        if (motionEnabled && floodlights != null) {
            drawPitch(canvas, centerX, centerY);
        }

        canvas.save();
        canvas.translate(centerX, centerY);
        crest.draw(canvas);
        canvas.restore();

        if (motionEnabled && progress > 0.33f) {
            paint.setColor(white);
            paint.setAlpha(Math.round(fraction(0.33f, 0.74f) * 240));
            paint.setTypeface(Typeface.DEFAULT_BOLD);
            paint.setTextAlign(Paint.Align.CENTER);
            paint.setTextSize(dp(11));
            canvas.drawText(tagline, centerX, centerY + dp(86), paint);
        }
    }

    private void drawPitch(Canvas canvas, float centerX, float centerY) {
        paint.setStyle(Paint.Style.FILL);
        paint.setShader(floodlights);
        paint.setAlpha(65 + Math.round(fraction(0f, 0.35f) * 145));
        canvas.drawRect(0, 0, getWidth(), getHeight(), paint);

        float halfWidth = Math.min(dp(174), centerX * 0.89f);
        float halfHeight = Math.min(dp(133), centerY * 0.9f);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(1.5f));
        paint.setShader(pitchSweep);
        paint.setAlpha(80 + Math.round(fraction(0f, 0.53f) * 150));
        canvas.drawRoundRect(centerX - halfWidth, centerY - halfHeight, centerX + halfWidth,
                centerY + halfHeight, dp(8), dp(8), paint);
        canvas.drawCircle(centerX, centerY, Math.min(dp(77), halfHeight * 0.78f), paint);
        canvas.drawLine(centerX, centerY - halfHeight, centerX, centerY + halfHeight, paint);

        float lineInset = halfWidth * fraction(0.05f, 0.5f);
        paint.setStrokeWidth(dp(1.5f));
        canvas.drawLine(centerX - halfWidth, centerY, centerX - halfWidth + lineInset, centerY, paint);
        canvas.drawLine(centerX + halfWidth, centerY, centerX + halfWidth - lineInset, centerY, paint);
        paint.setShader(null);
        paint.setStyle(Paint.Style.FILL);
    }

    private float fraction(float start, float end) {
        return Math.max(0f, Math.min(1f, (progress - start) / (end - start)));
    }

    private float dp(float value) {
        return value * density;
    }
}
