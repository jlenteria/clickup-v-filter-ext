# ClickUp View Filter

Hide selected messages in your own ClickUp browser view. Messages stay hidden after reloading. Other people still see them, and no ClickUp data is changed.

## Install

**Chrome, Edge, or Brave:** Open the browser's extensions page, enable **Developer mode**, click **Load unpacked**, and select this project folder.

**Safari on macOS:** From this project folder, run:

```sh
zsh scripts/update-safari.sh
```

Requires Xcode and the project's Apple Development signing certificate. The script builds and installs the Safari app. Quit and reopen Safari, then enable **ClickUp View Filter** in **Settings → Extensions** and allow access to `app.clickup.com`.

## Use

1. Open a ClickUp chat.
2. Press **Command + Shift + Y** on Mac or **Ctrl + Shift + Y** on Windows/Linux to show **Hide** buttons.
3. Click **Hide** on any message.
4. Press the shortcut again or **Escape** to dismiss the buttons.

Use the extension popup to show hidden messages, pause filtering, restore all messages, or limit filtering to a channel.

Version: **0.0.1**
