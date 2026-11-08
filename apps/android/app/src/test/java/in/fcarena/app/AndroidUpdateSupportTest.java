package in.fcarena.app;

import static org.junit.Assert.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowLooper;
import org.robolectric.shadows.ShadowSystemClock;
import com.google.android.play.core.appupdate.testing.FakeAppUpdateManager;
import java.time.Duration;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class AndroidUpdateSupportTest {
    @Test public void unavailableUpdateNeverAdvertisesAnUnreleasedBuild() throws Exception {
        AndroidUpdateSupport support = new AndroidUpdateSupport(new FakeAppUpdateManager(RuntimeEnvironment.getApplication()));
        support.check(() -> {}); ShadowLooper.idleMainLooper();
        assertTrue(support.snapshot().getBoolean("checked"));
        assertFalse(support.snapshot().getBoolean("available"));
    }
    @Test public void actualNewerPlayVersionIsExposedToTheBanner() throws Exception {
        FakeAppUpdateManager manager = new FakeAppUpdateManager(RuntimeEnvironment.getApplication());
        manager.setUpdateAvailable(BuildConfig.VERSION_CODE + 1);
        AndroidUpdateSupport support = new AndroidUpdateSupport(manager);
        support.check(() -> {}); ShadowLooper.idleMainLooper();
        assertTrue(support.snapshot().getBoolean("available"));
        assertEquals(BuildConfig.VERSION_CODE + 1, support.snapshot().getInt("availableVersionCode"));
    }
    @Test public void foregroundChecksAreThrottledAndDetectALaterRelease() throws Exception {
        FakeAppUpdateManager manager = new FakeAppUpdateManager(RuntimeEnvironment.getApplication());
        AndroidUpdateSupport support = new AndroidUpdateSupport(manager);
        support.check(() -> {}); ShadowLooper.idleMainLooper();
        manager.setUpdateAvailable(BuildConfig.VERSION_CODE + 1);
        support.check(() -> {}); ShadowLooper.idleMainLooper();
        assertFalse(support.snapshot().getBoolean("available"));
        ShadowSystemClock.advanceBy(Duration.ofMinutes(16));
        support.check(() -> {}); ShadowLooper.idleMainLooper();
        assertTrue(support.snapshot().getBoolean("available"));
    }
    @Test public void equalAndOlderVersionCodesNeverPromptAnUpdate() throws Exception {
        FakeAppUpdateManager manager = new FakeAppUpdateManager(RuntimeEnvironment.getApplication());
        manager.setUpdateAvailable(BuildConfig.VERSION_CODE);
        AndroidUpdateSupport support = new AndroidUpdateSupport(manager);
        support.check(() -> {}); ShadowLooper.idleMainLooper();
        assertFalse(support.snapshot().getBoolean("available"));
    }
}
