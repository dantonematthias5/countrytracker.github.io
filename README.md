# Expedition Journal

A personal travel tracker: Country → Province/Region → City → Place, each with notes and photos. Runs entirely in the browser, no backend, no build step.

## Files

- `index.html` — page structure
- `style.css` — dark "expedition journal" look (Cormorant Garamond + DM Sans)
- `script.js` — all the logic (navigation, notes, photos, curtain menu, world map, backup)
- `geo-data.js` — countries, regions and major cities used to populate the "Browse list" curtain
- `world-map.svg` — the world map graphic itself (see Credits below)

## Publish it on GitHub Pages

1. Create a new repository on GitHub (e.g. `travel-tracker`).
2. Push these three files to the repository root:
   ```
   git init
   git add index.html style.css script.js README.md
   git commit -m "First version of the expedition journal"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
3. On GitHub, go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`.
5. Save. After a minute the site is live at:
   `https://<your-username>.github.io/<repo-name>/`

## How data is stored

Everything (countries, provinces, cities, places, notes, photos) is saved in the browser's `localStorage`, scoped to that exact site address. That means:

- Data stays on the device/browser you used to add it — it does not sync between phone and laptop on its own.
- Clearing browser data for the site wipes the journal.
- Photos are resized to a max width of 900px before saving, to keep things inside the storage limit, but heavy photo use can still fill it up.

Use the **Export backup** button regularly — it downloads a `travel-log-backup.json` file with everything in it. **Import backup** loads such a file back in (and replaces whatever is currently there, after asking for confirmation). Keeping that JSON file somewhere safe (Drive, iCloud, a second repo) is the easiest way to move the journal between devices too.

## Local preview before pushing

No server is required — just open `index.html` directly in a browser. If photo upload or the world map misbehaves when opened as a plain file (both load things via `fetch`, which some browsers restrict on `file://` pages), run a tiny local server instead, e.g. from this folder:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`. GitHub Pages itself always serves over `http(s)`, so this only matters for local testing.

## Credits

The world map (`world-map.svg`) is from the [svg-maps/world](https://github.com/VictorCazanave/svg-maps) project, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

