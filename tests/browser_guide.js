// Run with the Playwright browser_run_code tool, passing this function as code.
// Open index.html first. Uses the supplied page and no additional packages.
async (page) => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.getByLabel("앱 이름", { exact: true }).fill("my-friend-ai");
  await page.getByLabel("실행 환경", { exact: true }).selectOption("development");
  assert((await page.locator("#preview-data").textContent()).includes('name: "my-friend-ai"'), "Data must update");
  await page.getByRole("tab", { name: "3. 결과" }).click();
  assert(await page.locator("#panel-result").isVisible(), "Result panel must be visible");
  assert(!(await page.locator("#panel-data").isVisible()), "Inactive panel must be hidden");
  assert(await page.locator("#preview-result").textContent() === 'APP_NAME="my-friend-ai"\nAPP_ENV="development"', "Result must use the selected values");
  await page.getByRole("tab", { name: "3. 결과" }).press("ArrowLeft");
  assert(await page.locator("#tab-template").getAttribute("aria-selected") === "true", "Arrow keys must switch tabs");
  await page.locator("#tab-template").press("Home");
  assert(await page.locator("#tab-data").evaluate(element => element === document.activeElement), "Home must focus the first tab");
  await page.locator("#tab-data").press("End");
  assert(await page.locator("#tab-result").getAttribute("aria-selected") === "true", "End must select the last tab");

  const hostileName = '<img src=x onerror="alert(1)">';
  await page.locator("#app-name").fill(hostileName);
  assert(await page.locator("#preview-result img").count() === 0, "Input must remain text");
  assert((await page.locator("#preview-result").textContent()).includes(JSON.stringify(hostileName)), "Quotes must be escaped");
  await page.locator("#app-name").fill("");
  assert((await page.locator("#preview-result").textContent()).includes('APP_NAME="friend-ai"'), "Empty name must have a useful default");

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async text => { window.__copiedPrompt = text; } }
    });
  });
  await page.locator("#copy-prompt").click();
  await page.waitForFunction(() => document.querySelector("#copy-status").textContent.includes("복사했어요"));
  assert(await page.evaluate(() => window.__copiedPrompt === document.querySelector("#ai-prompt").textContent), "Copy must preserve the prompt");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => { throw new Error("Permission denied"); } }
    });
  });
  await page.locator("#copy-prompt").click();
  await page.waitForFunction(() => document.querySelector("#copy-status").textContent.includes("Ctrl+C"));
  assert(await page.evaluate(() => window.getSelection().toString() === document.querySelector("#ai-prompt").textContent), "Denied clipboard must select the prompt for manual copy");

  await page.getByRole("link", { name: "Git 동기화", exact: true }).click();
  assert(await page.locator("#sync-title").isVisible(), "Git navigation must reach the sync section");
  assert(await page.locator(".sync-route li").count() === 3, "Sync must explain A, GitHub, and B");
  await page.locator("#sync details summary").last().click();
  assert(await page.locator("[data-source-block='13']").isVisible(), "Automation settings must expand");

  const firstSummary = page.locator("#practice details summary").first();
  await firstSummary.click();
  assert(await page.locator("#practice details").first().getAttribute("open") !== null, "Practice section must expand");
  assert(await page.evaluate(() => {
    const before = [...document.querySelectorAll("details")].map(detail => detail.open);
    window.dispatchEvent(new Event("beforeprint"));
    const allOpen = [...document.querySelectorAll("details")].every(detail => detail.open);
    window.dispatchEvent(new Event("afterprint"));
    const after = [...document.querySelectorAll("details")].map(detail => detail.open);
    return allOpen && JSON.stringify(before) === JSON.stringify(after);
  }), "Printing must expose every step and restore the previous state");

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal page overflow at ${width}px`);
  }
  const offline = await page.context().newPage();
  const cdp = await offline.context().newCDPSession(offline);
  await cdp.send("Emulation.setScriptExecutionDisabled", { value: true });
  await offline.goto(page.url());
  assert(await offline.locator("noscript").innerText() !== "", "No-script readers must receive guidance");
  await offline.locator("#practice details summary").first().click();
  assert(await offline.locator("[data-source-block='0']").isVisible(), "Practice must work without JavaScript");
  await offline.close();

  assert(errors.length === 0, `Browser errors: ${errors.join(", ")}`);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });
  return { passed: true, checked: ["live preview", "keyboard tabs", "input escaping", "clipboard success and denial", "Git sync section", "practice disclosure", "print", "responsive widths", "no JavaScript"] };
}
