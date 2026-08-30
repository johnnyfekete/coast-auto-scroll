<p align="center">
  <img src="public/icon/128.png" width="88" height="88" alt="">
</p>

<h1 align="center">Coast</h1>

<p align="center"><strong>Auto scroll for reading. Installs with no permissions.</strong></p>

---

Coast scrolls the page for you, at a speed you set, so you can read a long
article, a recipe, or a guitar tab without a hand on the wheel.

## It asks for nothing to install

Every other auto-scroll extension declares a content script over the whole web,
so Chrome warns you at install that it can **read and change all your data on
all websites** — for a tool whose entire job is moving a page downwards.

Coast declares no host permissions at all.

- **From the toolbar**, it uses `activeTab`: access to the one tab you clicked
  on, expiring when you navigate away.
- **Pinning a site** asks Chrome for that one site, by name, once. Unpinning
  gives it back.

Open `chrome://extensions` and Coast will say *On specific sites*, listing
exactly the ones you pinned. That claim is checkable, which is most of why this
repository is public.

## What it does

- **Start and stop from the popup**, on any page.
- **Pin the sites you read often** and a small control sits in the corner of
  them — play, speed, and a menu. Drag it anywhere; it stays where you put it.
- **Scroll it yourself and it gets out of the way**, then carries on from where
  you left it. Or set it to stop for good, if that suits you better.
- **It keeps up with infinite feeds** — the bottom moving away is not the end —
  **and it knows when an article is over**, stopping a few seconds after the
  page stops growing.
- **Each pinned site remembers its own speed.** A guitar tab and a news feed
  want speeds an order of magnitude apart.
- **A keyboard shortcut**, with nothing bound to it until you choose a key.

No account, no telemetry, no network requests of any kind. Settings never leave
your machine — not even through Chrome's own sync, because the list of sites
you read is not something Coast should be sending anywhere.

## Build it yourself

```bash
npm install
npm run build
```

Then load `.output/chrome-mv3` at `chrome://extensions` with developer mode on.

```bash
npm test          # unit tests
npm run test:e2e  # end-to-end, against a real headless Chrome
npm run compile   # typecheck
```

## How it is put together

| | |
|---|---|
| `src/scroll/step.ts` | One frame of scrolling, as arithmetic. Pure, and where every decision lives |
| `src/scroll/engine.ts` | The animation loop — the only part that touches a real page |
| `src/scroll/controller.ts` | One crawl per page, shared by the popup and the on-page panel |
| `src/pins/` | Pin patterns, and the permission/registration/record lifecycle |
| `src/panel/` | The on-page control: shadow DOM, never anchored in the site's markup |

Built with [WXT](https://wxt.dev). Chrome and MV3 only.

## Licence

GPL-3.0-or-later. See [LICENSE](LICENSE).
