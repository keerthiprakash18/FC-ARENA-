package in.fcarena.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String START_URL = "https://fcarena.in/dashboard";
    private static final String ALLOWED_HOST = "fcarena.in";
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final String PREFS_NAME = "fc_arena_android";
    private static final String STARTUP_GUARD_KEY = "startup_guard";

    private FrameLayout root;
    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileChooserCallback;
    private SharedPreferences preferences;

    private int rendererCrashCount = 0;
    private boolean softwareRendering = false;
    private String lastAllowedUrl = START_URL;

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

        // If the previous process died during WebView startup, do not enter
        // the same crash loop again. Show a native safe screen instead.
        if (preferences.getBoolean(STARTUP_GUARD_KEY, false)) {
            preferences.edit().putBoolean(STARTUP_GUARD_KEY, false).commit();
            showNativeFallback(
                    "FC Arena detected that the in-app browser failed during the previous startup. "
                    + "Open the secure website below, or retry the in-app browser in safe mode."
            );
            return;
        }

        preferences.edit().putBoolean(STARTUP_GUARD_KEY, true).commit();

        addProgressBar();

        String initialUrl = resolveInitialUrl(getIntent());

        try {
            createWebView();
            if (savedInstanceState == null) {
                webView.loadUrl(initialUrl);
            } else if (webView.restoreState(savedInstanceState) == null) {
                webView.loadUrl(initialUrl);
            }

            // Startup survived. Remove the crash-loop marker after a short
            // grace period so a native/WebView startup crash leaves it set.
            root.postDelayed(this::clearStartupGuard, 5000L);
        } catch (Throwable error) {
            clearStartupGuard();
            showNativeFallback(
                    "FC Arena could not start the in-app browser on this device. "
                    + "You can still use the secure FC Arena website."
            );
        }
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

    private String resolveInitialUrl(Intent intent) {
        if (intent != null && intent.getData() != null && isAllowedUrl(intent.getData())) {
            return intent.getData().toString();
        }
        return START_URL;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        destroyCurrentWebView();

        webView = new WebView(this);
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
                if (isAllowedUrl(uri)) {
                    lastAllowedUrl = uri.toString();
                    return false;
                }
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                Uri uri = Uri.parse(url);
                if (isAllowedUrl(uri)) {
                    lastAllowedUrl = url;
                }
                if (progressBar != null) {
                    progressBar.setVisibility(View.VISIBLE);
                }
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                Uri uri = Uri.parse(url);
                if (isAllowedUrl(uri)) {
                    lastAllowedUrl = url;
                }
                if (progressBar != null) {
                    progressBar.setVisibility(View.GONE);
                }
                CookieManager.getInstance().flush();
                clearStartupGuard();
                super.onPageFinished(view, url);
            }

            @Override
            public void onReceivedError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceError error
            ) {
                if (request != null && request.isForMainFrame()) {
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
            public boolean onRenderProcessGone(
                    WebView view,
                    RenderProcessGoneDetail detail
            ) {
                if (isFinishing() || isDestroyed()) {
                    destroyCurrentWebView();
                    return true;
                }
                rendererCrashCount++;

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
                    toast("Recovering FC Arena in safe mode…");

                    root.postDelayed(() -> {
                        if (isFinishing() || isDestroyed()) {
                            return;
                        }
                        try {
                            createWebView();
                            webView.loadUrl(
                                    isAllowedUrl(Uri.parse(lastAllowedUrl))
                                            ? lastAllowedUrl
                                            : START_URL
                            );
                        } catch (Throwable error) {
                            clearStartupGuard();
                            showNativeFallback(
                                    "The Android WebView renderer is unstable on this device. "
                                    + "Use the secure website button below."
                            );
                        }
                    }, 250L);
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
                    fileChooserCallback = null;
                    toast("Unable to open file picker.");
                    return false;
                }

                try {
                    startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException error) {
                    fileChooserCallback = null;
                    toast("No file picker is available on this device.");
                    return false;
                }
            }
        });

        webView.setDownloadListener(
                (url, userAgent, contentDisposition, mimetype, contentLength) ->
                        openExternal(Uri.parse(url))
        );
    }

    private void destroyCurrentWebView() {
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
        } catch (ActivityNotFoundException error) {
            toast("No app can open this link.");
        }
    }

    private void showOfflinePage() {
        if (webView == null) {
            showNativeFallback(
                    "FC Arena could not connect right now. "
                    + "You can open the secure website and try again."
            );
            return;
        }

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
                + "<h2>FC ARENA</h2><p>We could not connect right now. Check your internet connection and try again.</p>"
                + "<button onclick=\"location.href='" + START_URL + "'\">Try again</button>"
                + "</div></body></html>";

        webView.loadDataWithBaseURL(
                START_URL,
                html,
                "text/html",
                "UTF-8",
                null
        );
    }

    private void showNativeFallback(String messageText) {
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
                view -> openExternal(Uri.parse(START_URL))
        );

        Button retryButton = new Button(this);
        retryButton.setText("Retry In-App Safe Mode");
        retryButton.setOnClickListener(view -> {
            rendererCrashCount = 0;
            softwareRendering = true;
            root.removeAllViews();
            addProgressBar();

            try {
                createWebView();
                webView.loadUrl(START_URL);
                root.postDelayed(this::clearStartupGuard, 5000L);
            } catch (Throwable error) {
                showNativeFallback(
                        "The in-app browser still cannot start on this device. "
                        + "Please use the secure website button."
                );
            }
        });

        panel.addView(title);
        panel.addView(message);
        panel.addView(openButton);
        panel.addView(retryButton);

        root.addView(
                panel,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );
    }

    private void clearStartupGuard() {
        if (preferences != null) {
            preferences.edit().putBoolean(STARTUP_GUARD_KEY, false).apply();
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
        setIntent(intent);

        if (
            webView != null
            && intent != null
            && intent.getData() != null
            && isAllowedUrl(intent.getData())
        ) {
            lastAllowedUrl = intent.getData().toString();
            webView.loadUrl(lastAllowedUrl);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) {
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
        clearStartupGuard();

        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }

        destroyCurrentWebView();

        super.onDestroy();
    }
}
