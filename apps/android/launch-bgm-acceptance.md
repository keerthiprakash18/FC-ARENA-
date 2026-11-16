# FC ARENA original launch soundtrack — phone acceptance checklist

Status: development preview only. No signed Play Store release, server deployment or database migration.

## What changed

- 5.5-second native opening animation and branded transition
- 5.48-second original offline PCM WAV bundled in `res/raw`
- Audio routed to Android **Media volume**, not system/notification volume
- Asynchronous MediaPlayer startup; no on-device soundtrack generation
- Sound ON/OFF choice on bottom of intro, persisted across launches
- MediaPlayer released when intro finishes or app backgrounds

## Windows debug build

From a separate checkout on branch `feat/arena-cinematic-launch-bgm-20261116`:

```powershell
git fetch origin
git pull --ff-only
cd apps/android
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$gradleExe = "$env:LOCALAPPDATA\FC-Arena\Gradle\gradle-8.13\bin\gradle.bat"
& $gradleExe :app:clean :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb install -r ".\app\build\outputs\apk\debug\app-debug.apk"
```

Do not create `local.properties` by typing an unescaped Windows drive-letter path.
Using `ANDROID_HOME` is sufficient when a suitable Android SDK exists.

## Real-device BGM verification

1. Connect headphones or use the built-in phone speaker; pause any other audio.
2. Make sure **Media volume** is above zero (ringer volume is a separate control).
3. Ensure the animation reads **SOUND ON**; tap its bottom toggle if needed.
4. Cold-launch the debug app using ADB and check the original BGM starts with the visual reveal.
5. Verify sound ends when the animation ends; no sound is played on app resume or normal page navigation.
6. Verify SOUND OFF persists after a fresh cold launch.
7. Verify the app still works when media volume is zero, offline, or the WebView cannot connect.

```powershell
& $adb logcat -c
& $adb shell am force-stop in.fcarena.app.debug
& $adb shell am start -n in.fcarena.app.debug/in.fcarena.app.MainActivity
Start-Sleep -Seconds 7
& $adb logcat -d -s FCArenaIntroAudio:I
```

Expected when enabled and volume permits: `Playing bundled FC ARENA BGM on STREAM_MUSIC.`
Otherwise the log names the reason, such as zero Media volume or another active stream.

**Recording caveat:** A screen recorder can omit internal audio entirely. To evaluate sound quality, choose a recording mode that captures device audio or listen directly on the phone.

**Release gate:** no merge or Play Console upload until Android CI, physical-device acceptance, signing key verification and versionCode gate pass.
