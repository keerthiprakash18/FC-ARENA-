# FC ARENA release hardening.
#
# R8/minification is enabled for release builds. Android Gradle Plugin and
# Firebase libraries ship consumer keep rules; these explicit rules protect
# FC ARENA entry points that Android/Firebase instantiate by class name.

-keep public class in.fcarena.app.ArenaApplication {
    public <init>();
}

-keep public class in.fcarena.app.MainActivity {
    public <init>();
}

-keep public class in.fcarena.app.ArenaMessagingService {
    public <init>();
}

# Preserve source/line information so Crashlytics can deobfuscate release
# stack traces when the generated mapping file is uploaded.
-keepattributes SourceFile,LineNumberTable
