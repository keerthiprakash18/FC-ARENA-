# FC Arena startup design proposal

## Decision for review

Own the cold-launch animation in the existing Android Activity. Start from the AndroidX SplashScreen launch theme using `#05080D` and the same official FC Arena crest resource as the launcher. Continue into an Android view using the matching background and centered crest position. A pitch centerline and center circle draw under the crest, with a short light sweep and one gold highlight. Preserve the existing visual identity and consider the requested `WHERE CHAMPIONS RISE` line only if the native reveal has time to display it. The logged-in dashboard and existing sign-in/recovery routes remain the destinations. A web-wide opening overlay would replay on full-document navigation and complicate auth and error recovery. Reuse web skeletons for the continuation.

## Startup lifecycle

- Install the AndroidX splash before `super.onCreate()` and use the existing Activity and application theme after launch. The OS splash covers process startup and initial Activity creation. A native visual continuation can animate during WebView loading while the app resolves its trusted start URL. [Android splash migration](https://developer.android.com/develop/ui/views/launch/splash-screen/migrate)
- Place the continuation above the WebView at first creation and release it when the current main-frame document is safe to display or when native fallback UI takes over. Use the WebView visual state callback on supported devices to validate the handoff and check callback identity after renderer replacement or navigation. Keep a strict independent upper bound on the continuation. After the bound, the existing progress, timeout, and retry states remain visible. Keep motion disabled under the Android animation setting and use a static crest in software recovery.
- Keep the continuation outside WebView content and mark it decorative for accessibility. The existing WebView destination, safe areas, file chooser, network controls, and trusted external-link and push handling retain their own lifecycle. No JavaScript bridge, cookie access, network request, new Activity, or remote asset is required for the reveal.
- Resume and normal internal navigation reuse the current Activity. Restoring saved Activity state bypasses decorative motion. Renderer recovery and offline retry dismiss the existing continuation and use the current recovery views. A terminal native or main-frame error takes precedence over the animation.

## Motion and visual continuity

Use the existing crest and launch navy with the warm gold already present in the Android resources and web system. Keep any cool rim light subdued. The proposal is a 150 ms opening sweep, a 350 ms pitch and crest reveal, then a short settled state while the first document arrives. Begin a short opacity handoff as soon as content is ready, including during the reveal. Set a provisional 1.2 s maximum for decorative animation and tune it after baseline measurements. Reduced-motion mode removes the sweeps and reveal transforms. Accessibility focus and input should follow the visible destination or recovery view.

## Verification and release gates

1. Capture `am start -W`, first useful visual frame from a real screen recording, and route readiness on the same emulator or physical device. Collect repeated cold and warm launches of baseline and candidate. Record the device, WebView version, network profile, signed-in/out state, method, and sample count.
2. Exercise offline, a slow server, a failing main frame, an unavailable API, reduced motion, background/resume, state restoration, Back, app links, and notification links. Use synthetic players and trusted isolated content. Assert that decorative motion appears once at most and never masks a usable page or failure UI beyond the documented bound.
3. Verify mobile browser paths in Playwright, including login, keyboard navigation, unavailable API, and no Android animation on regular navigation. Verify authenticated play and admin flows in the isolated environment. Reuse API invariants for registrations, scoring, standings, permissions, and opponent contact.
4. Record Android build, lint, unit tests, emulator evidence, web build, API and browser tests, secret scan, and CI at the exact candidate revision. Production release requires a recent encrypted backup, isolated restore, schema compatibility, rollback rehearsal, successful health checks, and separate deployment authorization.

Status: approved for implementation on 15 November 2026. Independent Goldfish review remains a release gate.
