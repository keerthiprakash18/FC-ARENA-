package in.fcarena.app;

import android.app.Application;

import com.google.firebase.FirebaseApp;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

public final class ArenaApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();

        // Crash reporting must never prevent FC Arena from starting.
        // Firebase Messaging auto-init remains disabled in AndroidManifest.xml,
        // so push notifications still require the user's explicit opt-in.
        try {
            FirebaseApp firebaseApp = FirebaseApp.initializeApp(this);

            if (firebaseApp != null) {
                FirebaseCrashlytics crashlytics = FirebaseCrashlytics.getInstance();
                crashlytics.setCrashlyticsCollectionEnabled(true);
                crashlytics.setCustomKey("fc_arena_version_name", BuildConfig.VERSION_NAME);
                crashlytics.setCustomKey("fc_arena_version_code", BuildConfig.VERSION_CODE);
                crashlytics.setCustomKey("fc_arena_build_type", BuildConfig.BUILD_TYPE);
                crashlytics.log("FC Arena Android process started");
            }
        } catch (RuntimeException ignored) {
            // Monitoring is fail-open: a telemetry initialization problem must
            // never create an app-start crash.
        }

        // Initialize push only after explicit user consent.
        if (PushSupport.enabled(this)) {
            PushSupport.initialize(this);
        }
    }
}
