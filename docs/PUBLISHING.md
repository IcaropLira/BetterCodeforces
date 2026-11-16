# Publishing to the Chrome Web Store and Firefox Add-ons (AMO)

Checklist and step-by-step. Texts to paste live in [STORE_LISTING.md](STORE_LISTING.md). Sources checked on 2026-10-17: [Chrome Web Store docs](https://developer.chrome.com/docs/webstore), [Extension Workshop](https://extensionworkshop.com/documentation/publish/).

## 0. Before you start

- [ ] Push the repo to GitHub and replace every `YOUR_USER` (README, PRIVACY, docs, `package.json`) with your user. The privacy policy URL must work, so the repo must be public (or host the policy elsewhere).
- [ ] **Decide the name.** See the note at the top of [STORE_LISTING.md](STORE_LISTING.md): "Hiraku **for** Codeforces" is safer than "Hiraku Codeforces" because both stores reject products that imply endorsement by another organization.
- [ ] Pick your **Firefox add-on ID** (an email-like string, unique, permanent): `GECKO_ID=hiraku-codeforces@yourname.dev npm run build`. You can't change it after the first upload.
- [ ] **Real screenshots.** The files in `store/` are generated (promo tiles + the extension's own popup). Take 3–5 real screenshots **inside Codeforces** at **1280×800** (DevTools → device toolbar → 1280×800 → capture screenshot): a dark problem page, a translated statement with formulas, the profile or standings page, the light theme. Put them in `store/screenshots/`.
- [ ] `npm run check` passes (unit tests, build, `web-ext lint`) and `npm run test:e2e` passes.
- [ ] Manually test the build in both browsers (below).

### Test the build manually
- **Chrome:** `chrome://extensions` → Developer mode → *Load unpacked* → `dist/chrome`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → `dist/firefox/manifest.json`. If styles don't appear, grant site access in `about:addons` → the extension → *Permissions*.

## 1. Chrome Web Store

1. Register at the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) with a Google account: accept the agreement and pay the **one-time registration fee** (confirm the current amount there). The developer email can't be changed later, so use one you'll keep.
2. `npm run build` → upload `dist/hiraku-codeforces-<version>-chrome.zip` (*Add new item*).
3. **Store listing:** paste the description; category (e.g. *Developer Tools* or *Productivity*); language; icon is taken from the package (128×128); screenshots (at least one, 1280×800, max 5); **small promo tile 440×280** (`store/promo-small-440x280.png`); marquee 1400×560 is optional (`store/promo-marquee-1400x560.png`). The docs also list a promo video link; the dashboard marks what is mandatory for you.
4. **Privacy practices:** single purpose, permission justifications, remote code = *No*, data usage disclosures and certifications, privacy policy URL — all in [STORE_LISTING.md](STORE_LISTING.md).
5. **Distribution:** public, or *unlisted* if you want to share the link only. Choose regions.
6. *Submit for review.* Review can take from hours to a few days; extensions with host permissions can be reviewed in more depth. Answer any reviewer email promptly.

The same Chrome zip works for **Microsoft Edge Add-ons** (free): <https://partner.microsoft.com/dashboard/microsoftedge>.

## 2. Firefox Add-ons (AMO)

1. Create an account at [addons.mozilla.org/developers](https://addons.mozilla.org/developers/) (free).
2. Build with your ID: `GECKO_ID=your-id@yourdomain npm run build` → `dist/hiraku-codeforces-<version>-firefox.zip`.
3. *Submit a New Add-on* → choose **On this site** (listed on AMO) or **On your own** (signed `.xpi` for self-distribution, no listing).
4. Upload the zip. The validator should show no errors (we run the same linter in CI). `manifest.json` already declares `data_collection_permissions` (`websiteContent`, required) as new extensions must.
5. Source code: nothing is minified or bundled, so none is strictly required. To be safe, attach `npm run package:source` output and paste the *Notes to reviewer* from [STORE_LISTING.md](STORE_LISTING.md).
6. Fill the listing (summary, description, categories, screenshots, privacy policy URL, license **MIT**) and submit. New listed add-ons go through automatic checks and may get a manual review.

## 3. Releasing updates (automatic)

After the **first** manual submission to each store (sections 1 and 2), every update is one command:

```bash
# 1. write what changed under "## Unreleased" in CHANGELOG.md
# 2. then:
npm run release -- patch --push      # or: minor | major | 1.2.3
```

The script checks that the git tree is clean, moves `## Unreleased` to the new version, bumps `package.json`, `package-lock.json` and `manifest.base.json`, runs `npm run check`, commits, tags `vX.Y.Z` and pushes. Pushing the tag starts the **Release** workflow (`.github/workflows/release.yml`), which:

1. runs the tests and builds `hiraku-codeforces-<version>-chrome.zip` and `…-firefox.zip` (plus the source zip);
2. creates the **GitHub Release** with the CHANGELOG notes and the zips attached;
3. uploads the Chrome zip to the **Chrome Web Store** and submits the Firefox build to **addons.mozilla.org**, if the secrets below exist. Without them each store job is skipped and the zips are still on the GitHub Release, so you can upload by hand.

`npm run release -- patch --no-git` only updates the files and builds the zips in `dist/` (no commit, no tag).

### One-time setup of the store secrets

Repository → *Settings → Secrets and variables → Actions*.

**Chrome Web Store** (secrets `CWS_EXTENSION_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`):
- `CWS_EXTENSION_ID`: the item ID shown in the Developer Dashboard.
- The other three come from a Google Cloud OAuth client with the *Chrome Web Store API* enabled; follow the [chrome-webstore-upload-cli guide](https://github.com/fregante/chrome-webstore-upload-keys) to generate the refresh token.

**Firefox Add-ons**:
- secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`: [addons.mozilla.org → Tools → Manage API Keys](https://addons.mozilla.org/developers/addon/api/key/).
- *variable* (not secret) `GECKO_ID`: the add-on ID you chose in section 0. It must be identical on every release.
- The very first AMO submission has to be done by hand (section 2) so the listing exists; later versions are submitted by the workflow and then wait for Mozilla's review.

Store reviews still take time: the workflow only *submits*; the new version goes live when the store approves it.

## 4. Things that commonly get extensions rejected

- Name or icon that suggests the product is official (we use an original icon and an "unofficial" disclaimer).
- Permissions you don't justify. Keep the list short; every host permission here has a reason in `STORE_LISTING.md`.
- A privacy policy URL that doesn't load, or disclosures that don't match what the code does. If you add analytics, remote code or new hosts, update the policy, the listing disclosures and the manifest together.
- Screenshots that don't show the actual product.
