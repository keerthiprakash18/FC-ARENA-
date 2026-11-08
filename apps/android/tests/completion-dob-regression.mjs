import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import {
  createUiContext,
  career,
  user,
  checkLayout,
} from "./phase-ui-harness.mjs";
import { phaseData } from "./phase-ui-fixtures.mjs";

const origin = process.env.SMOKE_WEB_ORIGIN || "http://127.0.0.1:3000";
const folder = ".cache/completion-dob/";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROMIUM_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--no-sandbox"],
});
const results = [];
const ok = (route, headers, data) =>
  route.fulfill({ headers, json: { success: true, data, error: null } });
const fail = (route, headers, status = 503) =>
  route.fulfill({
    headers,
    status,
    json: {
      success: false,
      data: null,
      error: {
        code: "TEST_UNAVAILABLE",
        message: "Temporary test interruption",
      },
    },
  });
const telemetry = (route, headers) => {
  assert.equal(
    new URL(route.request().url()).pathname,
    "/api/telemetry/web-vitals",
  );
  return route.fulfill({ status: 204, headers });
};
async function assets(page) {
  await page.route(`${origin}/**`, async (route) => {
    if (new URL(route.request().url()).pathname.startsWith("/api/"))
      return route.fallback();
    const response = await fetch(route.request().url());
    const headers = Object.fromEntries(response.headers);
    for (const name of [
      "content-encoding",
      "transfer-encoding",
      "content-length",
    ])
      delete headers[name];
    return route.fulfill({
      status: response.status,
      headers,
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
}
async function setup(options) {
  const f = await createUiContext(browser, {
    direct: true,
    mode: options.width < 500 ? "DARK" : "LIGHT",
    native: options.width < 500,
    ...options,
  });
  await f.context.grantPermissions(["local-network-access"], { origin });
  await assets(f.page);
  return f;
}
async function waitUntil(test) {
  const end = Date.now() + 15000;
  while (!test()) {
    if (Date.now() > end)
      throw new Error("Timed out waiting for fixture reads");
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}
await mkdir(folder, { recursive: true });
try {
  if (!process.env.ONLY_PUBLIC) {
  for (const width of [390, 1280]) {
    for (const [path, endpoint, data] of [
      [
        "/settings/notifications",
        "/api/notifications/preferences",
        { preferences: {} },
      ],
      [
        "/settings/dashboard",
        "/api/auth/preferences/dashboard",
        { preferences: { hiddenSections: [] } },
      ],
      ["/career", "/api/players/me/career", career],
      ["/admin/leagues", "/api/leagues/my", phaseData["/api/leagues/my"]],
      [
        "/admin/tournaments",
        "/api/leagues/phase3/tournaments",
        phaseData["/api/leagues/phase3/tournaments"],
      ],
      [
        "/fixtures/manage",
        "/api/leagues/phase3/tournaments",
        phaseData["/api/leagues/phase3/tournaments"],
      ],
      [
        "/tournaments",
        "/api/leagues/phase3/tournaments",
        phaseData["/api/leagues/phase3/tournaments"],
      ],
    ]) {
      let available = false,
        reads = 0;
      const f = await setup({
        width,
        overrides: {
          [endpoint]: (route, headers) => {
            reads++;
            return available ? ok(route, headers, data) : fail(route, headers);
          },
        },
        onMutation: telemetry,
      });
      try {
        await f.page.goto(origin + path);
        await f.page
          .getByRole("button", { name: "Try again", exact: true })
          .first()
          .waitFor();
        assert.equal(new URL(f.page.url()).pathname, path);
        for (const name of [
          "No League admin access",
          "No admin Tournaments",
          "No active tournaments",
        ])
          assert.equal(
            await f.page.getByRole("heading", { name, exact: true }).count(),
            0,
          );
        await f.context.setOffline(true);
        await f.page.waitForTimeout(400);
        const paused = reads;
        await f.page.waitForTimeout(1100);
        assert.equal(reads, paused);
        available = true;
        await f.context.setOffline(false);
        await f.page
          .getByRole("button", { name: "Try again", exact: true })
          .waitFor({ state: "hidden", timeout: 15000 });
        await f.page.locator("h1").first().waitFor();
        assert.equal(new URL(f.page.url()).pathname, path);
        assert.deepEqual(f.errors, []);
        await checkLayout(f.page, `${path} ${width}`);
        results.push({ path, width, pass: true });
        console.log(
          `PASS recovery ${width} ${path}: error, offline pause, reconnect, scoped data`,
        );
      } finally {
        await f.context.close();
      }
    }
  }
  for (const width of [320, 390, 1280]) {
    let dateOfBirth = null,
      writes = 0,
      savedResponse = false,
      currentId = user.id;
    const f = await setup({
      width,
      overrides: {
        "/api/auth/me": (route, headers) =>
          ok(route, headers, { user: { ...user, id: currentId, dateOfBirth } }),
      },
      onMutation: (route, headers) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/telemetry/web-vitals")
          return route.fulfill({ status: 204, headers });
        if (path === "/api/auth/login")
          return ok(route, headers, {
            accessToken: "fixture-only",
            expiresIn: 3600,
            user: { ...user, dateOfBirth },
          });
        assert.equal(path, "/api/auth/me/date-of-birth");
        writes++;
        assert.deepEqual(route.request().postDataJSON(), {
          dateOfBirth: "2000-02-29",
        });
        if (!savedResponse) return fail(route, headers);
        dateOfBirth = "2000-02-29";
        return ok(route, headers, {
          dateOfBirth,
          message: "Date of birth saved.",
        });
      },
    });
    try {
      await f.page.goto(origin + "/login");
      await f.page
        .getByLabel("Email or Game Name", { exact: true })
        .fill("fixture@example.invalid");
      await f.page.getByLabel("Password", { exact: true }).fill("Fixture123!");
      await f.page.locator("form button[type=submit]").click();
      await f.page.waitForURL("**/profile/date-of-birth");
      await f.page.getByLabel("Date of birth", { exact: true }).waitFor();
      await f.page
        .getByRole("link", { name: "I'll add it later", exact: true })
        .click();
      await f.page
        .getByRole("complementary", { name: "Date of birth reminder" })
        .waitFor();
      await f.page.screenshot({
        path: `${folder}reminder-${width}.png`,
        fullPage: true,
      });
      await f.page
        .getByRole("link", { name: "Add date of birth", exact: true })
        .click();
      const input = f.page.getByLabel("Date of birth", { exact: true });
      await input.fill("2999-01-01");
      assert.equal(
        await input.evaluate((element) => element.checkValidity()),
        false,
      );
      await input.fill("2000-02-29");
      await f.page
        .getByRole("button", { name: "Save date of birth", exact: true })
        .click();
      await f.page
        .getByText("Temporary test interruption", { exact: true })
        .waitFor();
      assert.equal(writes, 1);
      assert.equal(await input.inputValue(), "2000-02-29");
      savedResponse = true;
      await f.page
        .getByRole("button", { name: "Save date of birth", exact: true })
        .click();
      await f.page.getByText("Date of birth saved.", { exact: true }).waitFor();
      assert.equal(writes, 2);
      await checkLayout(f.page, `date of birth ${width}`);
      await f.page.screenshot({
        path: `${folder}dob-${width}.png`,
        fullPage: true,
      });
      await f.page
        .getByRole("link", { name: "Continue to home", exact: true })
        .click();
      await f.page.locator("h1").waitFor();
      assert.equal(
        await f.page
          .getByRole("complementary", { name: "Date of birth reminder" })
          .count(),
        0,
      );
      await f.page.reload();
      await f.page.locator("h1").waitFor();
      assert.equal(
        await f.page
          .getByRole("link", { name: "Add date of birth", exact: true })
          .count(),
        0,
      );
      await f.page.goto(origin + "/login");
      await f.page
        .getByLabel("Email or Game Name", { exact: true })
        .fill("fixture@example.invalid");
      await f.page.getByLabel("Password", { exact: true }).fill("Fixture123!");
      await f.page.locator("form button[type=submit]").click();
      await f.page.waitForURL("**/dashboard");
      currentId = "another-owner";
      dateOfBirth = null;
      await f.page.reload();
      await f.page
        .getByRole("complementary", { name: "Date of birth reminder" })
        .waitFor();
      assert.deepEqual(f.errors, []);
      results.push({ path: "login/DOB/reminder", width, pass: true });
      console.log(
        `PASS DOB ${width}: login prompt, later/reminder, validation, failed write preserved, save, no repeated prompt, account isolation`,
      );
    } finally {
      await f.context.close();
    }
  }
  // Registration includes the date, and uncertain saves reconcile through an owner-only read.
  {
    let registered = null,
      dateOfBirth = null,
      writes = 0;
    const f = await setup({
      width: 390,
      overrides: {
        "/api/auth/me": (route, headers) =>
          ok(route, headers, { user: { ...user, dateOfBirth } }),
      },
      onMutation: (route, headers) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/telemetry/web-vitals")
          return route.fulfill({ status: 204, headers });
        if (path === "/api/auth/register") {
          registered = route.request().postDataJSON();
          return ok(route, headers, {
            message: "Registration successful.",
            player: { playerCode: "NEW" },
          });
        }
        assert.equal(path, "/api/auth/me/date-of-birth");
        writes++;
        dateOfBirth = "1996-07-18";
        return fail(route, headers);
      },
    });
    try {
      await f.page.goto(origin + "/register");
      await f.page.getByLabel("Full Name", { exact: true }).fill("New Player");
      await f.page
        .getByLabel("Email", { exact: true })
        .fill("new@example.invalid");
      await f.page
        .getByLabel("Date of birth", { exact: true })
        .fill("2000-02-29");
      await f.page
        .getByLabel("In-Game Name", { exact: true })
        .fill("NewPlayer");
      await f.page.getByLabel("Password", { exact: true }).fill("Fixture123!");
      await f.page
        .getByLabel("Confirm Password", { exact: true })
        .fill("Fixture123!");
      await f.page.locator("form button[type=submit]").click();
      await f.page.waitForURL("**/login");
      assert.equal(registered.dateOfBirth, "2000-02-29");
      await f.page.goto(origin + "/profile/date-of-birth");
      await f.page
        .getByLabel("Date of birth", { exact: true })
        .fill("1996-07-18");
      await f.page
        .getByRole("button", { name: "Save date of birth", exact: true })
        .click();
      await f.page.getByText("Date of birth saved.", { exact: true }).waitFor();
      assert.equal(writes, 1);
      assert.deepEqual(f.errors, []);
      results.push({ path: "registration/ambiguous DOB save", pass: true });
      console.log(
        "PASS registration DOB and reconciliation without replaying an uncertain write",
      );
    } finally {
      await f.context.close();
    }
  }
  for (const width of [390, 1280]) {
    let sends = 0,
      failSend = false;
    const f = await setup({
      width,
      onMutation: (route, headers) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/telemetry/web-vitals")
          return route.fulfill({ status: 204, headers });
        assert.equal(path, "/api/auth/forgot-password");
        assert.deepEqual(route.request().postDataJSON(), {
          email: "fixture@example.invalid",
        });
        sends++;
        return failSend ? fail(route, headers) : ok(route, headers, {});
      },
    });
    await f.context.addInitScript(() =>
      sessionStorage.setItem("fc_reset_email", "fixture@example.invalid"),
    );
    try {
      await f.page.clock.install({ time: new Date() });
      await f.page.goto(origin + "/reset-password");
      await f.page
        .getByRole("button", { name: "Resend code", exact: true })
        .click();
      await f.page.getByText(/a new reset code has been requested/).waitFor();
      assert.equal(sends, 1);
      assert.equal(
        await f.page
          .getByRole("button", { name: /Resend code in/ })
          .isDisabled(),
        true,
      );
      await f.page.reload();
      await f.page.getByRole("button", { name: /Resend code in/ }).waitFor();
      await f.page.clock.fastForward(61000);
      await f.page
        .getByRole("button", { name: "Resend code", exact: true })
        .waitFor();
      failSend = true;
      await f.page
        .getByRole("button", { name: "Resend code", exact: true })
        .click();
      await f.page
        .getByText("Temporary test interruption", { exact: true })
        .waitFor();
      assert.equal(sends, 2);
      await checkLayout(f.page, `OTP resend ${width}`);
      assert.deepEqual(f.errors, []);
      results.push({ path: "OTP resend", width, pass: true });
      console.log(
        `PASS OTP ${width}: resend, persistent cooldown, expiry, failed response without replay`,
      );
    } finally {
      await f.context.close();
    }
  }
  }
  for (const width of [390, 1280]) {
    let available = false,
      reads = 0;
    const f = await setup({
      width,
      overrides: {
        "/api/public/tournaments/PHASE3": (route, headers) => {
          reads++;
          return available
            ? ok(route, headers, phaseData["/api/public/tournaments/PHASE3"])
            : fail(route, headers);
        },
      },
      onMutation: telemetry,
    });
    try {
      await f.page.goto(origin + "/public/tournaments/PHASE3");
      await f.page
        .getByRole("button", { name: "Try again", exact: true })
        .waitFor();
      available = true;
      await f.page
        .getByRole("button", { name: "Try again", exact: true })
        .click();
      await f.page
        .getByText("Results are up to date.", { exact: false })
        .waitFor();
      await f.page.getByText(/Last updated:/).waitFor();
      const before = reads;
      available = false;
      await f.page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await waitUntil(() => reads >= before + 2);
      await f.page
        .getByText("Reconnecting. Results may be out of date.", { exact: false })
        .waitFor();
      assert.equal(await f.page.locator("h1").count(), 1);
      await f.context.setOffline(true);
      await f.page
        .getByText("Offline. Showing the last successfully loaded results.", {
          exact: false,
        })
        .waitFor();
      const paused = reads;
      await f.page.waitForTimeout(1100);
      assert.equal(reads, paused);
      available = true;
      await f.context.setOffline(false);
      await f.page
        .getByText("Results are up to date.", { exact: false })
        .waitFor();
      await checkLayout(f.page, `public status ${width}`);
      assert.deepEqual(f.errors, []);
      results.push({ path: "public refresh", width, pass: true });
      console.log(
        `PASS public ${width}: initial retry, retained stale results, offline status, reconnect`,
      );
    } finally {
      await f.context.close();
    }
  }
} catch (error) {
  results.push({ pass: false, error: error.message });
  throw error;
} finally {
  await browser.close();
  await writeFile(
    folder + (process.env.ONLY_PUBLIC ? "browser-public-results.json" : "browser-results.json"),
    JSON.stringify(results, null, 2),
  );
}
