# ClickUp View Filter

Hide individual messages in your own ClickUp browser view, including the message's profile photo, name, and timestamp. Nothing is deleted or changed on ClickUp, and other people still see the messages.

## Use

1. Open a ClickUp chat.
2. Press **Command + Shift + Y** on Mac, or **Ctrl + Shift + Y** on Windows/Linux, to show message **Hide** buttons. You can also open the toolbar popup and click **Show Hide buttons**.
3. Click **Hide** on the messages you want hidden.
4. Press the shortcut again, or press **Escape**, to remove the buttons. Buttons start off when a page loads; hidden messages remain hidden across reloads.

The toolbar popup also provides:

- **Hide selected messages**: pause or resume filtering. Pausing restores the messages without forgetting your selections.
- **Show hidden messages**: temporarily reveal your saved selections. Click **Hide messages again** to reapply them.
- **Restore all messages**: permanently clear your saved selections across channels.
- **Channel settings**: optionally restrict filtering to URLs containing a channel fragment; blank applies in all channels. Changes save automatically.
- **Refresh**: check the current tab's connection and hidden-message count.

Version 0.6.0 removes text filters and Debug outline. Existing manual selections are preserved; old text rules and debug settings no longer apply. Shared author headers stay visible when a group still contains other messages.

## Install in Chrome, Edge, or Brave

Open the browser's extensions page, enable Developer mode, choose **Load unpacked**, and select this project folder. After source changes, reload the extension and reload ClickUp.

## Install or update Safari on macOS

Run in Terminal:

```sh
zsh /Users/jlenteria/Project/clickup-view-filter/scripts/update-safari.sh
```

The updater syncs the extension resources into the Xcode wrapper, builds and verifies a signed app, backs up an existing installation to its temporary build directory, and installs the new app into `/Applications`. Building requires access to the Apple Development signing certificate for team `M27R8BVH5X`.

Quit Safari completely with **Command-Q**, reopen it, and reload ClickUp. In Safari Settings → Extensions, enable ClickUp View Filter and allow access to `app.clickup.com`. The popup displays the installed version, **0.6.0**.

Editing source files alone does not update Safari. Its copied resources are in `ClickUp View Filter/ClickUp View Filter Extension/Resources/`.

## Verify changes

```sh
node --check content.js
node --check popup/popup.js
node --test tests/background.test.cjs
zsh -n scripts/update-safari.sh
```

Open `tests/content.html` in a browser to run the real content script against mocked extension storage and chat fixtures. It should end with `ALL TESTS PASSED`. It checks button visibility, command toggles, Escape, manual persistence, whole-row hiding, reveal/restore, channel scope, dynamic messages, and legacy-setting removal. It does not connect to ClickUp.

ClickUp UI changes can require selector updates. Text-based fallback identities may treat identical messages within one channel as the same message when ClickUp exposes no stable message ID.
