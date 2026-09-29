package in.fcarena.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

/**
 * FC Arena's resilient Trusted Web Activity launcher.
 *
 * Uses Android Browser Helper for the normal TWA flow. If a device/browser combination
 * throws during native startup, the launcher falls back to the verified HTTPS origin
 * instead of terminating the app process with "FC ARENA keeps stopping".
 */
public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    private static final String TAG = "FCArenaLauncher";
    private static final Uri SAFE_START_URL = Uri.parse("https://fcarena.in/");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try {
            super.onCreate(savedInstanceState);
        } catch (Throwable launchError) {
            Log.e(TAG, "Trusted Web Activity startup failed; using browser fallback.", launchError);
            launchSafeBrowserFallback();
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        Uri uri = super.getLaunchingUrl();

        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) {
            return SAFE_START_URL;
        }

        return uri;
    }

    private void launchSafeBrowserFallback() {
        try {
            Intent fallback = new Intent(Intent.ACTION_VIEW, SAFE_START_URL);
            fallback.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(fallback);
        } catch (Throwable fallbackError) {
            Log.e(TAG, "Browser fallback also failed.", fallbackError);
            Toast.makeText(
                    this,
                    "FC Arena could not open. Please update Chrome or your default browser.",
                    Toast.LENGTH_LONG
            ).show();
        } finally {
            finish();
        }
    }
}
