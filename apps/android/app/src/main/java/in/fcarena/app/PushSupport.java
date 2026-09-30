package in.fcarena.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.WebView;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;

final class PushSupport {
    static final int REQUEST = 2101;
    static final String PREFS = "fc_push";
    private PushSupport() {}
    static boolean configured() { return !BuildConfig.FIREBASE_APP_ID.isEmpty(); }
    static boolean initialize(Context context) {
        if (!configured()) return false;
        try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseApp.initializeApp(context, new FirebaseOptions.Builder()
                    .setApplicationId(BuildConfig.FIREBASE_APP_ID).setApiKey(BuildConfig.FIREBASE_API_KEY)
                    .setProjectId(BuildConfig.FIREBASE_PROJECT_ID).setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID).build());
            }
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager manager = context.getSystemService(NotificationManager.class);
                manager.createNotificationChannel(new NotificationChannel("competition", "Competition updates", NotificationManager.IMPORTANCE_DEFAULT));
            }
            return true;
        } catch (RuntimeException ignored) { return false; }
    }
    static boolean enabled(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("enabled",false)
            && (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
            && (Build.VERSION.SDK_INT < 24 || context.getSystemService(NotificationManager.class).areNotificationsEnabled());
    }
    static void enable(Activity activity, WebView view) {
        if (!initialize(activity)) { emit(view, false, "", "Phone notifications are not configured in this app build."); return; }
        if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},REQUEST); return;
        }
        activity.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putBoolean("enabled",true).apply();
        publish(activity,view);
    }
    static void disable(Context context, WebView view) {
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putBoolean("enabled",false).apply();
        if (initialize(context)) { FirebaseMessaging.getInstance().setAutoInitEnabled(false); FirebaseMessaging.getInstance().deleteToken(); }
        emit(view,false,"","");
    }
    static void publish(Context context, WebView view) {
        if (!enabled(context) || !initialize(context)) { emit(view,false,"",""); return; }
        FirebaseMessaging.getInstance().setAutoInitEnabled(true);
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> emit(view,true,token,""))
            .addOnFailureListener(error -> emit(view,false,"","Unable to register notifications. Please retry."));
    }
    static void emit(WebView view, boolean enabled, String token, String error) {
        view.post(() -> {
            if (view.getUrl() == null) return;
            android.net.Uri uri = android.net.Uri.parse(view.getUrl());
            if (!"https".equals(uri.getScheme()) || !"fcarena.in".equals(uri.getHost()) || (uri.getPort()!=-1 && uri.getPort()!=443)) return;
            try {
                JSONObject state = new JSONObject().put("supported",true).put("configured",configured()).put("enabled",enabled).put("token",token).put("error",error);
                view.evaluateJavascript("window.__fcPush="+state+";window.dispatchEvent(new Event('fc-arena:native-push'));",null);
            } catch (org.json.JSONException ignored) { /* Boolean/string values only. */ }
        });
    }
}
