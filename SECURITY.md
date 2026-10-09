# FC ARENA Security Policy

## Supported Versions

FC ARENA is continuously deployed. Security fixes are applied to the current production release and to the active Android release candidate.

| Release | Security support |
| --- | --- |
| Current production web/API on `main` | Supported |
| Current Android Play candidate | Supported |
| Older web deployments and superseded Android builds | Not supported |

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for suspected security vulnerabilities.

Use GitHub's private vulnerability reporting / Security Advisories for this repository when available. If private reporting is unavailable, contact the repository owner privately through the account contact channel rather than posting exploit details publicly.

Please include:

- affected FC ARENA surface (web, API, Android, infrastructure)
- reproduction steps and required account role
- impact and the data/actions exposed
- proof-of-concept details that are safe to reproduce
- any suggested mitigation

Do not include real user credentials, production access tokens, private keys, or unnecessary personal data.

## Response Process

FC ARENA maintainers will:

1. acknowledge a valid private report as soon as practical;
2. reproduce and triage the issue;
3. prepare a fix in a private or restricted branch when disclosure risk requires it;
4. run security, regression, build, and deployment gates;
5. deploy the fix before publishing exploit details when coordinated disclosure is needed.

Severity is assessed from exploitability, affected privileges, confidentiality/integrity/availability impact, and whether the issue is reachable in production.

## Scope

In scope: authentication/authorization bypass, account or league isolation failures, injection/XSS, secret exposure, unsafe file handling, push/deep-link abuse, privilege escalation, sensitive data leakage, and vulnerabilities that can materially affect FC ARENA availability.

Out of scope: social engineering, denial-of-service traffic floods that require unrealistic volume without an application flaw, findings that only affect unsupported historical builds, and reports consisting only of automated scanner output without a reproducible security impact.

## Safe Harbor

Good-faith research that avoids privacy violations, destructive testing, service disruption, persistence, and unnecessary data access will be handled constructively. Stop testing and report privately if you encounter real user data or gain access beyond what is needed to demonstrate the issue.
