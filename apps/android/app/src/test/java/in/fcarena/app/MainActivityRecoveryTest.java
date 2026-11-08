package in.fcarena.app;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import android.widget.Button;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;

import java.lang.reflect.Field;
import java.time.Duration;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {28, 35}, application = Application.class)
@LooperMode(LooperMode.Mode.PAUSED)
public class MainActivityRecoveryTest {
    private SharedPreferences preferences;
    private ActivityController<MainActivity> controller;

    @Before public void prepare() {
        preferences = RuntimeEnvironment.getApplication()
                .getSharedPreferences("fc_arena_android", Context.MODE_PRIVATE);
        preferences.edit().clear()
                .putInt("installed_version_code", BuildConfig.VERSION_CODE)
                .putLong("version_check_at", System.currentTimeMillis())
                .commit();
        ConnectivityManager manager = RuntimeEnvironment.getApplication()
                .getSystemService(ConnectivityManager.class);
        NetworkCapabilities capabilities = new NetworkCapabilities();
        shadowOf(capabilities).addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        shadowOf(capabilities).addCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        shadowOf(manager).setNetworkCapabilities(manager.getActiveNetwork(), capabilities);
    }

    @After public void close() {
        if (controller != null) controller.pause().stop().destroy();
    }

    private MainActivity launch() {
        controller = Robolectric.buildActivity(MainActivity.class).create().start().resume().visible();
        return controller.get();
    }

    @Test public void signedHttpsCardDownloadOpensAnExternalViewer() throws Exception {
        MainActivity activity = launch();
        WebView view = web(activity);
        String url = "https://api.fcarena.in/api/players/card-exports/81fb40f4-7e4f-40a6-a429-c87dd7242ae2?grant=fixture.signature";
        assertNotNull(shadowOf(view).getDownloadListener());
        shadowOf(view).getDownloadListener().onDownloadStart(url, "FC-Arena-Android/1.0.17", "attachment; filename=FC-ARENA.png", "image/png", 2048);
        Intent download = shadowOf(activity).getNextStartedActivity();
        assertNotNull("An HTTPS card must reach the Android viewer", download);
        assertEquals(Intent.ACTION_VIEW, download.getAction());
        assertEquals(Uri.parse(url), download.getData());
        assertEquals("api.fcarena.in", download.getData().getHost());
        assertFalse((boolean) field(activity, "showingOfflinePage"));
    }

    private static Object field(MainActivity activity, String name) throws Exception {
        Field field = MainActivity.class.getDeclaredField(name);
        field.setAccessible(true);
        return field.get(activity);
    }

    private static WebView web(MainActivity activity) throws Exception {
        return (WebView) field(activity, "webView");
    }

    private static Button button(View view, String text) {
        if (view instanceof Button && text.contentEquals(((Button) view).getText())) return (Button) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                Button found = button(group.getChildAt(i), text);
                if (found != null) return found;
            }
        }
        return null;
    }

    private static RenderProcessGoneDetail crashedRenderer() {
        return new RenderProcessGoneDetail() {
            @Override public boolean didCrash() { return true; }
            @Override public int rendererPriorityAtExit() { return 2; }
        };
    }

    @Test public void legacyStartupMarkerRecoversWithoutBlockingScreen() throws Exception {
        preferences.edit().putBoolean("startup_guard", true).commit();
        MainActivity activity = launch();
        assertNotNull("Legacy flag must automatically retry the in-app browser", web(activity));
        assertEquals(View.LAYER_TYPE_SOFTWARE, web(activity).getLayerType());
        assertEquals("https://fcarena.in/dashboard", shadowOf(web(activity)).getLastLoadedUrl());
        assertFalse(preferences.getBoolean("startup_guard", false));
        assertNull(button(activity.getWindow().getDecorView(), "Try FC Arena Again"));
    }

    @Test public void slowDocumentDoesNotLeaveCrashMarker() throws Exception {
        MainActivity activity = launch();
        WebView view = web(activity);
        view.getWebViewClient().onPageStarted(view, "https://fcarena.in/dashboard", null);
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(4));
        assertFalse("Network loading must not be classified as a native startup crash",
                preferences.getBoolean("startup_guard", false));
        assertFalse((boolean) field(activity, "showingOfflinePage"));
    }

    @Test public void hungDocumentShowsRecoveryAndKeepsRetryDestination() throws Exception {
        MainActivity activity = launch();
        WebView view = web(activity);
        view.getWebViewClient().onPageStarted(view, "https://fcarena.in/fixtures", null);
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(20));
        assertTrue((boolean) field(activity, "showingOfflinePage"));
        assertEquals("https://fcarena.in/fixtures", field(activity, "lastAllowedUrl"));
        assertFalse(preferences.getBoolean("startup_guard", false));
        // A user retry must load the failed page, not the offline HTML document.
        view.loadUrl("https://fcarena.in/dashboard");
        assertTrue(view.getWebViewClient().shouldOverrideUrlLoading(
                view, "https://fcarena.in/native/retry-connection"));
        assertFalse((boolean) field(activity, "showingOfflinePage"));
        assertEquals("https://fcarena.in/fixtures", shadowOf(view).getLastLoadedUrl());
    }

    @Test public void visibleDocumentDoesNotTimeoutOnSlowSubresources() throws Exception {
        MainActivity activity = launch();
        WebView view = web(activity);
        view.getWebViewClient().onPageStarted(view, "https://fcarena.in/dashboard", null);
        view.getWebViewClient().onPageCommitVisible(view, "https://fcarena.in/dashboard");
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(25));
        assertFalse((boolean) field(activity, "showingOfflinePage"));
    }

    @Test public void timeoutPausesWhileAppIsInBackground() throws Exception {
        MainActivity activity = launch();
        WebView view = web(activity);
        view.getWebViewClient().onPageStarted(view, "https://fcarena.in/dashboard", null);
        controller.pause();
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(30));
        assertFalse((boolean) field(activity, "showingOfflinePage"));
        controller.resume();
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(20));
        assertTrue((boolean) field(activity, "showingOfflinePage"));
    }

    @Test public void rendererRecoversOnceAndBoundsRepeatedFailures() throws Exception {
        MainActivity activity = launch();
        WebView first = web(activity);
        first.getWebViewClient().onRenderProcessGone(first, crashedRenderer());
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(250));
        WebView recovered = web(activity);
        assertNotNull(recovered);
        assertNotSame(first, recovered);
        assertEquals(View.LAYER_TYPE_SOFTWARE, recovered.getLayerType());
        assertEquals("https://fcarena.in/dashboard", shadowOf(recovered).getLastLoadedUrl());
        recovered.getWebViewClient().onRenderProcessGone(recovered, crashedRenderer());
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(1));
        assertNull(web(activity));
        assertNotNull(button(activity.getWindow().getDecorView(), "Try FC Arena Again"));
    }

    @Test public void rendererRecoveryWaitsUntilForeground() throws Exception {
        MainActivity activity = launch();
        WebView first = web(activity);
        controller.pause();
        first.getWebViewClient().onRenderProcessGone(first, crashedRenderer());
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(1));
        assertNull("Do not create a replacement renderer in background", web(activity));
        controller.resume();
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(250));
        assertNotNull(web(activity));
    }

    @Test public void retryFromNativeFallbackPreservesSessionAndFreshUpdate() throws Exception {
        preferences.edit().putBoolean("startup_guard", true).putBoolean("safe_startup_guard", true)
                .putBoolean("force_fresh_web_after_update", true).putString("user_setting", "kept").commit();
        CookieManager.getInstance().setCookie("https://fcarena.in", "session=retained; Secure");
        MainActivity activity = launch();
        assertNull(web(activity));
        Button retry = button(activity.getWindow().getDecorView(), "Try FC Arena Again");
        assertNotNull(retry);
        retry.performClick();
        assertNotNull(web(activity));
        assertTrue(shadowOf(web(activity)).getLastLoadedUrl().contains("fc_native_refresh=" + BuildConfig.VERSION_CODE));
        assertTrue(CookieManager.getInstance().getCookie("https://fcarena.in").contains("session=retained"));
        assertEquals("kept", preferences.getString("user_setting", ""));
        assertFalse(preferences.getBoolean("startup_guard", false));
    }

    @Test public void websiteFallbackTargetsBrowserInsteadOfVerifiedAppLink() throws Exception {
        preferences.edit().putBoolean("startup_guard", true).putBoolean("safe_startup_guard", true).commit();
        MainActivity activity = launch();
        Intent probe = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.example.com/"));
        probe.addCategory(Intent.CATEGORY_BROWSABLE);
        ResolveInfo browser = new ResolveInfo();
        browser.activityInfo = new ActivityInfo();
        browser.activityInfo.name = "BrowserActivity";
        browser.activityInfo.packageName = "test.browser";
        shadowOf(activity.getPackageManager()).addResolveInfoForIntent(probe, browser);
        button(activity.getWindow().getDecorView(), "Open FC Arena Website").performClick();
        Intent opened = shadowOf(activity).getNextStartedActivity();
        assertNotNull(opened);
        assertEquals("test.browser", opened.getPackage());
        assertEquals("https://fcarena.in/dashboard", opened.getDataString());
    }

    @Test public void updateClearsLegacyFailureWithoutClearingUserPreferences() throws Exception {
        preferences.edit().putInt("installed_version_code", BuildConfig.VERSION_CODE - 1)
                .putBoolean("startup_guard", true).putBoolean("safe_startup_guard", true)
                .putString("user_setting", "kept").commit();
        MainActivity activity = launch();
        assertNotNull(web(activity));
        assertEquals("kept", preferences.getString("user_setting", ""));
        assertTrue(shadowOf(web(activity)).getLastLoadedUrl().contains("fc_native_refresh=" + BuildConfig.VERSION_CODE));
        assertEquals(View.LAYER_TYPE_NONE, web(activity).getLayerType());
    }
}
