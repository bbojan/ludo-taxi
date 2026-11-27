# Лудо Такси · мапи на Скопје нацртани на рака прилично одамна

Twenty-six hand-drawn neighbourhood maps of Skopje, made by a taxi driver in the last millennium
("Designed by МБ"), laid out on top of a real map of the city. You can pan, zoom and
rotate with a mouse, a trackpad or touch.

Each sheet is placed roughly where its neighbourhood is. They are not tiles that join edge to edge:
the driver drew every sheet at its own scale and often not with north at the top. So every sheet
carries its own position, size and rotation, and you can adjust these in the app (see
[Aligning the sheets](#aligning-the-sheets)).

## Running it

Browsers block a page opened straight from disk (`file://`) from loading its images and scripts
reliably, so serve the folder over HTTP with the included server:

```bash
cd ~/projects/taxi-maps-skopje-edition
```

```bash
python3 server.py
```

`server.py` serves the folder just like `python3 -m http.server`, and also lets
**Edit layout** save sheet positions straight into `layout.js`. It only listens on your own
computer (127.0.0.1).

Then open <http://localhost:8777>. To view it on a phone on the same Wi-Fi, run
`python3 -m http.server 8777 --bind 0.0.0.0` instead and open `http://<your-computer's-IP>:8777`.
Edits made that way stay in the phone's browser.

The base street map comes from OpenStreetMap tiles, so that layer needs internet access. The hand-drawn
sheets work offline.

Any static host works too (GitHub Pages, Netlify, an S3 bucket): upload `index.html`, `style.css`,
`app.js`, `layout.js` and the `sheets/` folder.

## Controls

| Action | Mouse / trackpad | Touch |
|---|---|---|
| Pan | Drag | Drag with one finger |
| Zoom | Scroll (mouse wheel or trackpad) zooms toward the mouse pointer; also trackpad pinch, double-click, `+` / `−` buttons or keys | Pinch, double-tap |
| Rotate | Shift + drag, right-drag, Shift + wheel, Safari trackpad rotate, `Q` / `E` keys | Twist with two fingers |
| North up | Compass button or `N` | Compass button |
| Reset view (zoom and rotation) | ↺ button, `R` or `0` | ↺ button |
| Select a sheet | Click it or its number/name label | Tap it or its label |
| Move around | Arrow keys | — |
| Close card or panels | `Esc` | × |

The compass needle shows where north is while the map is rotated.

### Downloads

Every download is the untouched original scan, byte for byte, under its original Cyrillic file name
(for example `9 карпош.jpg`).

- **Download all 26 maps** (red button at the top of the ☰ sheet list) gets one
  ZIP, `Лудо Такси - мапи на Скопје.zip` (about 22 MB), with all originals in a folder.
- **Download** on a sheet's card, **Download** in the full-screen viewer, or the ↓ icon
  next to each sheet in the list gets a single map.

### Sheet card

Tap a sheet to open its card:

- **Download**: see above.
- **Full screen** opens the original scan over the whole screen, flat and not rotated, at full
  resolution. Pinch, scroll or double-tap to zoom, drag to move. **Fit** (greyed out until you zoom or move) brings the whole sheet back,
  and × or `Esc` closes it.
- **Show on map** animates to the sheet and turns the map so the drawing reads straight, with its
  neighbours around it. The button then reads **Back**: click it to animate the map back to exactly
  where it was.

### About

Clicking the logo badge opens a small dialog: развиено од Бојан Божиновски, with LinkedIn and GitHub
buttons, and credits for the hand-drawn maps and OpenStreetMap.

The interface is in Macedonian.

### Links to a sheet

The address follows the selected sheet: selecting Центар changes it to `…/#центар`, and deselecting
removes it. Opening such a link goes straight to that sheet, selected and upright; **Back** on its card
then shows the whole city. Links use the sheet's name (spaces become `-`, commas are dropped, for
example `#скопје-север-бутел-2`), so they keep working if sheets are renumbered. A number such as `#23`
works too. The link icon on the card opens the phone's share menu, or copies the link on a computer.
Shared links never include `?edit`.

### List of sheets

The ☰ button lists all 26 sheets with thumbnails. Tap one to fly to it, shown upright, or tap its ↓
icon to download it.

### Display panel

The layers button opens settings that are remembered in the browser:

- **Show street map underneath**: turns the OpenStreetMap layer on or off.
- **Street map strength**: how strongly the street map shows. It is kept muted and mostly grey by
  default so the coloured drawings stand out.
- **Sheet opacity**: how see-through the sheets you haven't selected are (default 0.4), so you can
  compare the drawings with the real streets. At 1 they're solid. The selected sheet is always solid.

Both sliders snap onto their default when you drag close to it (within ±0.04), and a small mark
under each slider shows where the default is.
- **Show sheet labels**: number and name badges, shown while you're zoomed out.
- **Edit layout**: see below.

## Aligning the sheets

The starting positions in `layout.js` are rough guesses for each neighbourhood, and most rotations
are set to 0. To line them up properly:

**Editing is currently switched off** (`EDITING_ENABLED = false` in `app.js`), so `?edit` does nothing.
Set it to `true` to use the steps below again.

1. Start the viewer with `python3 server.py` and open <http://localhost:8777/?edit>. The editing tools
   are hidden from normal visitors and only appear with `?edit` in the address. Then open the layers
   panel and turn on **Edit layout**.
2. Keep **Sheet opacity** low (0.4 is the default) so you can see the streets through the other sheets.
3. **Move**: grab any sheet and drag it. It becomes selected (red dashed outline) and its card opens.
   Dragging empty map still pans.
4. **Scale and rotate** the selected sheet: pinch or twist with two fingers, or use the **Size** and
   **Rotation** sliders and the ↺ 90° / ↻ 90° buttons on the card.
   With a mouse, Alt + wheel scales and Shift + wheel rotates the selected sheet.
5. **Bring to front** keeps the sheet above sheets it overlaps after you deselect it.
   While a sheet is selected it is always drawn on top.

See-through sheets get a thin outline so overlapping edges stay visible. In edit mode the selected
sheet is solid, as for visitors, and while a sheet is selected all the other sheets fade to 5% so they
don't get in the way. With nothing selected, edit mode looks the same as for visitors.
**Opacity while checking** on the card makes the selected sheet see-through so you can compare it
with the streets. It's temporary: selecting another sheet, deselecting, or switching edit mode off
puts it back to 100%, and it is never saved.

**Restoring the automatic alignment.** All 26 sheets were aligned automatically (see
[Aligning automatically](#aligning-automatically)) and those values are kept in `layout.claude.js`,
which the editor never changes. **Restore Claude's positions** in the layers panel puts every sheet
back, and **Restore** on a sheet's card (in edit mode) does it for just that sheet.

**Saving.** Every change is written to `layout.js` in the project about half a second after you stop
moving. The card's status line says **Saved to layout.js ✓**. The first save also makes a one-time
backup, `layout.original.js`. To start over, copy it back over `layout.js`.

If the page is served without `server.py` (for example `python3 -m http.server` or a static host),
changes are kept only in that browser (`localStorage`) and the status line says so. In that case
press **Export layout.js** and put the downloaded file in the project yourself.
**Discard unsaved browser changes** drops a browser-only copy and reloads from `layout.js`.

## Aligning automatically

`tools/` holds the scripts used to place the sheets from real street data:

1. Download named streets of Skopje from OpenStreetMap once (Overpass API), for example:
   `[out:json];(way["highway"]["name"](41.92,21.32,42.08,21.56);way["waterway"="river"](41.92,21.32,42.08,21.56););out tags geom;`
   saved as `streets.json`.
2. Read named intersections off a sheet. `tools/grid.html?id=09` shows a sheet with a percent grid,
   and `&r=x0,x1,y0,y1` zooms into a region.
3. Look up where they really are:
   `python3 tools/osm_lookup.py streets.json "Илинден" "Манапо"` for one pair, or
   `python3 tools/scan_area.py streets.json lat0 lat1 lon0 lon1 "Name" ...` for every pair in an area.
4. Store the matches with `python3 tools/add_points.py 09 "u v lat lon note" ...`
   (into `tools/control_points.json`; u, v = percent of sheet width and height).
5. `python3 tools/fit.py --dry` fits each sheet (move + rotate + even scale, least squares) and prints
   the error of every point in metres. Without `--dry` it rewrites `layout.js` and `layout.claude.js`.

Several streets were renamed since the maps were drawn. The matches used include:
Маршал Тито → Македонија, Иво Лола Рибар → Борка Талески, Октомвриска револуција → 8-ми Септември,
ЈНА → Св. Климент Охридски, Едвард Кардељ → Александар Македонски, Бул. Југославија (Чаир) → Крсте
Мисирков, Антон Попов (Ченто) → Методија Андонов Ченто.

How well each sheet fits (average distance between a drawn junction and the real one):

| Fit | Sheets |
|---|---|
| Under 50 m | Центар, Пржино, Ѓорче Петров, Водно, Железничка, Кисела Вода, Пинтија, Драчево, Бутел 1, Чаир, Автокоманда, Маџари |
| 50–100 m | Лисиче/Островска, Карпош, Хром, Универзална сала, Кале, Бутел 2, Радишани, Шуто Оризари, Лисиче |
| Over 100 m | Фонтана/Парк, Капиштец, Ново Село, Аеродром |

The biggest errors come from the drawings themselves: the driver enlarged busy areas and straightened
curved streets, and an even scale can't follow that. Пинтија's scale and Ченто's fit (only two
reference points) are the least certain.

## Project layout

```
logo.svg       the Лудо Такси logo (header badge)
favicon.svg    browser tab icon (the taxi from the logo)
index.html     page structure: canvas, buttons, panels, sheet card
style.css      styling
app.js         the viewer: rendering, gestures, base map, editing
layout.js      where each sheet sits: lat, lon, width (m), rot (°), z (stacking order)
               (rewritten by Edit layout when running server.py)
layout.claude.js  snapshot of the automatic alignment, used by the Restore buttons
layout.before-claude.js  your layout just before the automatic alignment
server.py      local server: serves the folder and saves layout.js (POST /api/layout)
tools/         alignment helpers: grid.html, osm_lookup.py, scan_area.py, add_points.py, fit.py,
               control_points.json (every matched junction, sheet by sheet)
make_zip.py    rebuilds sheets/all-originals.zip from input/
sheets/
  NN.jpg       byte-for-byte copies of the originals (used at high zoom and for downloads)
  NN-s.jpg     640 px previews (used when zoomed out, and as list thumbnails)
  all-originals.zip   every original under its Cyrillic name, for "Download all"
input/         the original scans; never modified
```

### layout.js fields

| Field | Meaning |
|---|---|
| `id` | Two-digit sheet number; matches the files `sheets/NN.jpg` and `sheets/NN-s.jpg` |
| `name` | Display name |
| `file` | Original file name, used as the download name |
| `lat`, `lon` | Where the centre of the sheet sits on the map |
| `width` | Width of the sheet on the ground, in metres. The height follows from the image's aspect ratio. |
| `rot` | Clockwise rotation in degrees. 0 means the sheet's top edge points north. |
| `z` | Optional stacking order. Higher numbers are drawn on top. |

### How it works

- **Coordinates.** Everything is placed in Web Mercator pixel space at zoom 16, the same grid
  OpenStreetMap tiles use, so sheets and the street map line up exactly. A sheet's width in metres
  is converted to map units with the metres-per-pixel value at its latitude.
- **View.** The view is a centre point, a scale and a rotation. Each frame the canvas is translated,
  rotated and scaled once, then the tiles and sheets are drawn in world coordinates. Labels are drawn
  afterwards in screen space so they always stay upright.
- **Gestures.** Pointer Events cover mouse, pen and touch with one code path. With one pointer down
  you pan. With two pointers, the distance between them gives the zoom, the angle gives the rotation,
  and the midpoint stays fixed under your fingers. Every wheel event zooms around the mouse
  pointer; trackpad pinch arrives as a wheel event with `ctrlKey` and gets a stronger factor. Safari's `gesture*` events add trackpad rotation
  on macOS.
- **Base map.** The app picks the tile zoom level that matches the current scale and screen density,
  loads only the tiles in view (computed from the rotated viewport corners), and keeps about 600 of
  them cached. While a tile loads, an already-loaded lower-zoom parent tile is stretched in its place.
- **Image loading.** The 640 px previews load up front. A full-resolution scan loads only when its
  sheet appears larger than about 560 device pixels, which keeps memory low on phones.
- **Resetting.** Reset and north-up animate along the shortest path, with zoom eased in log space.

## Renaming and renumbering

- `python3 tools/rename_sheet.py 13 "Населба Лисиче"` renames one sheet everywhere: the name in the app,
  the original file in `input/`, `layout.js`, `layout.claude.js` and the ZIP.
- `python3 tools/renumber.py` numbers all sheets 1–26 in Macedonian Cyrillic alphabetical order (the
  same order as the sheet list) and renames every file to match. `--dry` shows the new numbers first.
  Each run saves its old → new mapping in `tools/renumber-<time>.json`.

Reload any open map page after either one, otherwise its next save writes the old values back.

## Regenerating `sheets/`

If you add or rescan a sheet in `input/` (named `<number> <name>.jpg`):

```bash
cd ~/projects/taxi-maps-skopje-edition
for f in input/*.jpg; do
  b=$(basename "$f"); n=$(printf "%02d" ${b%% *})
  cp "$f" sheets/$n.jpg
  sips -Z 640 -s formatOptions 75 "$f" --out sheets/$n-s.jpg >/dev/null
done
```

Then rebuild the download-all ZIP, and add an entry for the new sheet in `layout.js`:

```bash
python3 make_zip.py
```

## Credits

- Hand-drawn maps: a Skopje taxi driver (signed "МБ"), last millennium.
- Base map: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. The tile servers
  are meant for light use. If you publish this widely, switch to a tile provider that allows your
  amount of traffic.
