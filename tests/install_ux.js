"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "..", "install.js"), "utf8");

function makeContext({ userAgent, platform = "", maxTouchPoints = 0, standalone = false } = {}) {
  const elements = new Map();
  const windowListeners = new Map();
  const mediaListeners = [];
  function element() {
    const listeners = new Map();
    return {
      hidden: true, disabled: false, open: false, textContent: "",
      setAttribute(name, value) { this[name] = value; },
      removeAttribute(name) { delete this[name]; },
      showModal() { this.open = true; },
      close() { this.open = false; },
      addEventListener(name, callback) { listeners.set(name, callback); },
      async click() { await listeners.get("click")?.({ target: this }); }
    };
  }
  const installButton = element();
  const iosDialog = element();
  const closeButton = element();
  elements.set("installButton", installButton);
  elements.set("iosInstallDialog", iosDialog);
  elements.set("closeInstallDialog", closeButton);
  const matchMedia = () => ({ matches: standalone, addEventListener(name, callback) { mediaListeners.push(callback); } });
  const window = {
    navigator: { userAgent, platform, maxTouchPoints, standalone },
    matchMedia,
    addEventListener(name, callback) { windowListeners.set(name, callback); }
  };
  const context = { window, document: { getElementById(id) { return elements.get(id) || null; } } };
  vm.createContext(context);
  vm.runInContext(script, context);
  return {
    installButton, iosDialog, closeButton,
    dispatch(name, event) { return windowListeners.get(name)?.(event); },
    mediaListeners
  };
}

(async () => {
  const android = makeContext({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel Tablet) Chrome/140 Mobile Safari/537.36" });
  assert.equal(android.installButton.hidden, true, "Android must not show an unavailable install control");
  let promptCalled = false;
  let prevented = false;
  const promptEvent = {
    preventDefault() { prevented = true; },
    async prompt() { promptCalled = true; },
    userChoice: Promise.resolve({ outcome: "accepted" })
  };
  android.dispatch("beforeinstallprompt", promptEvent);
  assert.equal(prevented, true);
  assert.equal(android.installButton.hidden, false);
  await android.installButton.click();
  assert.equal(promptCalled, true, "native prompt must require an explicit click");
  assert.equal(android.installButton.hidden, true, "consumed Android prompt must not remain visible");

  const desktop = makeContext({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/140 Safari/537.36", platform: "MacIntel" });
  let desktopPrevented = false;
  desktop.dispatch("beforeinstallprompt", { preventDefault() { desktopPrevented = true; } });
  assert.equal(desktop.installButton.hidden, true, "desktop must not gain the custom install control");
  assert.equal(desktopPrevented, false, "desktop native behavior must not be intercepted");

  const iphone = makeContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" });
  assert.equal(iphone.installButton.hidden, false);
  await iphone.installButton.click();
  assert.equal(iphone.iosDialog.open, true, "iPhone must receive instructions instead of a native prompt attempt");
  await iphone.closeButton.click();
  assert.equal(iphone.iosDialog.open, false, "iPhone instructions must be dismissible");

  const ipad = makeContext({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 5 });
  assert.equal(ipad.installButton.hidden, false, "desktop-like iPadOS must still be treated as a tablet target");

  const standalone = makeContext({ userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile Safari/537.36", standalone: true });
  assert.equal(standalone.installButton.hidden, true, "standalone mode must hide installation");
  standalone.dispatch("appinstalled", {});
  assert.equal(standalone.installButton.hidden, true);

  console.log("Install UX checks passed: Android prompt gating, iOS/iPad instructions, standalone hiding, desktop safety, and dismissal.");
})().catch(error => { console.error(error); process.exitCode = 1; });
