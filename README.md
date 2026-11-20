\# FC ARENA

> **For Codex, ChatGPT, Claude, Copilot and developers:** Read [AGENTS.md](AGENTS.md) before changing features or deploying. Code commits and GitHub builds do **not** deploy to VCL. Preserve live user data, protected rollback and the [production release/storage policy](ops/VCL_RELEASE_STORAGE_POLICY.md). Never clean old releases without separate verified approval.




FC ARENA is a football/esports tournament and community management platform.



\## Features



\- Authentication and OTP

\- Player profiles and FC ARENA IDs

\- League creation and join requests

\- Tournament creation

\- SOLO / DUO / TEAM modes

\- Round Robin and Knockout

\- Fixture generation

\- Match scheduling

\- Match Center

\- Manual result entry

\- Screenshot OCR result processing

\- Result verification

\- Statistics and standings

\- Rankings

\- Achievements

\- Notifications

\- Player career history

\- RBAC and audit logs

\- Responsive mobile and desktop UI



\## Tech Stack



Frontend:

\- Next.js

\- React

\- TypeScript

\- Tailwind CSS



Backend:

\- NestJS

\- Prisma

\- PostgreSQL



Infrastructure:

\- Redis

\- BullMQ

\- Docker



OCR:

\- Tesseract.js

\- Sharp



Testing:

\- Vitest

\- Supertest



\## Run Locally



Install dependencies:



```bash

npm install

