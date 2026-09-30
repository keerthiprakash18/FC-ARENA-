package in.fcarena.app;

import android.app.Application;

public final class ArenaApplication extends Application {
    @Override public void onCreate() {
        super.onCreate();
        // Initialize on background process startup only after explicit user consent.
        if (PushSupport.enabled(this)) PushSupport.initialize(this);
    }
}
