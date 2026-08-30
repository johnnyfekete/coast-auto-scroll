# Coast — Auto Scroll for Reading

Scrolls the page for you, at a speed you set.

**Coast installs with no permissions.** No "read and change all your data on all
websites" at install, because it declares no host permissions at all. The popup
reaches the page you are on through `activeTab` — granted by your click,
expiring on the next navigation. Pinning a site asks Chrome for that one site,
and unpinning gives it back.

Work in progress.

## Build

```bash
npm install
npm run build
```

Load `.output/chrome-mv3` as an unpacked extension.

## Licence

GPL-3.0-or-later. See [LICENSE](LICENSE).
