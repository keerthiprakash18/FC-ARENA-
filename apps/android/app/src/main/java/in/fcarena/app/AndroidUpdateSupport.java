package in.fcarena.app;

import android.content.Context;
import android.net.Uri;
import android.os.SystemClock;
import android.webkit.WebView;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.model.UpdateAvailability;
import org.json.JSONException;
import org.json.JSONObject;

/** Play reports availability for the installed account, device and release track. */
final class AndroidUpdateSupport {
    private final AppUpdateManager manager;
    private boolean checking;
    private boolean checked;
    private int availableVersion;
    private long nextCheckAt;

    AndroidUpdateSupport(Context context) { this(AppUpdateManagerFactory.create(context.getApplicationContext())); }
    AndroidUpdateSupport(AppUpdateManager manager) { this.manager = manager; }

    void check(Runnable changed) {
        if (checking || SystemClock.elapsedRealtime() < nextCheckAt) return;
        checking = true;
        nextCheckAt = SystemClock.elapsedRealtime() + 60_000L;
        try {
            manager.getAppUpdateInfo().addOnSuccessListener(info -> {
                checking = false;
                checked = true;
                availableVersion = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                        && info.availableVersionCode() > BuildConfig.VERSION_CODE ? info.availableVersionCode() : 0;
                nextCheckAt = SystemClock.elapsedRealtime() + 15L * 60L * 1000L;
                changed.run();
            }).addOnFailureListener(error -> {
                checking = false;
                // Offline, sideloaded and non-Play devices continue using the app normally.
            });
        } catch (RuntimeException ignored) { checking = false; }
    }

    JSONObject snapshot() throws JSONException {
        return new JSONObject().put("checked", checked).put("available", availableVersion > BuildConfig.VERSION_CODE)
                .put("installedVersionCode", BuildConfig.VERSION_CODE).put("availableVersionCode", availableVersion);
    }

    void publish(WebView view) {
        if (!checked || view == null || view.getUrl() == null) return;
        Uri uri = Uri.parse(view.getUrl());
        if (!"https".equals(uri.getScheme()) || !"fcarena.in".equals(uri.getHost()) || (uri.getPort() != -1 && uri.getPort() != 443)) return;
        try {
            view.evaluateJavascript("window.__fcAndroidUpdate=" + snapshot()
                    + ";window.dispatchEvent(new Event('fc-arena:android-update'));", null);
        } catch (JSONException | RuntimeException ignored) { /* Optional notice must never interrupt navigation. */ }
    }
}
