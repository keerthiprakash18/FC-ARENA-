# Step 15 — Account Deletion End to End

Status: implementation ready; accepted when the isolated account-deletion E2E suite is green.

## Signed-in deletion

A signed-in user can permanently delete from `/account-deletion` after entering the current password and typing `DELETE`.

The authenticated endpoint:

- verifies the password
- rate-limits deletion attempts
- removes active refresh sessions
- removes FCM push devices
- removes OTP records
- removes personal in-app Notifications
- removes active scoped/admin authorization assignments
- removes the Cloudinary profile image when one exists
- removes stored OCR screenshot files connected to the account where FC ARENA controls those files
- anonymizes User email, name, phone, password, role/status and verification state
- anonymizes Player code, In-Game Name, game UID and profile image
- scrubs personal text/evidence from retained disputes, Fair Play records, OCR data, awards metadata and Audit Log metadata
- de-identifies cached ranking snapshots
- anonymizes SOLO Tournament entry display names
- immediately invalidates old access tokens because the account status becomes DISABLED

## Historical integrity

The User/Player primary key is retained only as an anonymized record so completed competition relationships, results, standings and awards do not corrupt. Retained records cannot be used to sign in and use the replacement anonymous identity.

## Cannot sign in

The existing public deletion-request form remains available. It records a verification request without asking for a password or OTP.

## E2E acceptance

The isolated E2E test verifies wrong-password rejection, successful deletion, session/push/OTP/Notification removal, anonymized identity, retained League competition relationship, scrubbed deletion-request metadata and rejection of the old access token after deletion.
