# FC Arena runtime isolation

The API and web service run as different system users with no interactive login.
Keep source and dependency files owned by root and readable by the services.
Only the API user can read the root-owned `apps/api/.env` (group `fcarena-api`,
mode `0640`). The web user must not be in that group.

The API can write only its storage and upload directories; the web service can
write only its Next cache. Both have private temporary directories, no Linux
capabilities, no privilege escalation, and a read-only system filesystem. Bind
Next to loopback; Nginx handles external HTTPS connections.

Create/verify the system users and runtime directories before installing these
drop-ins. Keep a per-path ownership/mode backup, validate service definitions,
then restart and check both release versions and authenticated media handling.
Roll back the drop-ins and path ownership together if verification fails.

The services start Node directly. Run database migrations as a controlled
deployment step before activation; never grant runtime users write access to
source, dependencies, deployment backups or service configuration. Existing
release EnvironmentFiles remain in force.

Push remains disabled until valid Firebase Admin service-account credentials
are configured. Do not substitute client Firebase config or unrelated JSON.
