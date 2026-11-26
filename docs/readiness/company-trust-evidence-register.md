# FC ARENA company trust and compliance — owner evidence register

Reviewed 26 November 2026. This is an operational readiness register, not legal certification. Do not mark external items passed without evidence. Never collect credentials, real user records, private contracts or signing keys in public CI logs or the repository.

| Control | Source evidence / current status | Required owner-side evidence |
|---|---|---|
| Legal operator and registrations | FC ARENA named in Terms and Privacy; no legal entity assumed | Confirm actual operator, registration, registered address, tax position and jurisdiction with counsel/accountant |
| Privacy and processors | Privacy policy and Step 16 worksheet updated for VCCLHosting; source gate passed on previous head | Confirm processor contracts, regions, Firebase/Brevo/Cloudinary/AI behavior and privacy contact |
| Account deletion | Existing public and signed-in flows, source gate passed | Disposable-account rehearsal: verification, removal/anonymization, sessions, tokens, media, providers, backup retention; no real user deletion |
| Play Console | Data Safety worksheet and Android SDK inventory exist | Exact distributed build, Data Safety declaration and external deletion URL verified in Console; no false answers |
| Community safety | Terms, reports/blocking and moderation flows exist | Verify reporting response, appeals, escalation, safeguarding and documented operator process |
| Age and children | DOB collection disclosed; age-related controls require evidence | Review lawful age thresholds, age assurance and consent requirements for applicable markets |
| DPDP | Phased commencement under India notifications of 13 November 2025 | Counsel review applicable provisions, notices, consent, rights, children's data, grievance and breach response before each applicable date |
| Club and game IP | Unofficial fan-inspired palettes, original CSS geometry, no new official marks | Inventory existing crest/game/media permissions and licenses; obtain rights or replace unlicensed assets |
| Accessibility | Contrast calculations and synthetic browser coverage | Actual assistive technology, keyboard, forced colors, zoom, device font scale, physical handset checks |
| Reliability | Existing CI security, restore and release safeguards | Exact new candidate artifact, current live status, backup and rollback proof, real authenticated staging, physical Android evidence |

Primary references (verify current policy when preparing a release):
- Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Data Safety declaration: https://support.google.com/googleplay/android-developer/answer/10787469
- MeitY DPDP Act commencement notification: https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf
- MeitY DPDP Rules 2025: https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa

Record approval/evidence privately: control, verifier, date, exact app release/build, evidence location, pass/fail, residual issue, responsible owner and next review date. Do not represent a source consistency check as compliance certification. A public endpoint tool failure is not evidence of a production outage. No production changes, company formation, legal filings or Play publication authorized by this register.

## Additional source finding and correction
The previous account-deletion transaction cleared the login phone but left the separate Player.whatsappNumber and whatsappShareEnabled. It also retained private account preferences and authored Arena Talk content after disabling the account. The candidate clears these fields, redacts/hides only authored non-result posts and comments, detaches authored media, and removes the account's reactions/votes and private community/experience preferences. The existing orphan cleanup is not proof of physical file or backup erasure; verify it separately. Extended isolated PostgreSQL E2E asserts erased values and preserved result/history records. The privacy policy and Data Safety worksheet now also explicitly identify the existing first-party Web Vitals measurements and optional Redis aggregate expiry. No new data collection, migration, retroactive production cleanup or deletion was performed. DOB validation currently accepts valid dates through today; the operator must settle age/consent rules before claiming children's-data compliance.
