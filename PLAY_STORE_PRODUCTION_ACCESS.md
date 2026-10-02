# FC ARENA — Google Play Production Access Gate

Last reviewed: 2026-10-02

Use this checklist before applying for Production access or submitting a production release. Do not claim completion unless the evidence exists in Play Console or on real tester devices.

## 1. Closed-test eligibility

For a personal developer account subject to Google Play's new-app testing rule:

- at least **12 testers**
- testers remain **opted in continuously for at least 14 days**
- keep more than 12 testers enrolled where possible so one person leaving does not break eligibility
- use real testers who exercise the product rather than only installing it

Official reference:
https://support.google.com/googleplay/android-developer/answer/14151465

### FC ARENA tester flow

Each tester should exercise a representative set of real flows during the closed test:

1. install/update from the Play closed-test link
2. cold launch and resume the Android app
3. register/sign in
4. edit player profile
5. join a League using a valid code
6. open Tournament pages and fixtures
7. open Match Room
8. mark Ready
9. submit or review a result where the tester has permission
10. use standings / rankings / Awards / Discover
11. receive or intentionally enable/disable phone notifications
12. use Android back navigation and file/photo picker
13. report any crash, login loop, stale data, visual issue or unclear flow

Do not fabricate engagement. Record only actions testers actually performed.

## 2. Feedback evidence

Maintain a feedback log with:

| Date | Tester | Build | Flow tested | Feedback / bug | Severity | Change made | Retested |
| --- | --- | --- | --- | --- | --- | --- | --- |

Production-access answers should summarize real recurring feedback and the actual changes made in response.

Useful FC ARENA examples should only be used if they truly came from the test:
- login/session issue → authentication/session fix
- fixture filter confusion → filter scoping fix
- Match Room result flow unclear → Ready/result/confirmation UX improvement
- notification delivery issue → push handling fix
- Android update issue → version-control/update handling fix

## 3. App-content / policy gate

Before applying:

- Privacy Policy URL is public and reachable without login
- account-deletion URL is public and reachable without login
- in-app Settings contains Delete Account & Data
- Data Safety form matches the exact release behavior
- App access/reviewer instructions include a working account if gated features require login
- Ads declaration says no ads only while no advertising SDK/ads are present
- content rating answers match actual football esports/community features
- target audience answers match the intended audience; do not mark children unless FC ARENA is deliberately designed and compliant for children
- no gambling/betting or real-money wagering claims are present
- no payment/subscription declarations are added until those features actually exist and have been separately reviewed
- new registrations explicitly accept the current Terms of Service & Community Rules
- existing signed-in users are blocked by the in-app Terms gate until they accept the current Terms version
- UGC reporting and blocking remain available from Safety & Reporting
- AI-generated responses keep an in-app “Report AI response” control while FC ARENA AI is available
- store listing screenshots/text match the tested build

## 4. Android release gate

- package remains `in.fcarena.app`
- target SDK is at least the current Play requirement (36 for the planned 2026 submission)
- `VERSION_CODE` is greater than every prior Play upload
- release is signed with the existing FC ARENA upload key
- signer SHA-256 is verified before upload
- release AAB is built from a recorded source commit
- release AAB SHA-256 is recorded
- Android lint is green
- launch/resume smoke passes on supported Android versions
- no fatal crash / ANR appears in test evidence

Official target-API reference:
https://support.google.com/googleplay/android-developer/answer/11926878

## 5. Pre-launch / quality gate

Before Production:

- Play Pre-launch report reviewed
- crashes: no unresolved release blocker
- ANRs: no unresolved release blocker
- accessibility/usability warnings reviewed
- Android vitals from closed test reviewed where available
- login works on physical mobile devices
- update from previous Play build works
- WebView loads `https://fcarena.in` reliably on Wi-Fi and mobile data
- file/photo upload works on the Play-installed build
- push notification opt-in/opt-out works
- account-deletion page works without login
- Terms acceptance gate works for an existing account with no current acceptance record
- a new registration cannot complete without accepting the Terms
- report/block controls work inside the app
- an FC ARENA AI response can be reported without leaving the app

## 6. Production-access response evidence

Google asks about:

- how testers were recruited
- how easy/difficult recruitment was
- tester engagement
- feedback received
- changes made from feedback
- what the app does / who it is for
- why the developer believes it is production-ready

Answer factually from the feedback log, release notes, Play testing history and CI/device evidence. Do not invent tester behavior or feedback.

## 7. Current engineering safeguards

Run:

```bash
npm run play:compliance
```

This automated gate checks the Android target SDK, package id, permission baseline, HTTPS-only WebView configuration, Firebase notification/Analytics defaults, Privacy Policy disclosures, account-deletion paths and Android version source.

It does **not** prove Play Console eligibility. Closed-test duration, tester opt-in, Pre-launch report, reviewer credentials, Data Safety selections and store-listing declarations still require manual Play Console verification.
