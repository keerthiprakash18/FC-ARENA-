import assert from "node:assert/strict";

import { chromium } from "playwright";

import { createUiContext, checkLayout, user } from "./phase-ui-harness.mjs";

import { phaseData } from "./phase-ui-fixtures.mjs";

import { mkdir } from "node:fs/promises";

const origin = process.env.SMOKE_WEB_ORIGIN || "http://127.0.0.1:3000";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROMIUM_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--no-sandbox"],
});

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

const ok = (route, headers, data) =>
  route.fulfill({ headers, json: { success: true, data, error: null } });

async function assets(page) {
  await page.route(`${origin}/**`, async (route) => {
    if (new URL(route.request().url()).pathname.startsWith("/api/"))
      return route.fallback();

    const response = await fetch(route.request().url());

    const headers = Object.fromEntries(response.headers);
    for (const key of [
      "content-encoding",
      "transfer-encoding",
      "content-length",
    ])
      delete headers[key];

    return route.fulfill({
      status: response.status,
      headers,
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
}
const telemetryOnly = (route, headers) => {
  assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals');
  return route.fulfill({ status: 204, headers });
};

await mkdir(".cache/result-flow", { recursive: true });

try {
  for (const width of [320, 390, 1280]) {
    let account = user.id,
      fixtureId = "fixture-one",
      extraction = null,
      submissions = [],
      posts = 0,
      accept = false;

    const { context, page, errors } = await createUiContext(browser, {
      width,
      native: width < 500,
      direct: true,
      role: "USER",

      overrides: {
        "/api/auth/me": (route, headers) =>
          ok(route, headers, { user: { ...user, id: account, role: "USER" } }),

        "/api/matches/phase3": (route, headers) =>
          ok(route, headers, {
            match: {
              ...phaseData["/api/matches/phase3"].match,
              fixture: {
                ...phaseData["/api/matches/phase3"].match.fixture,
                id: fixtureId,
              },
            },
          }),

        "/api/matches/phase3/ocr/latest": (route, headers) =>
          ok(route, headers, { extraction }),

        "/api/matches/phase3/results": (route, headers) =>
          ok(route, headers, {
            isLeagueAdmin: false,
            canVerifyResult: false,
            confirmedResultSubmissionId: null,
            submissions,
          }),
      },
      onMutation: (route, headers) => {
        if (
          new URL(route.request().url()).pathname ===
          "/api/telemetry/web-vitals"
        )
          return route.fulfill({ status: 204, headers });

        assert.equal(
          new URL(route.request().url()).pathname,
          "/api/matches/phase3/results",
        );
        posts++;

        assert.deepEqual(route.request().postDataJSON(), {
          homeScore: 2,
          awayScore: 0,
        });

        if (!accept)
          return route.fulfill({
            status: 503,
            headers,
            json: {
              success: false,
              data: null,
              error: {
                code: "TEMPORARY",
                message: "Result service unavailable. Retry later.",
              },
            },
          });

        submissions = [
          {
            id: "accepted",
            status: "PENDING_VERIFICATION",
            homeScore: 2,
            awayScore: 0,
            createdAt: new Date().toISOString(),
            submittedBy: { ...user, id: account },
            reviewedBy: null,
            rejectionReason: null,
          },
        ];

        return ok(route, headers, {
          message: "Result received for verification.",
          submission: { id: "accepted" },
        });
      },
    });

    await context.grantPermissions(["local-network-access"], { origin });
    await assets(page);

    try {
      await page.goto(`${origin}/matches/phase3`);

      const manual = page.locator("#result-entry");

      await manual.locator("[name=homeScore]").fill("2");
      await manual.locator("[name=awayScore]").fill("0");

      await page
        .getByText("Upload a screenshot instead", { exact: true })
        .click();

      await page
        .getByLabel("Match result screenshot")
        .setInputFiles({
          name: "saved-score.png",
          mimeType: "image/png",
          buffer: image,
        });

      await page
        .getByText("Draft saved on this device.", { exact: true })
        .waitFor();

      await page.reload();
      await page.waitForFunction(() => {
        const input = document.querySelector("#result-entry [name=homeScore]");
        return input && !input.disabled;
      });

      assert.equal(await manual.locator("[name=homeScore]").inputValue(), "2");
      assert.equal(await manual.locator("[name=awayScore]").inputValue(), "0");

      await page
        .getByText("Upload a screenshot instead", { exact: true })
        .click();

      await page.getByText(/Selected screenshot: saved-score.png/).waitFor();

      // Separate accounts cannot read each other's draft. Returning restores the owner's draft.

      account = "another-account";
      await page.reload();
      await page.waitForFunction(() => {
        const input = document.querySelector("#result-entry [name=homeScore]");
        return input && !input.disabled;
      });
      await manual.locator("[name=homeScore]").waitFor();

      assert.equal(await manual.locator("[name=homeScore]").inputValue(), "");

      account = user.id;
      await page.reload();
      await page.waitForFunction(() => {
        const input = document.querySelector("#result-entry [name=homeScore]");
        return input && !input.disabled;
      });
      await page
        .getByText("Draft restored on this device.", { exact: true })
        .waitFor();

      assert.equal(await manual.locator("[name=homeScore]").inputValue(), "2");

      // OCR edits survive reload but are never applied to a different extraction.

      extraction = {
        id: "ocr-one",
        status: "COMPLETED",
        scoreConfidence: 0.9,
        detectedHomeScore: 3,
        detectedAwayScore: 1,
        resultSubmission: null,
      };

      await page.reload();
      await page.waitForFunction(() => {
        const input = document.querySelector("#result-entry [name=homeScore]");
        return input && !input.disabled;
      });
      await page
        .getByText("Upload a screenshot instead", { exact: true })
        .click();

      const ocr = page
        .locator("form")
        .filter({ hasText: "Verify Detected Result" });

      await ocr.getByRole("spinbutton").nth(0).fill("0");
      await ocr.getByRole("spinbutton").nth(1).fill("4");

      await page
        .getByText("Draft saved on this device.", { exact: true })
        .waitFor();
      await page.reload();
      await page.waitForFunction(() => {
        const input = document.querySelector("#result-entry [name=homeScore]");
        return input && !input.disabled;
      });
      await page
        .getByText("Upload a screenshot instead", { exact: true })
        .click();

      assert.equal(await ocr.getByRole("spinbutton").nth(0).inputValue(), "0");
      assert.equal(await ocr.getByRole("spinbutton").nth(1).inputValue(), "4");

      extraction = { ...extraction, id: "ocr-two", detectedHomeScore: 6 };
      await page.reload();
      await page.waitForFunction(() => {
        const input = document.querySelector("#result-entry [name=homeScore]");
        return input && !input.disabled;
      });
      await page
        .getByText("Upload a screenshot instead", { exact: true })
        .click();

      assert.equal(await ocr.getByRole("spinbutton").nth(0).inputValue(), "6");

      // A failed write preserves the draft and does not replay the mutation.

      await manual
        .getByRole("button", { name: "Submit Manual Result", exact: true })
        .click();

      await page
        .getByText("Result service unavailable. Retry later.", { exact: true })
        .waitFor();
      assert.equal(posts, 1);

      await page.reload();
      await page.waitForFunction(() => {
        const input = document.querySelector("#result-entry [name=homeScore]");
        return input && !input.disabled;
      });
      await page
        .getByText("Draft restored on this device.", { exact: true })
        .waitFor();
      assert.equal(await manual.locator("[name=homeScore]").inputValue(), "2");

      accept = true;
      await manual
        .getByRole("button", { name: "Submit Manual Result", exact: true })
        .click();

      await page
        .getByText("Result received for verification.", { exact: true })
        .waitFor();
      assert.equal(posts, 2);

      await page.reload();
      await page.getByText(/Result submitted.*awaiting verification/).waitFor();
      assert.equal(await manual.count(), 0);

      assert.equal(await page.getByText(/Selected screenshot:/).count(), 0);

      // A fixture pairing change discards obsolete scores before edits become available.

      submissions = [];
      await page.reload();
      await manual.locator("[name=homeScore]").fill("8");
      await page
        .getByText("Draft saved on this device.", { exact: true })
        .waitFor();

      fixtureId = "changed-fixture";
      await page.reload();
      await page.waitForFunction(() => {
        const input = document.querySelector("#result-entry [name=homeScore]");
        return input && !input.disabled;
      });
      await manual.locator("[name=homeScore]").waitFor();
      assert.equal(await manual.locator("[name=homeScore]").inputValue(), "");

      await checkLayout(page, `result drafts ${width}`);
      assert.deepEqual(errors, []);

      console.log(
        `PASS draft ${width}: scores/screenshot restore, account isolation, OCR identity, failed POST retained, accepted cleared, fixture changed`,
      );
    } finally {
      await context.close();
    }
  }

  {
    const match = phaseData["/api/matches/phase3"].match;
    const {
      context,
      page: firstPage,
      errors,
    } = await createUiContext(browser, {
      width: 390,
      direct: true,
      native: true,
      onMutation: telemetryOnly,
      overrides: {
        "/api/matches/phase3": {
          match: {
            ...match,
            tournament: { ...match.tournament, competitionFormat: "UCL_CUP" },
            fixture: {
              ...match.fixture,
              roundName: "UCL FINAL",
              matchday: null,
            },
          },
        },
      },
    });
    let page = firstPage;
    await context.grantPermissions(["local-network-access"], { origin });
    await assets(page);
    try {
      await page.goto(`${origin}/matches/phase3`);
      let manual = page.locator("#result-entry");
      await page.waitForFunction(() => {
        const input = document.querySelector("#result-entry [name=homeScore]");
        return input && !input.disabled;
      });
      await context.setOffline(true);
      await manual.locator("[name=homeScore]").fill("1");
      await manual.locator("[name=awayScore]").fill("1");
      await manual.locator("[name=homePenaltyScore]").fill("5");
      await manual.locator("[name=awayPenaltyScore]").fill("4");
      await page
        .getByText("Draft saved on this device.", { exact: true })
        .waitFor();
      await context.setOffline(false);
      await page.reload();
      await page
        .getByText("Draft restored on this device.", { exact: true })
        .waitFor();
      assert.equal(
        await manual.locator("[name=homePenaltyScore]").inputValue(),
        "5",
      );
      assert.equal(
        await manual.locator("[name=awayPenaltyScore]").inputValue(),
        "4",
      );
      await page.close();
      page = await context.newPage();
      await assets(page);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/matches/phase3`);
      await page
        .getByText("Draft restored on this device.", { exact: true })
        .waitFor();
      manual = page.locator("#result-entry");
      assert.equal(
        await manual.locator("[name=homePenaltyScore]").inputValue(),
        "5",
      );
      await page
        .getByRole("button", { name: "Discard draft", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Discard draft", exact: true })
        .click();
      await page.reload();
      await manual.locator("[name=homeScore]").fill("3");
      await page
        .getByText("Draft saved on this device.", { exact: true })
        .waitFor();
      await page.evaluate(async () => {
        const connection = await new Promise((resolve, reject) => {
          const r = indexedDB.open("fcarena-result-drafts", 1);
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
        await new Promise((resolve, reject) => {
          const tx = connection.transaction("drafts", "readwrite"),
            store = tx.objectStore("drafts"),
            r = store.get("phase3:phase3");
          r.onsuccess = () =>
            store.put(
              { ...r.result, updatedAt: Date.now() - 8 * 86400_000 },
              "phase3:phase3",
            );
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        connection.close();
      });
      await page.reload();
      await page.waitForFunction(() => {
        const i = document.querySelector("#result-entry [name=homeScore]");
        return i && !i.disabled;
      });
      assert.equal(await manual.locator("[name=homeScore]").inputValue(), "");
      assert.deepEqual(errors, []);
      console.log(
        "PASS draft: offline penalties survive reload; explicit discard and seven-day expiry remove old drafts",
      );
    } finally {
      await context.close();
    }
  }
  for (const failure of ["unavailable", "quota"]) {
    const { context, page } = await createUiContext(browser, {
      width: 390,
      direct: true,
      native: true,
      onMutation: telemetryOnly,
    });
    await context.addInitScript((failure) => {
      if (failure === "unavailable")
        Object.defineProperty(window, "indexedDB", {
          get() {
            throw new Error("Storage unavailable");
          },
        });
      else
        IDBObjectStore.prototype.put = function () {
          throw new DOMException("Storage full", "QuotaExceededError");
        };
    }, failure);
    await context.grantPermissions(["local-network-access"], { origin });
    await assets(page);
    try {
      await page.goto(`${origin}/matches/phase3`);
      if (failure === "unavailable")
        await page
          .getByText(
            "Draft storage is unavailable. Keep this page open until you submit.",
            { exact: true },
          )
          .waitFor();
      await page.locator("#result-entry [name=homeScore]").fill("2");
      await page
        .getByText(
          "Could not save this draft. Keep this page open until you submit.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await page.locator("#result-entry [name=homeScore]").inputValue(),
        "2",
      );
      console.log(
        `PASS draft: ${failure} storage reports failure and leaves score entry usable`,
      );
    } finally {
      await context.close();
    }
  }

  for (const width of [320, 390, 1280]) {
    const tournaments = [
      {
        id: "cup-a",
        name: "Arena Cup",
        leagueId: "league-a",
        league: { name: "Arena League" },
      },
    ];

    let rows = [
      {
        id: "result-a",
        status: "PENDING_VERIFICATION",
        homeScore: 2,
        awayScore: 1,
        homePenaltyScore: null,
        awayPenaltyScore: null,

        createdAt: new Date().toISOString(),
        reviewedAt: null,
        submittedBy: { fullName: "Player One" },
        reviewedBy: null,
        rejectionReason: null,

        ocrExtraction: { id: "ocr", scoreConfidence: 0.49 },
        match: {
          id: "phase3",
          tournamentId: "cup-a",
          fixture: {
            fixtureCode: "F1",
            roundName: "Semi-final",
            homeRegistration: { entryName: "Home Club", members: [] },
            awayRegistration: { entryName: "Away Club", members: [] },
          },
        },
      },
    ];

    let reviews = 0,
      images = 0;

    const { context, page, errors } = await createUiContext(browser, {
      width,
      native: width < 500,
      direct: true,
      mode: width === 390 ? "DARK" : "LIGHT",

      overrides: {
        "/api/admin/results": (route, headers) => {
          const q = new URL(route.request().url()).searchParams;
          const selected = rows.filter((row) => row.status === q.get("status"));
          return ok(route, headers, {
            submissions: selected,
            total: selected.length,
            page: 1,
            pageSize: 20,
            tournaments,
          });
        },

        "/api/results/result-a/evidence": (route, headers) => {
          images++;
          return ok(route, headers, {
            mimeType: "image/png",
            base64: image.toString("base64"),
          });
        },
      },
      onMutation: (route, headers) => {
        const path = new URL(route.request().url()).pathname;

        if (path === "/api/telemetry/web-vitals")
          return route.fulfill({ status: 204, headers });

        reviews++;

        if (path.endsWith("/reject")) {
          assert.equal(
            route.request().postDataJSON().reason,
            "Wrong screenshot",
          );
          rows = rows.map((row) => ({
            ...row,
            status: "REJECTED",
            rejectionReason: "Wrong screenshot",
          }));
        } else {
          assert.equal(path, "/api/results/result-a/confirm");
          rows = rows.map((row) => ({ ...row, status: "CONFIRMED" }));
        }

        return ok(route, headers, {
          message: path.endsWith("/reject")
            ? "Result rejected."
            : "Result confirmed.",
        });
      },
    });

    await context.grantPermissions(["local-network-access"], { origin });
    await assets(page);

    try {
      await page.goto(`${origin}/admin/results`);
      await page
        .getByText("1 awaiting review · oldest first", { exact: true })
        .waitFor();

      assert.equal(images, 0);
      await page
        .getByRole("button", { name: "Review screenshot", exact: true })
        .click();

      await page.getByAltText("Submitted match result screenshot").waitFor();
      assert.equal(images, 1);

      await checkLayout(page, `admin review ${width}`);
      await page.screenshot({
        path: `.cache/result-flow/queue-${width}.png`,
        fullPage: true,
      });

      await page
        .getByRole("button", { name: "Verify result", exact: true })
        .click();

      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Verify result", exact: true })
        .click();

      await page.getByText("All caught up", { exact: true }).waitFor();
      assert.equal(reviews, 1);

      await page.getByLabel("Review status").selectOption("CONFIRMED");
      await page.getByText("1 verified results", { exact: true }).waitFor();

      assert.equal(
        await page
          .getByRole("button", { name: "Verify result", exact: true })
          .count(),
        0,
      );

      rows = rows.map((row) => ({ ...row, status: "PENDING_VERIFICATION" }));
      await page
        .getByLabel("Review status")
        .selectOption("PENDING_VERIFICATION");

      await page
        .getByRole("button", { name: "Reject result", exact: true })
        .click();

      await page
        .getByRole("dialog")
        .getByLabel("Rejection reason")
        .fill("Wrong screenshot");

      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Reject result", exact: true })
        .click();

      await page.getByText("All caught up", { exact: true }).waitFor();
      assert.equal(reviews, 2);

      await page.getByLabel("Review status").selectOption("REJECTED");
      await page
        .getByText("Reason: Wrong screenshot", { exact: true })
        .waitFor();

      assert.deepEqual(errors, []);
      console.log(
        `PASS queue ${width}: lazy evidence, verify, reject reason, history, responsive layout`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
