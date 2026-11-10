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

  await page.getByRole("link", { name: "전체 지도", exact: true }).click();
  assert(await page.locator("#overview-title").isVisible(), "The main navigation must reach the overview");
  assert(await page.locator("#overview [data-overview-node]").count() === 8, "The overview must include sharing and local assembly stages");
  assert(await page.locator(".share-map [data-overview-node='pass']").count() === 0, "The vault must remain outside the Git sharing path");
  assert(await page.locator(".local-map [data-overview-node='pass']").isVisible(), "The local assembly path must show the vault");
  assert(await page.locator(".overview-legend").innerText().then(text => text.includes("초록 실선") && text.includes("주황 점선")), "Path meanings must be labeled beyond color");
  const iconVisible = await page.locator("[data-overview-node='computer-a'] use").first().evaluate(element => {
    const box = element.getBBox();
    return box.width > 0 && box.height > 0;
  });
  assert(iconVisible, "Inline vector illustrations must render");

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

  await page.getByRole("link", { name: "내 상황에 맞는 네 가지 실전 모식도 보기 ↓", exact: true }).click();
  const caseTabs = page.locator("[data-case-tab]");
  const casePanels = page.locator(".case-panel");
  assert(await caseTabs.count() === 4, "Four practical cases must be available");
  for (let index = 0; index < 4; index++) {
    await caseTabs.nth(index).click();
    assert(await casePanels.nth(index).isVisible(), `Case ${index + 1} must open`);
    assert(await page.locator(".case-panel:visible").count() === 1, "Only the selected case should appear");
    assert(await casePanels.nth(index).locator("figure .diagram-node").count() >= 3, "Each case must contain a workflow diagram");
    assert(await casePanels.nth(index).locator(".case-action pre:visible").count() >= 1, "Each case must provide actual commands");
  }
  await caseTabs.last().press("ArrowRight");
  assert(await caseTabs.first().getAttribute("aria-selected") === "true", "Case tabs must wrap with arrow keys");
  await caseTabs.first().press("End");
  assert(await caseTabs.last().evaluate(element => element === document.activeElement), "End must focus the last case");
  assert(await page.locator("#tab-result").getAttribute("aria-selected") === "true", "Case tabs must not change the separate live preview");
  await page.emulateMedia({ media: "print" });
  assert(await page.locator(".overview-map").isVisible(), "The overall diagram must be printable");
  assert(await page.locator(".case-panel:visible").count() === 4, "All cases must be printable");
  await page.emulateMedia({ media: "screen" });
  assert(await page.locator(".case-panel:visible").count() === 1, "Printing must preserve the case selection");

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
    assert(await page.locator(".overview-map").evaluate(element => element.scrollWidth <= element.clientWidth), `Overview must fit at ${width}px`);
    for (let index = 0; index < 4; index++) {
      await caseTabs.nth(index).click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow in case ${index + 1} at ${width}px`);
    }
  }
  const offline = await page.context().newPage();
  const cdp = await offline.context().newCDPSession(offline);
  await cdp.send("Emulation.setScriptExecutionDisabled", { value: true });
  await offline.goto(page.url());
  assert(await offline.locator("noscript").innerText() !== "", "No-script readers must receive guidance");
  await offline.locator("#practice details summary").first().click();
  assert(await offline.locator("[data-source-block='0']").isVisible(), "Practice must work without JavaScript");
  assert(await offline.locator(".case-panel:visible").count() === 4, "All cases must be readable without JavaScript");
  assert(await offline.locator("#overview .local-map").isVisible(), "The overview must work without JavaScript");
  await offline.close();

  assert(errors.length === 0, `Browser errors: ${errors.join(", ")}`);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });
  return { passed: true, checked: ["overall illustrated map", "local secret path", "vector icons", "live preview", "keyboard tabs", "input escaping", "clipboard success and denial", "Git sync section", "four case diagrams and workflows", "independent case tabs", "practice disclosure", "print", "responsive widths", "no JavaScript"] };
}
