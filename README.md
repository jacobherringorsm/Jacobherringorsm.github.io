# Neon Client UI Prototype

An original, standalone UI concept for a custom Eaglercraft 26.2 client. This prototype explores a dark neon visual theme, menu navigation, and a few client-side quality-of-life preferences.

## Run locally

Serve this directory with:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Public launcher URL

The public launcher is published at <https://jacobherringorsm.github.io/> from the account-level Pages repository.

## Built-in game and launch

The public Pages deployment includes the authorized standalone Eaglercraft 26.2 HTML build, so the built-in client launches without selecting a file. The game file is hosted publicly and downloads when a player launches it. The launcher can also use an optional local HTML or ZIP client saved in the browser's IndexedDB. This source repository intentionally omits the large client artifact.

The ClickGUI opens with **Right Shift** by default; opening it releases pointer lock so the mouse can operate its controls, and closing it returns keyboard focus to the game. Appearance includes Cyan, Violet, Amber, Lime, Rose, Ice, and a named custom accent theme. The overlay also supports a configurable crosshair, live keystrokes HUD, browser-FPS estimate, and left/right CPS counter; HUD widgets can be dragged and their positions are saved locally. Features that require internal game state, network data, or renderer hooks are listed as unavailable in the ClickGUI rather than shown as working toggles.

## Scope

This project contains original launcher and overlay code. The separately supplied client artifact is included in the public Pages deployment with the user's authorization; it is not included in this source repository. Gameplay features require a documented add-on interface and client source you are authorized to modify.
