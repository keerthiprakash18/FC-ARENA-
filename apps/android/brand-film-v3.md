# FC ARENA — original cinematic brand film (V3)

The approved 7.000-second, 1080×1920 H.264 video includes its own AAC stereo soundtrack. Android displays it only on a normal **cold launch**, immediately after the standard Android SplashScreen. The WebView is loaded in parallel and the app reveals the current login/dashboard page after video completion and WebView visual readiness.

## Source and integrity

- Relative asset: `apps/android/app/src/main/assets/fc_arena_brand_film_v3.mp4`
- Release asset: cleaned edit of the user-uploaded `FC_Arena_brand_film_reveal_c89fe771_1080p.mp4` (only the bottom-right visible sparkle was inpainted; original AAC soundtrack is passed through unchanged).
- **SHA-256:** `588023aa21a2880e18c50b856b72ffca0fafaf04be44e2328ce510e02e4a6da2`
- Final media size: 4,325,250 bytes, duration 7.000 sec (1080×1920 / 24fps H.264 + 6.99-second original AAC audio).
- Code-only GitHub updates do **not** contain the binary until an authorized repository push adds the exact user-approved asset.
- The MP4 must stay uncompressed inside the Android APK/AAB for `AssetManager.openFd` and `MediaPlayer`.
- `BrandFilmAssetTest` verifies the final edited release asset checksum. Release builds are blocked until the MP4 is present.

## Playback and accessibility

- The film is part of the APK: no remote streaming, no buffering over the network.
- The film's **own audio** is played with Android media audio attributes. Do not play the obsolete synthesized BGM at the same time.
- Sound on/off button is visible near the bottom and persisted in `fc_arena_android` preferences. Android media volume controls loudness.
- Low-RAM devices, disabled system animations, failed MediaPlayer/decoder, or missing assets use the existing lightweight native Canvas reveal.
- Warm resume, SPA navigation and restored Activity state never replay the film.
- `onPause`, decode failure, WebView failure and destruction release the film/player.
- Playback is capped by a foreground startup timeout; it must never trap the user behind a video.
- App-level progress/offline/retry states remain available.

## Debug install on Windows

Use the feature branch `feat/arena-premium-brand-film-v3-20261116` in a disposable checkout. Extract the provided media ZIP into that checkout root, preserving the path above. Verify SHA-256 before building.

```powershell
git status --short
git fetch origin
git switch --track origin/feat/arena-premium-brand-film-v3-20261116
Expand-Archive -Path "$env:USERPROFILE\Downloads\FC_ARENA_V3_Final_PlayStore_Media.zip" -DestinationPath "." -Force
(Get-FileHash .\apps\android\app\src\main\assets\fc_arena_brand_film_v3.mp4 -Algorithm SHA256).Hash
cd apps/android
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$gradleExe = "$env:LOCALAPPDATA\FC-Arena\Gradle\gradle-8.13\bin\gradle.bat"
& $gradleExe :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb install -r .\app\build\outputs\apk\debug\app-debug.apk
& $adb logcat -c
& $adb shell am force-stop in.fcarena.app.debug
& $adb shell am start -n in.fcarena.app.debug/in.fcarena.app.MainActivity
& $adb logcat -d -s FCArenaBrandFilm:I "*:S"
```

Use **MEDIA** volume and an audible phone setting. Check the exact 7-second playback, video first-frame latency, original audio, mute, slow/offline fallback, login/dashboard handoff, warm resume, low-RAM and reduced-motion behaviors.

Only after the user's final phone review of the cleaned file: commit and push the binary to this feature branch, make CI green, review the pull request, bump the Android version code as needed, and build a signed AAB with the original upload key. Ship through Play Console internal testing before production. **Do not deploy to VCCLHosting** for this native-only change.

## Release media provenance

The uploaded film was made with Google's Gemini/Flow. The visible sparkle overlay was removed from a narrow fixed region for the FC ARENA app intro; the original H.264 image was re-encoded, and the original AAC audio stream was passed through unchanged. The edit does not purport to remove invisible provenance watermarks or change origin attribution. Confirm applicable generator terms and any platform requirements before publication.
