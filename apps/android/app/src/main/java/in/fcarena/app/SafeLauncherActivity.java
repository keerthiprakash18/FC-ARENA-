package in.fcarena.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import androidx.annotation.Nullable;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * Defensive FC Arena launcher.
 *
 * The normal path is Android Browser Helper's Trusted Web Activity launcher.
 * If the browser/TWA stack throws during startup on a specific device, fall
 * back to the production HTTPS URL instead of terminating the app process.
 */
public final class SafeLauncherActivity extends LauncherActivity {
    private static final String TAG = "FCArenaLauncher";
    private static final Uri FALLBACK_URL =
            Uri.parse("https://fcarena.in/dashboard");

    private boolean fallbackStarted = false;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        try {
            super.onCreate(savedInstanceState);
        } catch (Throwable error) {
            Log.e(TAG, "TWA startup failed; using browser fallback.", error);
            openBrowserFallback();
        }
    }

    @Override
    protected void launchTwa() {
        try {
            super.launchTwa();
        } catch (Throwable error) {
            Log.e(TAG, "TWA launch failed; using browser fallback.", error);
            openBrowserFallback();
        }
    }

    private void openBrowserFallback() {
        if (fallbackStarted || isFinishing()) {
            return;
        }
        fallbackStarted = true;

        Intent browserIntent = new Intent(Intent.ACTION_VIEW, FALLBACK_URL);
        browserIntent.addCategory(Intent.CATEGORY_BROWSABLE);
        browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            startActivity(browserIntent);
        } catch (ActivityNotFoundException error) {
            Log.e(TAG, "No browser is available for FC Arena fallback.", error);
            Toast.makeText(
                    this,
                    "Open https://fcarena.in in your browser.",
                    Toast.LENGTH_LONG
            ).show();
        } finally {
            finish();
        }
    }
}
