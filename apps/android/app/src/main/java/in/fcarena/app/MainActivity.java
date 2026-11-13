package in.fcarena.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public final class MainActivity extends Activity {
    private static final String START_URL = "https://fcarena.in/dashboard";
    private static final String ALLOWED_HOST = "fcarena.in";
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final String PREFS_NAME = "fc_arena_android";
    private static final String STARTUP_GUARD_KEY = "startup_guard";
    private static final String SAFE_STARTUP_GUARD_KEY = "safe_startup_guard";
    private static final String VERSION_CHECK_AT_KEY = "version_check_at";
    private static final String FORCE_FRESH_WEB_KEY = "force_fresh_web_after_update";
    private static final String FRESH_WEB_QUERY_KEY = "fc_native_refresh";
    private static final String VERSION_CHECK_URL =
            "https://api.fcarena.in/api/mobile/android/version?versionCode=";
    private static final long VERSION_CHECK_INTERVAL_MS = 12L * 60L * 60L * 1000L;
    private static final int MAX_CONNECTION_RETRIES = 5;
    private static final long PAGE_LOAD_TIMEOUT_MS = 20_000L;

    private FrameLayout root;
    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileChooserCallback;
    private SharedPreferences preferences;
    private AndroidUpdateSupport playUpdates;
    private final Runnable updateRefresh = new Runnable() {
        @Override public void run() {
            if (!resumed || isFinishing() || isDestroyed()) return;
            if (playUpdates == null) {
                try { playUpdates = new AndroidUpdateSupport(MainActivity.this); } catch (RuntimeException ignored) { }
            }
            if (playUpdates != null) playUpdates.check(() -> {
                if (!isFinishing() && !isDestroyed() && !showingOfflinePage) playUpdates.publish(webView);
            });
            if (playUpdates != null && !showingOfflinePage) playUpdates.publish(webView);
            root.postDelayed(this, 15L * 60L * 1000L);
        }
    };

    private int rendererCrashCount = 0;
    private boolean softwareRendering = false;
    private String lastAllowedUrl = START_URL;
    private boolean resumed = false;
    private boolean showingOfflinePage = false;
    private boolean networkValidated = false;
    private boolean pageLoadPending = false;
    private boolean rendererRecoveryPending = false;
    private int connectionRetries = 0;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private final Runnable connectionRetry = this::retryConnection;
    private final Runnable rendererRecovery = this::recoverRenderer;
    private final Runnable pageLoadTimeout = () -> {
        if (!resumed || !pageLoadPending || webView == null || showingOfflinePage) return;
        pageLoadPending = false;
        webView.stopLoading();
        showOfflinePage();
    };

    private final class AuthPersistenceBridge {
        @JavascriptInterface
        public void flushCookies() {
            runOnUiThread(() -> CookieManager.getInstance().flush());
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // One inset owner on every supported modern Android version.
            getWindow().setDecorFitsSystemWindows(false);
        }

        root = new FrameLayout(this);
        root.setBackgroundColor(0xFF05080D);
        setContentView(root);

        // Keep WebView content outside system bars and the keyboard on SDK 35+.
        // The CSS safe-area remains zero because native insets are consumed here.
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsets(
                        android.view.WindowInsets.Type.systemBars()
                        | android.view.WindowInsets.Type.displayCutout()
                        | android.view.WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return android.view.WindowInsets.CONSUMED;
            }
            return insets;
        });
        root.requestApplyInsets();

        preferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        // Reset only build-specific crash/update bookkeeping. Keep cookies,
        // fc_push consent, app settings and WebView data across in-place updates.
        if (preferences.getInt("installed_version_code", -1) != BuildConfig.VERSION_CODE) {
            preferences.edit()
                    .putInt("installed_version_code", BuildConfig.VERSION_CODE)
                    .putBoolean(FORCE_FRESH_WEB_KEY, true)
                    .remove(STARTUP_GUARD_KEY)
                    .remove(SAFE_STARTUP_GUARD_KEY)
                    .remove(VERSION_CHECK_AT_KEY)
                    .commit();
        }
        scheduleVersionCheck();

        // The legacy marker also covered network loading and normal process
        // termination. Recover automatically once instead of treating it as
        // proof of a crash. Only an interrupted software initialization needs
        // the native fallback to prevent a repeated native startup failure.
        boolean interruptedStartup = preferences.getBoolean(STARTUP_GUARD_KEY, false);
        boolean interruptedSafeStartup = preferences.getBoolean(SAFE_STARTUP_GUARD_KEY, false);
        softwareRendering = interruptedStartup;
        clearStartupGuard();
        if (interruptedStartup && interruptedSafeStartup) {
            showNativeFallback(
                    "The in-app browser could not finish starting in recovery mode. "
                    + "Try again, or update Android System WebView and Chrome. "
                    + "You can also open FC Arena in your browser."
            );
            return;
        }

        addProgressBar();

        String initialUrl = resolveInitialUrl(getIntent());

        try {
            createWebView();
            if (shouldForceFreshWeb()) {
                // After an install/update, never restore an old WebView document.
                // Fetch the current production page once without the HTTP cache.
                // Cookies, DOM storage, push consent and user settings are preserved.
                webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
                webView.loadUrl(withFreshWebToken(initialUrl));
            } else if (savedInstanceState == null || interruptedStartup) {
                webView.loadUrl(initialUrl);
            } else if (webView.restoreState(savedInstanceState) == null) {
                webView.loadUrl(initialUrl);
            }
        } catch (Throwable error) {
            clearStartupGuard();
            showNativeFallback(
                    "FC Arena could not start the in-app browser on this device. "
                    + "You can still use the secure FC Arena website."
            );
        }
    }

    private void scheduleVersionCheck() {
        if (preferences == null) {
            return;
        }

        long now = System.currentTimeMillis();
        long lastCheckedAt = preferences.getLong(VERSION_CHECK_AT_KEY, 0L);

        if (now - lastCheckedAt < VERSION_CHECK_INTERVAL_MS) {
            return;
        }

        Thread worker = new Thread(() -> {
            HttpURLConnection connection = null;

            try {
                URL url = new URL(VERSION_CHECK_URL + BuildConfig.VERSION_CODE);
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setUseCaches(false);
                connection.setRequestProperty("Accept", "application/json");

                int statusCode = connection.getResponseCode();

                if (statusCode < 200 || statusCode >= 300) {
                    return;
                }

                StringBuilder body = new StringBuilder();

                try (
                        BufferedReader reader = new BufferedReader(
                                new InputStreamReader(
                                        connection.getInputStream(),
                                        StandardCharsets.UTF_8
                                )
                        )
                ) {
                    String line;

                    while ((line = reader.readLine()) != null) {
                        body.append(line);
                    }
                }

                JSONObject payload = new JSONObject(body.toString());
                JSONObject data = payload.optJSONObject("data");

                if (data == null) {
                    return;
                }

                if (!data.optBoolean("updateAvailable", false)) {
                    preferences.edit()
                            .putLong(VERSION_CHECK_AT_KEY, System.currentTimeMillis())
                            .apply();
                    return;
                }

                JSONObject latest = data.optJSONObject("latest");

                if (latest == null) {
                    return;
                }

                final boolean forceUpdate = data.optBoolean("forceUpdate", false);

                if (!forceUpdate) {
                    preferences.edit()
                            .putLong(VERSION_CHECK_AT_KEY, System.currentTimeMillis())
                            .apply();
                }
                final String versionName =
                        latest.optString("versionName", "new version");
                final String releaseNotes =
                        latest.isNull("releaseNotes")
                                ? ""
                                : latest.optString("releaseNotes", "").trim();
                final String playStoreUrl =
                        latest.isNull("playStoreUrl")
                                ? "https://play.google.com/store/apps/details?id=in.fcarena.app"
                                : latest.optString(
                                        "playStoreUrl",
                                        "https://play.google.com/store/apps/details?id=in.fcarena.app"
                                );

                runOnUiThread(() ->
                        showVersionUpdateDialog(
                                versionName,
                                releaseNotes,
                                playStoreUrl,
                                forceUpdate
                        )
                );
            } catch (Throwable ignored) {
                // Version checks must never block app startup.
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }, "fc-arena-version-check");

        worker.setDaemon(true);
        worker.start();
    }

    private void showVersionUpdateDialog(
            String latestVersionName,
            String releaseNotes,
            String playStoreUrl,
            boolean forceUpdate
    ) {
        if (isFinishing() || isDestroyed()) {
            return;
        }

        StringBuilder message = new StringBuilder();
        message.append("FC Arena ")
                .append(latestVersionName)
                .append(" is available.");

        if (!releaseNotes.isEmpty()) {
            message.append("\n\n").append(releaseNotes);
        }

        AlertDialog.Builder builder = new AlertDialog.Builder(this)
                .setTitle(forceUpdate ? "FC ARENA Update Required" : "FC ARENA Update Available")
                .setMessage(message.toString())
                .setPositiveButton(
                        "Update",
                        (dialog, which) -> openExternal(Uri.parse(playStoreUrl))
                );

        if (forceUpdate) {
            builder.setCancelable(false);
        } else {
            builder.setNegativeButton("Later", null);
        }

        AlertDialog dialog = builder.create();
        dialog.setCanceledOnTouchOutside(!forceUpdate);
        dialog.show();
    }

    private void addProgressBar() {
        progressBar = new ProgressBar(
                this,
                null,
                android.R.attr.progressBarStyleHorizontal
        );
        progressBar.setMax(100);

        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(3)
        );
        progressParams.gravity = Gravity.TOP;
        root.addView(progressBar, progressParams);
    }

    private void applyPushLink(Intent intent) {
        if (intent == null || intent.getData() != null) return;
        String href = intent.getStringExtra("href");
        if (href != null && href.startsWith("/") && !href.startsWith("//") && !href.contains("\\")) {
            Uri uri = Uri.parse("https://fcarena.in"+href);
            if (isAllowedUrl(uri)) intent.setData(uri);
        }
    }

    private String resolveInitialUrl(Intent intent) {
        applyPushLink(intent);
        if (intent != null && intent.getData() != null && isAllowedUrl(intent.getData())) {
            return intent.getData().toString();
        }
        return START_URL;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        destroyCurrentWebView();
        showingOfflinePage = false;
        connectionRetries = 0;

        // Cover native initialization only. A slow/offline document or a normal
        // background kill must never become a persistent startup failure.
        preferences.edit()
                .putBoolean(STARTUP_GUARD_KEY, true)
                .putBoolean(SAFE_STARTUP_GUARD_KEY, softwareRendering)
                .commit();

        webView = new WebView(this);
        // Cache policy: LOAD_DEFAULT enables HTTP cache for performance.
        // Legacy clearCache(true) removed to avoid startup stalls and unnecessary network requests.
        // HTTP cache is managed by the browser (WebView) and persists across sessions for optimal
        // offline support and load performance. Auth/session cache invalidation handled
        // separately (e.g., on logout, token refresh) where actually required. No blanket cache
        // clearing on startup or navigation to maintain performance.
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView.setBackgroundColor(0xFF05080D);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setVerticalScrollBarEnabled(false);

        // After a renderer crash, use software composition for the recovery
        // WebView. This avoids repeating device-specific GPU/WebView failures.
        if (softwareRendering) {
            webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        }

        FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        );
        root.addView(webView, 0, webParams);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(
                settings.getUserAgentString() + " FC-Arena-Android/" + BuildConfig.VERSION_NAME
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        webView.addJavascriptInterface(
                new AuthPersistenceBridge(),
                "FC_ARENA_ANDROID_AUTH"
        );

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    WebResourceRequest request
            ) {
                if (!request.isForMainFrame()) {
                    return !isAllowedUrl(request.getUrl());
                }
                Uri uri = request.getUrl();
                if (handlePushAction(uri)) return true;
                if (isAllowedUrl(uri)) {
                    lastAllowedUrl = uri.toString();
                    return false;
                }
                openExternal(uri);
                return true;
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri uri = Uri.parse(url);
                if (handlePushAction(uri)) return true;
                if (isAllowedUrl(uri)) {
                    lastAllowedUrl = uri.toString();
                    return false;
                }
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (view != webView) return;
                Uri uri = Uri.parse(url);
                if (!showingOfflinePage && isAllowedUrl(uri)) {
                    lastAllowedUrl = url;
                    pageLoadPending = true;
                    root.removeCallbacks(pageLoadTimeout);
                    if (resumed) root.postDelayed(pageLoadTimeout, PAGE_LOAD_TIMEOUT_MS);
                }
                if (progressBar != null) {
                    progressBar.setVisibility(View.VISIBLE);
                }
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                if (view != webView) return;
                pageLoadPending = false;
                root.removeCallbacks(pageLoadTimeout);
                if (progressBar != null) progressBar.setVisibility(View.GONE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (view != webView) return;
                pageLoadPending = false;
                root.removeCallbacks(pageLoadTimeout);
                Uri uri = Uri.parse(url);
                if (!showingOfflinePage && isAllowedUrl(uri)) {
                    lastAllowedUrl = url;
                    connectionRetries = 0;
                    root.removeCallbacks(connectionRetry);
                    if (shouldForceFreshWeb()) {
                        preferences.edit()
                                .putBoolean(FORCE_FRESH_WEB_KEY, false)
                                .apply();
                        view.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
                    }
                }
                if (progressBar != null) {
                    progressBar.setVisibility(View.GONE);
                }
                CookieManager.getInstance().flush();
                clearStartupGuard();
                super.onPageFinished(view, url);
                if (!showingOfflinePage && isAllowedUrl(uri)) PushSupport.publish(MainActivity.this,view);
                if (!showingOfflinePage && playUpdates != null) playUpdates.publish(view);
            }

            @Override
            public void onReceivedError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceError error
            ) {
                if (view == webView && request != null && request.isForMainFrame()) {
                    clearStartupGuard();
                    showOfflinePage();
                }
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onReceivedError(
                    WebView view,
                    int errorCode,
                    String description,
                    String failingUrl
            ) {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                    clearStartupGuard();
                    showOfflinePage();
                }
            }

            @Override
            public void onReceivedHttpError(
                    WebView view, WebResourceRequest request,
                    WebResourceResponse response
            ) {
                if (view == webView && request != null && request.isForMainFrame() && response != null
                        && (response.getStatusCode() >= 500 || response.getStatusCode() == 408)) {
                    clearStartupGuard();
                    showOfflinePage();
                }
            }

            @Override
            public boolean onRenderProcessGone(
                    WebView view,
                    RenderProcessGoneDetail detail
            ) {
                if (view != webView) return true;
                if (isFinishing() || isDestroyed()) {
                    destroyCurrentWebView();
                    return true;
                }
                rendererCrashCount++;
                pageLoadPending = false;
                root.removeCallbacks(pageLoadTimeout);
                root.removeCallbacks(connectionRetry);
                // A picker result must never be delivered to a dead renderer.
                fileChooserCallback = null;

                if (view != null) {
                    try {
                        root.removeView(view);
                    } catch (Throwable ignored) {
                    }

                    if (view == webView) {
                        webView = null;
                    }

                    try {
                        view.destroy();
                    } catch (Throwable ignored) {
                    }
                }

                if (rendererCrashCount == 1) {
                    softwareRendering = true;
                    rendererRecoveryPending = true;
                    if (resumed) root.postDelayed(rendererRecovery, 250L);
                } else {
                    clearStartupGuard();
                    showNativeFallback(
                            "The Android WebView renderer stopped more than once. "
                            + "FC Arena switched to a safe native fallback so the app will not keep crashing."
                    );
                }

                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (progressBar == null) {
                    return;
                }
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(
                        newProgress >= 100 ? View.GONE : View.VISIBLE
                );
            }

            @Override
            public boolean onShowFileChooser(
                    WebView currentWebView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (fileChooserCallback != null) {
                    fileChooserCallback.onReceiveValue(null);
                }

                fileChooserCallback = filePathCallback;

                Intent chooserIntent;
                try {
                    chooserIntent = fileChooserParams.createIntent();
                    chooserIntent.addCategory(Intent.CATEGORY_OPENABLE);
                } catch (Exception error) {
                    // Complete the WebView's pending request. Clearing the
                    // reference without notifying it can leave file inputs
                    // stuck after an unavailable document provider.
                    ValueCallback<Uri[]> callback = fileChooserCallback;
                    fileChooserCallback = null;
                    if (callback != null) callback.onReceiveValue(null);
                    toast("Unable to open file picker.");
                    return false;
                }

                try {
                    startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException | SecurityException error) {
                    ValueCallback<Uri[]> callback = fileChooserCallback;
                    fileChooserCallback = null;
                    if (callback != null) callback.onReceiveValue(null);
                    toast("No file picker is available on this device.");
                    return false;
                }
            }
        });

        webView.setDownloadListener(
                (url, userAgent, contentDisposition, mimetype, contentLength) ->
                        openExternal(Uri.parse(url))
        );
        clearStartupGuard();
    }

    private void recoverRenderer() {
        if (!resumed || !rendererRecoveryPending || isFinishing() || isDestroyed()) return;
        rendererRecoveryPending = false;
        try {
            createWebView();
            String target = isAllowedUrl(Uri.parse(lastAllowedUrl)) ? lastAllowedUrl : START_URL;
            webView.loadUrl(shouldForceFreshWeb() ? withFreshWebToken(target) : target);
        } catch (Throwable error) {
            showNativeFallback(
                    "The in-app browser could not restart. Try again, or update "
                    + "Android System WebView and Chrome. You can also use your browser."
            );
        }
    }

    private void destroyCurrentWebView() {
        if (root != null) {
            root.removeCallbacks(connectionRetry);
            root.removeCallbacks(rendererRecovery);
            root.removeCallbacks(pageLoadTimeout);
        }
        pageLoadPending = false;
        if (webView == null) {
            return;
        }

        try {
            root.removeView(webView);
        } catch (Throwable ignored) {
        }

        try {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        } catch (Throwable ignored) {
        }

        webView = null;
    }

    private boolean handlePushAction(Uri uri) {
        if (!isAllowedUrl(uri) || webView.getUrl() == null || !isAllowedUrl(Uri.parse(webView.getUrl()))) return false;
        if ("/native/retry-connection".equals(uri.getPath())) {
            connectionRetries = 0;
            retryConnection();
            return true;
        }
        if ("/native/push-enable".equals(uri.getPath())) { PushSupport.enable(this,webView); return true; }
        if ("/native/push-disable".equals(uri.getPath())) { PushSupport.disable(this,webView); return true; }
        return false;
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode,permissions,grantResults);
        if (requestCode == PushSupport.REQUEST && webView != null) {
            if (grantResults.length > 0 && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) PushSupport.enable(this,webView);
            else PushSupport.emit(webView,false,"","Notifications were not allowed. You can enable them in Android Settings.");
        }
    }

    private boolean shouldForceFreshWeb() {
        return preferences != null
                && preferences.getBoolean(FORCE_FRESH_WEB_KEY, false);
    }

    private String withFreshWebToken(String url) {
        Uri uri = Uri.parse(url);

        if (!isAllowedUrl(uri)) {
            return START_URL;
        }

        return uri.buildUpon()
                .appendQueryParameter(
                        FRESH_WEB_QUERY_KEY,
                        String.valueOf(BuildConfig.VERSION_CODE)
                )
                .build()
                .toString();
    }

    private boolean isAllowedUrl(Uri uri) {
        if (uri == null) {
            return false;
        }

        String scheme = uri.getScheme();
        String host = uri.getHost();

        return "https".equalsIgnoreCase(scheme)
                && host != null
                && (
                    ALLOWED_HOST.equalsIgnoreCase(host)
                    || host.toLowerCase().endsWith("." + ALLOWED_HOST)
                );
    }

    private void openExternal(Uri uri) {
        if (uri == null || !("https".equalsIgnoreCase(uri.getScheme())
                || "mailto".equalsIgnoreCase(uri.getScheme())
                || "tel".equalsIgnoreCase(uri.getScheme()))) {
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
        } catch (ActivityNotFoundException | SecurityException error) {
            toast("No app can open this link.");
        }
    }

    private void openWebsiteInBrowser() {
        // Resolve browsers using a generic URL, then target their package.
        // An ordinary FC Arena ACTION_VIEW can resolve straight back to this
        // Activity through verified App Links, trapping users on the fallback.
        Intent probe = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.example.com/"));
        probe.addCategory(Intent.CATEGORY_BROWSABLE);
        PackageManager manager = getPackageManager();
        List<ResolveInfo> browsers = manager.queryIntentActivities(probe, PackageManager.MATCH_DEFAULT_ONLY);
        ResolveInfo preferred = manager.resolveActivity(probe, PackageManager.MATCH_DEFAULT_ONLY);
        List<Intent> choices = new ArrayList<>();
        for (ResolveInfo browser : browsers) {
            if (browser.activityInfo == null || getPackageName().equals(browser.activityInfo.packageName)) continue;
            Intent target = new Intent(Intent.ACTION_VIEW, Uri.parse(START_URL));
            target.addCategory(Intent.CATEGORY_BROWSABLE);
            target.setPackage(browser.activityInfo.packageName);
            if (preferred != null && preferred.activityInfo != null
                    && browser.activityInfo.packageName.equals(preferred.activityInfo.packageName)) {
                choices.add(0, target);
            } else {
                choices.add(target);
            }
        }
        if (choices.isEmpty()) {
            toast("Install or enable a web browser to open FC Arena.");
            return;
        }
        for (Intent choice : choices) {
            try {
                startActivity(choice);
                return;
            } catch (ActivityNotFoundException | SecurityException ignored) {
                // A browser may have been disabled since it was resolved.
            }
        }
        toast("No browser could open FC Arena.");
    }

    private void showOfflinePage() {
        pageLoadPending = false;
        root.removeCallbacks(pageLoadTimeout);
        if (webView == null) {
            showNativeFallback(
                    "FC Arena could not connect right now. "
                    + "You can open the secure website and try again."
            );
            return;
        }

        if (showingOfflinePage) {
            scheduleConnectionRetry();
            return;
        }
        showingOfflinePage = true;

        String html =
                "<!doctype html><html><head>"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                + "<style>"
                + "body{margin:0;background:#071525;color:#fff;font-family:sans-serif;"
                + "min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center}"
                + ".card{padding:32px;max-width:420px}"
                + "h2{color:#3ba7ff;letter-spacing:.08em}"
                + "p{color:#b7c4d3;line-height:1.6}"
                + "button{background:#2ea7ff;color:white;border:0;border-radius:14px;"
                + "padding:14px 22px;font-weight:700;font-size:16px}"
                + "</style></head><body><div class=\"card\">"
                + "<h2>FC ARENA</h2><p>FC Arena or your connection is temporarily unavailable. "
                + "We will retry a few times automatically. You can also try again below.</p>"
                + "<button onclick=\"location.href='https://fcarena.in/native/retry-connection'\">Try again</button>"
                + "</div></body></html>";

        webView.loadDataWithBaseURL(
                START_URL,
                html,
                "text/html",
                "UTF-8",
                null
        );
        scheduleConnectionRetry();
    }

    private boolean hasInternetConnection() {
        if (connectivityManager == null) return true;
        try {
            NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(
                    connectivityManager.getActiveNetwork());
            return capabilities != null
                    && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (RuntimeException ignored) {
            return true;
        }
    }

    private void scheduleConnectionRetry() {
        root.removeCallbacks(connectionRetry);
        if (!resumed || !showingOfflinePage || connectionRetries >= MAX_CONNECTION_RETRIES
                || !hasInternetConnection()) return;
        long delay = Math.min(30_000L, 2_000L << connectionRetries);
        connectionRetries++;
        root.postDelayed(connectionRetry, delay);
    }

    private void retryConnection() {
        if (!resumed || !showingOfflinePage || webView == null
                || isFinishing() || isDestroyed() || !hasInternetConnection()) return;
        root.removeCallbacks(connectionRetry);
        showingOfflinePage = false;
        String target = isAllowedUrl(Uri.parse(lastAllowedUrl)) ? lastAllowedUrl : START_URL;
        webView.loadUrl(shouldForceFreshWeb() ? withFreshWebToken(target) : target);
    }

    private void startNetworkRecovery() {
        if (networkCallback != null) return;
        connectivityManager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (connectivityManager == null) return;
        networkValidated = false;
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
                boolean validated = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                        && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
                runOnUiThread(() -> {
                    boolean recovered = validated && !networkValidated;
                    networkValidated = validated;
                    if (resumed && recovered && showingOfflinePage) {
                        connectionRetries = 0;
                        root.removeCallbacks(connectionRetry);
                        root.postDelayed(connectionRetry, 500L);
                    }
                });
            }

            @Override
            public void onLost(Network network) {
                runOnUiThread(() -> networkValidated = false);
            }
        };
        try { connectivityManager.registerDefaultNetworkCallback(networkCallback); }
        catch (RuntimeException ignored) { networkCallback = null; }
        if (showingOfflinePage) scheduleConnectionRetry();
    }

    private void stopNetworkRecovery() {
        if (root != null) root.removeCallbacks(connectionRetry);
        if (connectivityManager != null && networkCallback != null) {
            try { connectivityManager.unregisterNetworkCallback(networkCallback); }
            catch (RuntimeException ignored) { /* The Activity may already be stopped. */ }
        }
        networkCallback = null;
    }

    private void showNativeFallback(String messageText) {
        rendererRecoveryPending = false;
        destroyCurrentWebView();
        clearStartupGuard();

        root.removeAllViews();
        progressBar = null;

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(dp(28), dp(28), dp(28), dp(28));
        panel.setBackgroundColor(0xFF071525);

        TextView title = new TextView(this);
        title.setText("FC ARENA");
        title.setTextColor(0xFF3BA7FF);
        title.setTextSize(28);
        title.setGravity(Gravity.CENTER);

        TextView message = new TextView(this);
        message.setText(messageText);
        message.setTextColor(0xFFB7C4D3);
        message.setTextSize(16);
        message.setGravity(Gravity.CENTER);
        message.setPadding(0, dp(18), 0, dp(24));

        Button openButton = new Button(this);
        openButton.setText("Open FC Arena Website");
        openButton.setOnClickListener(
                view -> openWebsiteInBrowser()
        );

        Button retryButton = new Button(this);
        retryButton.setText("Try FC Arena Again");
        retryButton.setOnClickListener(view -> {
            rendererCrashCount = 0;
            softwareRendering = true;
            root.removeAllViews();
            addProgressBar();

            try {
                createWebView();
                String target = isAllowedUrl(Uri.parse(lastAllowedUrl)) ? lastAllowedUrl : START_URL;
                webView.loadUrl(shouldForceFreshWeb() ? withFreshWebToken(target) : target);
            } catch (Throwable error) {
                showNativeFallback(
                        "The in-app browser still cannot start on this device. "
                        + "Please use the secure website button."
                );
            }
        });

        Button updateButton = new Button(this);
        updateButton.setText("Update Android System WebView");
        updateButton.setOnClickListener(view -> openExternal(Uri.parse(
                "https://play.google.com/store/apps/details?id=com.google.android.webview")));

        panel.addView(title);
        panel.addView(message);
        panel.addView(retryButton);
        panel.addView(openButton);
        panel.addView(updateButton);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(panel);
        root.addView(
                scroll,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );
    }

    private void clearStartupGuard() {
        if (preferences != null) {
            preferences.edit()
                    .remove(STARTUP_GUARD_KEY)
                    .remove(SAFE_STARTUP_GUARD_KEY)
                    .commit();
        }
    }

    private int dp(int value) {
        return Math.round(
                value * getResources().getDisplayMetrics().density
        );
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        applyPushLink(intent);
        setIntent(intent);

        if (
            webView != null
            && intent != null
            && intent.getData() != null
            && isAllowedUrl(intent.getData())
        ) {
            lastAllowedUrl = intent.getData().toString();
            showingOfflinePage = false;
            connectionRetries = 0;
            root.removeCallbacks(connectionRetry);
            webView.loadUrl(lastAllowedUrl);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        root.removeCallbacks(updateRefresh);
        updateRefresh.run();
        startNetworkRecovery();
        if (rendererRecoveryPending) root.postDelayed(rendererRecovery, 250L);
        if (pageLoadPending) root.postDelayed(pageLoadTimeout, PAGE_LOAD_TIMEOUT_MS);
        if (webView != null) {
            webView.onResume();
        }
        // FCM may rotate its token while the app is backgrounded or updated.
        // Publish the current token using the existing authenticated web bridge.
        if (!showingOfflinePage && webView != null && webView.getUrl() != null
                && isAllowedUrl(Uri.parse(webView.getUrl()))) {
            try {
                PushSupport.publish(this, webView);
            } catch (RuntimeException ignored) {
                // Push refresh is optional and must not interrupt app resume.
            }
        }
    }

    @Override
    protected void onPause() {
        resumed = false;
        root.removeCallbacks(updateRefresh);
        root.removeCallbacks(rendererRecovery);
        root.removeCallbacks(pageLoadTimeout);
        stopNetworkRecovery();
        if (webView != null) {
            // Pause this view's animations/location work while another app or
            // the photo picker is foregrounded. Do not pause global JS timers:
            // uploads/auth callbacks must still be allowed to complete.
            webView.onPause();
            // No browser APIs are needed while the native fallback is showing:
            // the WebView provider itself may be unavailable on this device.
            // Persist the refresh cookie before Android can kill this process.
            CookieManager.getInstance().flush();
        }
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null && !showingOfflinePage) {
            webView.saveState(outState);
        }
        super.onSaveInstanceState(outState);
    }

    @Override
    @SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (
            requestCode == FILE_CHOOSER_REQUEST
            && fileChooserCallback != null
        ) {
            Uri[] result = WebChromeClient.FileChooserParams.parseResult(
                    resultCode,
                    data
            );
            fileChooserCallback.onReceiveValue(result);
            fileChooserCallback = null;
            return;
        }

        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onDestroy() {
        root.removeCallbacks(updateRefresh);
        stopNetworkRecovery();
        clearStartupGuard();

        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }

        destroyCurrentWebView();

        super.onDestroy();
    }
}
