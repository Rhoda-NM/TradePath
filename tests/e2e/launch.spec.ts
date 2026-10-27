import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("mobile welcome is accessible and has no horizontal overflow", async ({
  page,
}) => {
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
test("private routes and APIs reject signed-out access", async ({
  page,
  request,
}) => {
  await page.goto("/journal");
  await expect(page).toHaveURL(/\/welcome/);
  expect((await request.get("/api/export")).status()).toBe(401);
  expect(
    (
      await request.get(
        "/api/screenshots?id=11111111-1111-4111-8111-111111111111",
      )
    ).status(),
  ).toBe(401);
  expect((await request.get("/api/account/purge")).status()).toBe(401);
});
test("installation assets and offline fallback never cache private pages", async ({
  page,
  context,
  request,
}) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
  await page.goto("/welcome");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        }),
      );
    return registration.scope;
  });
  await context.setOffline(true);
  await page.goto("/journal");
  await expect(
    page.getByRole("heading", { name: "You’re offline." }),
  ).toBeVisible();
  const urls = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys.map(async (key) =>
          (await (await caches.open(key)).keys()).map(
            (r) => new URL(r.url).pathname,
          ),
        ),
      )
    ).flat();
  });
  expect(urls.sort()).toEqual(
    [
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/maskable-512.png",
      "/offline.html",
    ].sort(),
  );
  await context.setOffline(false);
  await page.getByRole("link", { name: "Try connecting again" }).click();
  await expect(page).toHaveURL(/\/welcome/);
});
test("device preview settings fits mobile and explains installation", async ({
  page,
}) => {
  await page.goto("/preview/settings");
  await expect(
    page.getByRole("heading", { name: "Install TradePath" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
