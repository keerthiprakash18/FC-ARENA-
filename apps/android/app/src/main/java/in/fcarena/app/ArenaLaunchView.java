package in.fcarena.app;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.view.View;
import android.view.animation.LinearInterpolator;

/** Starts on the platform splash's crest and adds pitch markings while the WebView loads. */
final class ArenaLaunchView extends View {
    private final int background;
    private final int gold;
    private final int white;
    private final Drawable crest;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final float density;
    private final boolean motionEnabled;
    private final String tagline;
    private ValueAnimator reveal;
    private RadialGradient floodlights;
    private LinearGradient pitchSweep;
    private float progress;

    ArenaLaunchView(Context context, boolean motionEnabled) {
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
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        if (!motionEnabled) return;
        reveal = ValueAnimator.ofFloat(0f, 1f);
        reveal.setDuration(800);
        reveal.setInterpolator(new LinearInterpolator());
        reveal.addUpdateListener(frame -> {
            progress = (float) frame.getAnimatedValue();
            invalidate();
        });
        reveal.start();
    }

    @Override
    protected void onDetachedFromWindow() {
        stopReveal();
        super.onDetachedFromWindow();
    }

    boolean hasMotion() {
        return motionEnabled;
    }

    void stopReveal() {
        if (reveal != null) {
            reveal.cancel();
            reveal = null;
        }
    }

    @Override
    protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
        floodlights = new RadialGradient(width / 2f, height / 2f, Math.max(1f, width * 0.65f),
                new int[]{0xFF1C3653, 0xFF0C1B2B, background},
                new float[]{0f, 0.46f, 1f}, Shader.TileMode.CLAMP);
        pitchSweep = new LinearGradient(0f, 0f, width / 2f, 0f,
                new int[]{0x004F89B8, 0xFF75B7E8, gold},
                new float[]{0f, 0.63f, 1f}, Shader.TileMode.MIRROR);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        canvas.drawColor(background);
        float centerX = getWidth() / 2f;
        float centerY = getHeight() / 2f;
        if (motionEnabled && getWidth() > 0) {
            drawPitch(canvas, centerX, centerY);
        }

        canvas.save();
        canvas.translate(centerX, centerY);
        crest.draw(canvas);
        canvas.restore();

        if (motionEnabled && progress > 0.58f) {
            paint.setColor(white);
            paint.setAlpha(Math.round(fraction(0.58f, 0.88f) * 225));
            paint.setTypeface(Typeface.DEFAULT_BOLD);
            paint.setTextAlign(Paint.Align.CENTER);
            paint.setTextSize(dp(11));
            canvas.drawText(tagline, centerX, centerY + dp(86), paint);
        }
    }

    private void drawPitch(Canvas canvas, float centerX, float centerY) {
        paint.setStyle(Paint.Style.FILL);
        paint.setShader(floodlights);
        paint.setAlpha(Math.round(fraction(0f, 0.44f) * 190));
        canvas.drawRect(0, 0, getWidth(), getHeight(), paint);

        float halfWidth = Math.min(dp(174), centerX * 0.89f);
        float halfHeight = Math.min(dp(133), centerY * 0.9f);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(1));
        paint.setShader(pitchSweep);
        paint.setAlpha(Math.round(fraction(0.12f, 0.58f) * 130));
        canvas.drawRoundRect(centerX - halfWidth, centerY - halfHeight, centerX + halfWidth,
                centerY + halfHeight, dp(8), dp(8), paint);
        canvas.drawCircle(centerX, centerY, Math.min(dp(77), halfHeight * 0.78f), paint);

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
