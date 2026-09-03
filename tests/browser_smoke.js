"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const filename = path.resolve(root, relative);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || fs.statSync(filename).isDirectory()) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": mime[path.extname(filename)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(filename).pipe(response);
});

function listen() {
  return new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
}

async function setFilters(page, values) {
  if (await page.locator("#filterBody").isHidden()) await page.click("#toggleFiltersButton");
  if (values.tense) await page.selectOption("#tenseSelect", values.tense);
  if (values.regularity) await page.selectOption("#regularitySelect", values.regularity);
  if (values.ending) await page.selectOption("#endingSelect", values.ending);
  if (values.pronominal) await page.selectOption("#pronominalSelect", values.pronominal);
  if (values.pattern) await page.selectOption("#patternSelect", values.pattern);
}

async function countMatches(page) {
  return Number((await page.locator("#matchCount").innerText()).match(/^\d+/)[0]);
}

async function findVerb(page, verb) {
  const total = Number((await page.locator("#progress").innerText()).match(/\/\s*(\d+)/)[1]);
  for (let index = 0; index < total; index += 1) {
    if ((await page.locator(".front-verb").innerText()) === verb) return;
    await page.click("#nextButton");
  }
  throw new Error(`Could not find ${verb} in the current session`);
}

async function readProgress(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("mexican-spanish-flashcards-db", 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const getAll = database.transaction("cardProgress").objectStore("cardProgress").getAll();
      getAll.onerror = () => reject(getAll.error);
      getAll.onsuccess = () => resolve(getAll.result);
    };
  }));
}

(async () => {
  await listen();
  let browser;

  try {
    try {
      browser = await chromium.launch({ headless: true });
    } catch (error) {
      if (/Executable doesn't exist/.test(String(error))) {
        console.log("Browser smoke checks skipped: Playwright Chromium is not installed.");
        return;
      }
      throw error;
    }
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const baseUrl = `http://127.0.0.1:${server.address().port}/`;
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForSelector("#startButton:not([disabled])");
    assert.deepEqual(
      await page.locator("#regularitySelect option").evaluateAll(options => options.map(option => [option.value, option.textContent])),
      [["all", "Todos"], ["regular", "Regulares"], ["irregular", "Irregulares"]]
    );
    assert.deepEqual(
      await page.locator("#tenseSelect option").evaluateAll(options => options.map(option => [option.value, option.textContent])),
      [
        ["presente_indicativo", "Presente"], ["preterito", "Pretérito"], ["imperfecto", "Imperfecto"],
        ["futuro", "Futuro"], ["condicional", "Condicional"], ["presente_subjuntivo", "Presente de subjuntivo"],
        ["imperfecto_subjuntivo", "Imperfecto de subjuntivo"], ["imperativo", "Imperativo"]
      ]
    );
    assert.equal(await page.locator("#rankSelect").count(), 0);

    await page.evaluate(() => localStorage.setItem("conjuflow-filters-v1", JSON.stringify({
      tense: "preterito", regularity: "irregular", ending: "all", pattern: "cambio ortográfico", pronominal: "all", rank: "50"
    })));
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator("#regularitySelect").inputValue(), "irregular");
    assert.equal(await page.locator("#patternSelect").inputValue(), "cambio ortográfico");

    const populatedCases = [
      ["Presente + Irregulares", { tense: "presente_indicativo", regularity: "irregular", ending: "all", pattern: "all", pronominal: "all" }],
      ["Presente + e→ie", { tense: "presente_indicativo", regularity: "all", pattern: "e→ie" }],
      ["Pretérito + Irregulares", { tense: "preterito", regularity: "irregular", pattern: "all" }],
      ["Pretérito + cambio ortográfico", { tense: "preterito", regularity: "all", pattern: "cambio ortográfico" }],
      ["Futuro + Irregulares", { tense: "futuro", regularity: "irregular", pattern: "all" }],
      ["Presente + yo→-zco", { tense: "presente_indicativo", regularity: "all", pattern: "yo→-zco" }],
      ["Imperativo + Pronominales", { tense: "imperativo", pattern: "all", pronominal: "sí" }],
      ["Solo -IR", { tense: "presente_indicativo", ending: "ir", pattern: "all", pronominal: "all" }]
    ];
    for (const [name, filters] of populatedCases) {
      await setFilters(page, filters);
      assert.ok(await countMatches(page), `${name} should have matches`);
    }

    await setFilters(page, { tense: "presente_indicativo", regularity: "irregular", ending: "ir", pattern: "all", pronominal: "all" });
    let patternValues = await page.locator("#patternSelect option").evaluateAll(options => options.map(option => option.value));
    assert.ok(patternValues.includes("e→i"));
    await page.selectOption("#patternSelect", "e→i");
    await page.click("#startButton");
    await findVerb(page, "pedir");

    await setFilters(page, { ending: "ar" });
    assert.equal(await page.locator("#patternSelect").inputValue(), "all");
    patternValues = await page.locator("#patternSelect option").evaluateAll(options => options.map(option => option.value));
    assert.equal(patternValues.includes("e→i"), false);

    await setFilters(page, { regularity: "regular" });
    assert.equal(await page.locator("#patternSelect").isDisabled(), false);
    assert.deepEqual(
      await page.locator("#patternSelect option").evaluateAll(options => options.map(option => option.value)),
      ["all", "regular"]
    );

    await setFilters(page, { tense: "preterito", regularity: "all", ending: "all", pattern: "i→y", pronominal: "all" });
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator("#tenseSelect").inputValue(), "preterito");
    assert.equal(await page.locator("#patternSelect").inputValue(), "i→y");
    await page.click("#startButton");
    await findVerb(page, "leer");

    await setFilters(page, { tense: "preterito", regularity: "irregular", ending: "all", pattern: "all", pronominal: "all" });
    patternValues = await page.locator("#patternSelect option").evaluateAll(options => options.map(option => option.value));
    assert.ok(patternValues.includes("cambio ortográfico"));

    await setFilters(page, { tense: "condicional", regularity: "irregular", ending: "ar", pattern: "all", pronominal: "no" });
    assert.equal(await countMatches(page), 0);
    assert.equal(await page.locator("#patternSelect").isDisabled(), true);
    await page.click("#startButton");
    assert.equal(await page.locator("#emptyTitle").innerText(), "No verbs match these filters.");

    await setFilters(page, { tense: "imperativo", regularity: "all", ending: "all", pattern: "all", pronominal: "sí" });
    await page.click("#startButton");
    await page.click("#card");
    const pronouns = await page.locator(".pronoun").allInnerTexts();
    assert.deepEqual(pronouns, ["tú", "usted", "nosotros", "ustedes"]);
    assert.ok((await page.locator(".conjugation").allInnerTexts()).every(form => form.includes(" / ")));

    await setFilters(page, { tense: "presente_indicativo", regularity: "irregular", ending: "all", pattern: "muy irregular", pronominal: "all" });
    await page.click("#startButton");
    await findVerb(page, "tener");
    await page.click("#card");
    await page.click(".grade.good");
    await page.waitForTimeout(50);
    let stored = await readProgress(page);
    assert.deepEqual(stored.map(record => record.cardId), ["tener__presente_indicativo"]);
    const presentSnapshot = JSON.stringify(stored[0].fsrs);

    await setFilters(page, { tense: "preterito", regularity: "irregular", pattern: "muy irregular" });
    await page.click("#startButton");
    await findVerb(page, "tener");
    await page.click("#card");
    await page.click(".grade.easy");
    await page.waitForTimeout(50);
    stored = await readProgress(page);
    assert.deepEqual(stored.map(record => record.cardId).sort(), ["tener__presente_indicativo", "tener__preterito"]);
    assert.equal(JSON.stringify(stored.find(record => record.cardId === "tener__presente_indicativo").fsrs), presentSnapshot);

    await setFilters(page, { tense: "presente_indicativo", regularity: "irregular", pattern: "all" });
    await page.click("#startButton");
    stored = await readProgress(page);
    assert.equal(JSON.stringify(stored.find(record => record.cardId === "tener__presente_indicativo").fsrs), presentSnapshot);

    await setFilters(page, { tense: "condicional", regularity: "all", ending: "ir", pattern: "raíz irregular", pronominal: "sí" });
    assert.equal(await countMatches(page), 1);
    await page.click("#startButton");
    assert.equal(await page.locator(".front-verb").innerText(), "salirse");
    await page.click("#card");
    await page.click(".grade.good");
    await page.waitForSelector("#emptyTitle");
    assert.equal(await page.locator("#emptyTitle").innerText(), "You're caught up.");
    assert.match(await page.locator("#emptyMessage").innerText(), /^Next review:/);

    assert.deepEqual(errors, []);
    console.log("Browser smoke checks passed, including FSRS identity and caught-up state.");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
