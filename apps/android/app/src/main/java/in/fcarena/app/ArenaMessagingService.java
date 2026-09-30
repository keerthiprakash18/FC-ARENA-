package in.fcarena.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public final class ArenaMessagingService extends FirebaseMessagingService {
    @Override public void onMessageReceived(RemoteMessage message) {
        if (!PushSupport.enabled(this) || !PushSupport.initialize(this)) return;
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        String href = message.getData().get("href");
        if (href == null || !href.startsWith("/") || href.startsWith("//") || href.contains("\\")) href = "/notifications";
        Uri target = Uri.parse("https://fcarena.in"+href);
        if (!"fcarena.in".equals(target.getHost())) target = Uri.parse("https://fcarena.in/notifications");
        Intent intent = new Intent(this,MainActivity.class).setAction(Intent.ACTION_VIEW).setData(target).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        String id = message.getData().get("notificationId");
        int requestId = id == null ? 1 : id.hashCode();
        PendingIntent pending = PendingIntent.getActivity(this,requestId,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this,"competition") : new Notification.Builder(this);
        String title = message.getNotification() == null ? "FC ARENA" : message.getNotification().getTitle();
        builder.setSmallIcon(R.drawable.ic_launcher).setContentTitle(title).setContentText("Open FC ARENA to view your latest competition update.").setContentIntent(pending).setAutoCancel(true);
        getSystemService(NotificationManager.class).notify(id,requestId,builder.build());
    }
}
