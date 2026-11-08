# FC Arena host connectivity recovery

## Observed on 6 November 2026 (Asia/Kolkata)

- `fcarena.in` and `api.fcarena.in` resolve to `45.129.87.8`.
- Public HTTPS, direct-IP HTTP/HTTPS and SSH on port 22 timed out. A public control request to Google returned HTTP 200 from the same workstation.
- The user reported both FC Arena and the VCCL client panel also fail on mobile data with Wi-Fi disabled.
- `vcclhosting.com` (`103.174.86.54`) and `cp.vcclhosting.com` (`45.129.86.11`) timed out from the workstation too.

This is evidence of host/provider connectivity trouble, not proof of a particular hardware, power, firewall, billing or routing cause. No live service logs, resource metrics or provider incident confirmation were available. No production change or recovery was completed during these checks.

## Restore access first

Use the official [client panel](https://cp.vcclhosting.com/), [network status](https://cp.vcclhosting.com/serverstatus.php) and [support ticket portal](https://cp.vcclhosting.com/submitticket.php). Search-index copies of these pages do not establish their live availability.

Ticket text prepared for the account owner (not sent):

> Production VPS 45.129.87.8 is unreachable on TCP 22, 80 and 443 across Wi-Fi and mobile networks. fcarena.in and api.fcarena.in resolve to that IP. Your website and client portal also time out from our networks. Please check host power, hypervisor health, upstream routing, IP null-routing and firewall state; confirm whether there is a wider incident and share a recovery ETA. Preserve the existing disks and data.

If the provider console works, inspect power state, suspension/billing state and console logs. Start a stopped VM only after its status is understood. If the VM is running, use its console to read `uptime`, `df -h`, `free -m`, service status and kernel/OOM messages before deciding which service needs recovery. Preserve evidence before any reboot.

## After SSH becomes reachable

```bash
systemctl status nginx fcarena-api fcarena-web --no-pager
systemctl show fcarena-api fcarena-web -p Restart -p NRestarts -p Result
journalctl -u fcarena-api -u fcarena-web -u nginx --since '-30 minutes' --no-pager
journalctl -k --since '-30 minutes' --no-pager
df -h /
free -m
curl --fail --max-time 10 http://127.0.0.1:4000/api/health/live
curl --fail --max-time 10 http://127.0.0.1:4000/api/health
curl --fail --max-time 10 http://127.0.0.1:3000/dashboard >/dev/null
nginx -t
```

Restart only a service that has failed, using the live configuration and preserving deployment identity. Check PostgreSQL/Redis health separately when liveness works but readiness fails. Do not restart healthy dependencies or run database migrations to treat a host networking failure.

Run `npm run check:availability` from `/opt/fcarena` after the services recover, then verify login and dashboard rendering on an installed Android app and in a browser. Inspect public TLS and logs for recurring errors.

## Prepared reliability changes and activation

- The availability monitor now covers the website, Android startup, deploy assets and both API routes; its external schedule is five minutes. Merge the relevant files to the default branch to activate the GitHub job. Confirm an actual run and repository failure-notification delivery. GitHub schedules can be delayed.
- Deploy `scripts/check-availability.mjs` together with the updated `ops/monitor/health-check.sh` and `ops/systemd/fcarena-health.service`. Inspect the existing unit, back it up, install the updated unit, run `systemctl daemon-reload`, run the health service once and inspect its journal before enabling the five-minute health timer. Do not use the general stability installer just to activate monitoring: it also runs backup and restore verification.
- `ops/systemd/fcarena-restart.conf` is a prepared process-recovery drop-in. Inspect both live service units and existing drop-ins first, preserve them, then install it under each unit's `service.d/` directory with a distinct filename. Run `systemctl daemon-reload` and inspect effective `Restart`, `RestartUSec`, `StartLimitIntervalUSec` and `StartLimitBurst` values. The policy retries unexpected exits at five-second intervals, with at most five starts in five minutes, and respects `systemctl stop`. A unit that has already failed still needs an explicit recovery start. The policy does not recover a hung process or an offline VM/network. Nothing installs this template automatically.
- `.github/workflows/backend-deploy.yml` and `.github/workflows/production-smoke.yml` still pin `162.35.111.245`, which differs from current public DNS. Verify the intended deployment account, destination, sudo deploy command and trusted host fingerprint before updating those workflows or dispatching a deployment. Do not copy the retired host's fingerprint to the new host or bypass host-key checks.

## Provider outage protection

The current web/API host is a single point of failure. Process restarts and monitoring cannot guarantee continuous availability during a provider outage. A separate-provider standby needs a verified off-server database/media backup or replication, tested restoration, matching app releases, independent health checks and a controlled DNS/load-balancer failover plan. Provisioning infrastructure, moving production traffic and configuring data replication remain separate work; no standby or automatic failover was created here.
