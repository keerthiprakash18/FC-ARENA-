package in.fcarena.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
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

    private FrameLayout root;
    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileChooserCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        root.setBackgroundColor(0xFF05080D);
        setContentView(root);

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

        String initialUrl = resolveInitialUrl(getIntent());

        try {
            createWebView();
            if (savedInstanceState == null) {
                webView.loadUrl(initialUrl);
            } else {
                if (webView.restoreState(savedInstanceState) == null) {
                    webView.loadUrl(initialUrl);
                }
            }
        } catch (Throwable error) {
            showNativeFallback();
        }
    }

    private String resolveInitialUrl(Intent intent) {
        if (intent != null && intent.getData() != null && isAllowedUrl(intent.getData())) {
            return intent.getData().toString();
        }
        return START_URL;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        if (webView != null) {
            root.removeView(webView);
            webView.stopLoading();
            webView.destroy();
        }

        webView = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(false);
        webView.setBackgroundColor(0xFF05080D);

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
        settings.setUserAgentString(
                settings.getUserAgentString() + " FC-Arena-Android/1.0.4"
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);

        // FC Arena auth refresh runs through the same fcarena.in origin.
        // Keep third-party cookies disabled for privacy/security.
        cookieManager.setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    WebResourceRequest request
            ) {
                Uri uri = request.getUrl();
                if (isAllowedUrl(uri)) {
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
                    return false;
                }
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (progressBar != null) {
                    progressBar.setVisibility(View.VISIBLE);
                }
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (progressBar != null) {
                    progressBar.setVisibility(View.GONE);
                }
                CookieManager.getInstance().flush();
                super.onPageFinished(view, url);
            }

            @Override
            public void onReceivedError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceError error
            ) {
                if (request != null && request.isForMainFrame()) {
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
                    showOfflinePage();
                }
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
        if (uri == null) {
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
            showNativeFallback();
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

    private void showNativeFallback() {
        root.removeAllViews();

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
        message.setText(
                "FC Arena could not start its in-app browser on this device. "
                + "You can still open the secure FC Arena website."
        );
        message.setTextColor(0xFFB7C4D3);
        message.setTextSize(16);
        message.setGravity(Gravity.CENTER);
        message.setPadding(0, dp(18), 0, dp(24));

        Button openButton = new Button(this);
        openButton.setText("Open FC Arena");
        openButton.setOnClickListener(
                view -> openExternal(Uri.parse(START_URL))
        );

        panel.addView(title);
        panel.addView(message);
        panel.addView(openButton);

        root.addView(
                panel,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );
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
            webView.loadUrl(intent.getData().toString());
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
        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }

        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }
}
