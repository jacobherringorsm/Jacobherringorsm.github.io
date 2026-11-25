const frame = document.querySelector("#client-frame");
const loadingStatus = document.querySelector("#game-loading");
const clickgui = document.querySelector("#clickgui");
const guiTrigger = document.querySelector("#gui-trigger");
const closeGuiButton = document.querySelector("#close-gui");
const badge = document.querySelector("#game-badge");
const keybindButton = document.querySelector("#keybind-button");
const keybindLabel = document.querySelector("#keybind-label");
const footerKeybind = document.querySelector("#footer-keybind");
const toast = document.querySelector("#game-toast");
const crosshair = document.querySelector("#custom-crosshair");
const crosshairStyle = document.querySelector("#crosshair-style");
const crosshairColor = document.querySelector("#crosshair-color");
const crosshairSize = document.querySelector("#crosshair-size");
const keystrokesWidget = document.querySelector("#keystrokes-widget");
const cpsWidget = document.querySelector("#cps-widget");
const leftCps = document.querySelector("#left-cps");
const rightCps = document.querySelector("#right-cps");
const defaultSettings = {
  accent: "cyan",
  showBadge: true,
  compactGui: false,
  reducedMotion: false,
  showKeystrokes: false,
  showCps: false,
  showCrosshair: false,
  crosshairStyle: "dot",
  crosshairColor: "#55eaff",
  crosshairSize: 5,
  hudPositions: {},
  keybind: "ShiftRight",
};
let settings = { ...defaultSettings };
let waitingForKey = false;
let toastTimer;
let clientObjectUrl;
let leftClickTimes = [];
let rightClickTimes = [];
let dynamicCrosshairTimer;
const pressedKeys = new Set();
const pressedMouseButtons = new Set();
const hudDragStates = new Map();

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

function formatKey(code) {
  const knownKeys = {
    ShiftRight: "RIGHT SHIFT",
    ShiftLeft: "LEFT SHIFT",
    ControlRight: "RIGHT CTRL",
    ControlLeft: "LEFT CTRL",
    AltRight: "RIGHT ALT",
    AltLeft: "LEFT ALT",
    Space: "SPACE",
    Escape: "ESC",
  };
  if (knownKeys[code]) return knownKeys[code];
  return code.replace(/^Key/, "").replace(/^Digit/, "").replace(/([A-Z])/g, " $1").trim().toUpperCase();
}

function applySettings() {
  document.documentElement.dataset.accent = settings.accent;
  document.documentElement.dataset.compactGui = String(settings.compactGui);
  document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
  badge.hidden = !settings.showBadge;
  keybindButton.textContent = formatKey(settings.keybind);
  keybindLabel.textContent = formatKey(settings.keybind);
  footerKeybind.textContent = formatKey(settings.keybind);
  keystrokesWidget.hidden = !settings.showKeystrokes;
  cpsWidget.hidden = !settings.showCps;
  crosshair.hidden = !settings.showCrosshair;
  crosshair.className = `crosshair crosshair-${settings.crosshairStyle}`;
  crosshair.style.setProperty("--crosshair-color", settings.crosshairColor);
  crosshair.style.setProperty("--crosshair-size", `${settings.crosshairSize}px`);
  crosshairStyle.value = settings.crosshairStyle;
  crosshairColor.value = settings.crosshairColor;
  crosshairSize.value = String(settings.crosshairSize);
  applyHudPosition(keystrokesWidget, "keystrokes");
  applyHudPosition(cpsWidget, "cps");
  for (const input of document.querySelectorAll("[data-pref]")) {
    input.checked = Boolean(settings[input.dataset.pref]);
  }
  for (const button of document.querySelectorAll("[data-accent]")) {
    const selected = button.dataset.accent === settings.accent;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

function applyHudPosition(element, name) {
  const position = settings.hudPositions?.[name];
  if (!position || !Number.isFinite(position.left) || !Number.isFinite(position.top)) return;
  element.style.left = `${Math.max(0, Math.min(window.innerWidth - element.offsetWidth, position.left))}px`;
  element.style.top = `${Math.max(0, Math.min(window.innerHeight - element.offsetHeight, position.top))}px`;
  element.style.right = "auto";
  element.style.bottom = "auto";
}

function enableHudDragging(element, name) {
  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const rect = element.getBoundingClientRect();
    hudDragStates.set(name, { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top });
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.right = "auto";
    element.style.bottom = "auto";
    element.classList.add("is-dragging");
    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener("pointermove", (event) => {
    const drag = hudDragStates.get(name);
    if (!drag || drag.pointerId !== event.pointerId) return;
    const left = Math.max(0, Math.min(window.innerWidth - element.offsetWidth, event.clientX - drag.offsetX));
    const top = Math.max(0, Math.min(window.innerHeight - element.offsetHeight, event.clientY - drag.offsetY));
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  });

  const finishDrag = (event) => {
    const drag = hudDragStates.get(name);
    if (!drag || drag.pointerId !== event.pointerId) return;
    hudDragStates.delete(name);
    element.classList.remove("is-dragging");
    settings.hudPositions[name] = {
      left: Number.parseFloat(element.style.left),
      top: Number.parseFloat(element.style.top),
    };
    saveSettings();
  };
  element.addEventListener("pointerup", finishDrag);
  element.addEventListener("pointercancel", finishDrag);
}

enableHudDragging(keystrokesWidget, "keystrokes");
enableHudDragging(cpsWidget, "cps");

async function saveSettings() {
  try {
    await NeonClientStorage.saveSettings(settings);
  } catch (error) {
    console.error("Unable to save ClickGUI settings.", error);
    showToast(error instanceof Error ? error.message : "Unable to save ClickGUI settings.");
  }
}

function setClickguiOpen(open) {
  clickgui.hidden = !open;
  guiTrigger.setAttribute("aria-expanded", String(open));
  if (open) closeGuiButton.focus();
  else guiTrigger.focus();
}

function handleKeydown(event) {
  if (waitingForKey) {
    if (event.code === "Escape") {
      waitingForKey = false;
      keybindButton.textContent = formatKey(settings.keybind);
      return;
    }
    if (!event.code || event.code === "Unidentified") return;
    event.preventDefault();
    event.stopPropagation();
    settings.keybind = event.code;
    waitingForKey = false;
    applySettings();
    saveSettings();
    showToast(`ClickGUI key set to ${formatKey(settings.keybind)}.`);
    return;
  }

  if (event.code === settings.keybind) {
    event.preventDefault();
    event.stopPropagation();
    setClickguiOpen(clickgui.hidden);
  }
}

document.addEventListener("keydown", handleKeydown, true);
function setPressedKey(code, pressed) {
  if (!["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(code)) return;
  if (pressed) pressedKeys.add(code);
  else pressedKeys.delete(code);
  document.querySelector(`[data-key="${code}"]`)?.classList.toggle("is-pressed", pressed);
}

function setPressedMouse(button, pressed) {
  const code = button === 0 ? "MouseLeft" : button === 2 ? "MouseRight" : undefined;
  if (!code) return;
  if (pressed) pressedMouseButtons.add(code);
  else pressedMouseButtons.delete(code);
  document.querySelector(`[data-key="${code}"]`)?.classList.toggle("is-pressed", pressed);
}

function recordClick(button) {
  const now = Date.now();
  if (button === 0) leftClickTimes.push(now);
  else if (button === 2) rightClickTimes.push(now);
  updateCps();
}

function updateCps() {
  const cutoff = Date.now() - 1000;
  leftClickTimes = leftClickTimes.filter((time) => time > cutoff);
  rightClickTimes = rightClickTimes.filter((time) => time > cutoff);
  leftCps.textContent = String(leftClickTimes.length);
  rightCps.textContent = String(rightClickTimes.length);
}

function markCrosshairMovement() {
  if (settings.crosshairStyle !== "dynamic") return;
  crosshair.dataset.moving = "true";
  window.clearTimeout(dynamicCrosshairTimer);
  dynamicCrosshairTimer = window.setTimeout(() => {
    delete crosshair.dataset.moving;
  }, 140);
}

function resetPressedInputs() {
  for (const code of pressedKeys) setPressedKey(code, false);
  for (const code of pressedMouseButtons) {
    const button = code === "MouseLeft" ? 0 : 2;
    setPressedMouse(button, false);
  }
}

function attachGameInputListeners() {
  try {
    const gameWindow = frame.contentWindow;
    const gameDocument = frame.contentDocument;
    if (!gameWindow || !gameDocument) return;

    gameWindow.addEventListener("keydown", (event) => {
      handleKeydown(event);
      setPressedKey(event.code, true);
      markCrosshairMovement();
    }, true);
    gameWindow.addEventListener("keyup", (event) => setPressedKey(event.code, false), true);
    gameWindow.addEventListener("blur", resetPressedInputs);
    gameDocument.addEventListener("pointerdown", (event) => {
      setPressedMouse(event.button, true);
      recordClick(event.button);
    }, true);
    gameDocument.addEventListener("pointerup", (event) => setPressedMouse(event.button, false), true);
    gameDocument.addEventListener("pointercancel", resetPressedInputs, true);
    gameDocument.addEventListener("mousemove", markCrosshairMovement, { passive: true });
  } catch (error) {
    console.warn("Game input overlays could not attach to the client frame.", error);
  }
}

frame.addEventListener("load", attachGameInputListeners);
window.setInterval(updateCps, 100);

guiTrigger.addEventListener("click", () => setClickguiOpen(clickgui.hidden));
closeGuiButton.addEventListener("click", () => setClickguiOpen(false));
clickgui.addEventListener("click", (event) => {
  if (event.target === clickgui) setClickguiOpen(false);
});

for (const item of document.querySelectorAll("[data-screen]")) {
  item.addEventListener("click", () => {
    const screenName = item.dataset.screen;
    for (const button of document.querySelectorAll("[data-screen]")) {
      const active = button.dataset.screen === screenName;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    for (const screen of document.querySelectorAll("[data-screen-panel]")) {
      const active = screen.dataset.screenPanel === screenName;
      screen.hidden = !active;
      screen.classList.toggle("is-active", active);
    }
    document.querySelector("#gui-title").textContent = screenName === "interface" ? "Interface" : "Appearance";
  });
}

for (const input of document.querySelectorAll("[data-pref]")) {
  input.addEventListener("change", () => {
    settings[input.dataset.pref] = input.checked;
    applySettings();
    saveSettings();
  });
}

crosshairStyle.addEventListener("change", () => {
  settings.crosshairStyle = crosshairStyle.value;
  applySettings();
  saveSettings();
});

crosshairColor.addEventListener("input", () => {
  settings.crosshairColor = crosshairColor.value;
  applySettings();
});
crosshairColor.addEventListener("change", saveSettings);

crosshairSize.addEventListener("input", () => {
  settings.crosshairSize = Number(crosshairSize.value);
  applySettings();
});
crosshairSize.addEventListener("change", saveSettings);

for (const button of document.querySelectorAll("[data-accent]")) {
  button.addEventListener("click", () => {
    settings.accent = button.dataset.accent;
    applySettings();
    saveSettings();
  });
}

keybindButton.addEventListener("click", () => {
  waitingForKey = true;
  keybindButton.textContent = "PRESS A KEY…";
  keybindButton.focus();
});

async function startGame() {
  try {
    const [client, savedSettings] = await Promise.all([
      NeonClientStorage.getClient(),
      NeonClientStorage.getSettings(),
    ]);

    settings = { ...defaultSettings, ...(savedSettings ?? {}) };
    if (!["cyan", "violet", "amber"].includes(settings.accent)) settings.accent = defaultSettings.accent;
    if (typeof settings.keybind !== "string" || !settings.keybind) settings.keybind = defaultSettings.keybind;
    if (!["dot", "circle", "dynamic", "t"].includes(settings.crosshairStyle)) settings.crosshairStyle = defaultSettings.crosshairStyle;
    if (!/^#[0-9a-f]{6}$/i.test(settings.crosshairColor)) settings.crosshairColor = defaultSettings.crosshairColor;
    if (!Number.isFinite(Number(settings.crosshairSize))) settings.crosshairSize = defaultSettings.crosshairSize;
    settings.crosshairSize = Math.min(12, Math.max(3, Number(settings.crosshairSize)));
    if (!settings.hudPositions || typeof settings.hudPositions !== "object") settings.hudPositions = {};
    applySettings();
    if (client?.blob instanceof Blob) {
      clientObjectUrl = URL.createObjectURL(client.blob);
      frame.src = clientObjectUrl;
    } else {
      frame.src = "./eaglercraft-26.2.html";
    }
    frame.hidden = false;
    loadingStatus.hidden = true;
  } catch (error) {
    console.error("Unable to load the installed client.", error);
    settings = { ...defaultSettings };
    applySettings();
    frame.src = "./eaglercraft-26.2.html";
    frame.hidden = false;
    loadingStatus.hidden = true;
  }
}

window.addEventListener("pagehide", () => {
  if (clientObjectUrl) URL.revokeObjectURL(clientObjectUrl);
});

startGame();
