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
cd ~/Desktop/projects/ludo-taxi
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

## Static build and GitHub Pages

The published site is plain static files. Build it with:

```bash
python3 build.py
```

This writes `dist/` (gitignored) with only what the page loads: `index.html`, `style.css`, `app.js`, `fun.js`,
`layout.js`, `layout.claude.js`, the two SVGs, `projects/` (thumbnails for the About dialog) and `sheets/` (including `all-originals.zip`, which it
creates with `make_zip.py` if missing). The CSS and script links in `dist/index.html` get a `?v=<hash>`
so visitors get the new files after a deploy. Preview it with
`python3 -m http.server 8000 --directory dist`.

Every push to `main` deploys `dist/` to GitHub Pages through `.github/workflows/pages.yml`. One-time
setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.

On the published site, **Edit layout** still works but can't write `layout.js`: changes stay in that
browser. To change the layout for everyone, edit locally with `server.py`, commit `layout.js` and push.

Any other static host (Netlify, an S3 bucket) works the same way: upload the contents of `dist/`.

## Controls

Every action, by input. "Button" means the on-screen button, which works the same with a mouse or a finger.
The creator-only **Edit layout** controls are described in [Aligning the sheets](#aligning-the-sheets).

### On the map

| Action | Keyboard | Mouse / trackpad | Touch (phone, tablet) |
|---|---|---|---|
| Pan | Arrow keys | Drag | Drag with one finger |
| Zoom in / out | `+` / `−` (same as the buttons: 2×, animated) | Scroll wheel or two-finger scroll, toward the pointer; trackpad pinch; `+` / `−` buttons | Pinch; `+` / `−` buttons |
| Zoom in 2× at a point | — | Double-click the empty map | Double-tap anywhere |
| Rotate | `Q` / `E` or `[` / `]` | Shift + drag, right-drag, Shift + wheel, Safari trackpad rotate | Twist with two fingers |
| North up | `N` | Compass button | Compass button |
| Reset view (whole city, north up) | `R` or `0` | ↺ button | ↺ button |
| Select a sheet | Enter or Space with nothing selected picks sheet 1; then next / previous below | Click the sheet or its label | Tap the sheet or its label |
| Next / previous sheet (by number, wraps round) | `.` / `,` or Page Down / Page Up | Scroll sideways (a mouse's side wheel or a sideways trackpad swipe): right = next, one sheet per flick | Swipe sideways with three fingers: left = next |
| Show on map (turns the sheet upright and fills the screen) / Back | Enter or Space (again to go back); `Esc` also goes back | Double-click the sheet (again to go back); card button | Card button |
| Back after Show on map, then close the card and panels | `Esc` (first press goes back, second closes) | ×; clicking the empty map closes the card | ×; tapping the empty map closes the card |
| Sheet list (☰) | `L` | ☰ button | ☰ button |
| View settings | `V` | Layers button | Layers button |
| Full screen | `F` (with nothing selected: sheet 1) | Card button | Card button |
| Download one sheet | `D` (the selected sheet) | Card button; ↓ in the list | Card button; ↓ in the list |
| Download all 26 | — | Red button at the top of the list | Red button at the top of the list |
| Share a link to the sheet | `S` (copies the link) | 🔗 on the card (copies the link) | 🔗 on the card (opens the share menu) |
| Night shift on / off | `Z` | About dialog: **Ноќна смена** | About dialog: **Ноќна смена** |
| Random ride (**Каде, шефе?**) | `K` | Yellow button under the logo | Yellow button under the logo |
| Taximeter receipt | `M` | Click the taximeter | Tap the taximeter |
| Guessing game (**Погоди**) / end it | `P` / `Esc` | **Погоди** button / × | **Погоди** button / × |
| Game: place / move the pin, then confirm | `Enter` confirms | Click the map, then **Погоди!** | Tap the map, then **Погоди!** |
| About | `?` (opens it with **Контроли** expanded); or Tab to the logo, then Enter or Space | Click the logo | Tap the logo |
| Pick a sheet from the list | Tab to its row, then Enter or Space | Click the row | Tap the row |

While a sheet is shown with **Show on map**, next / previous shows the next sheet the same way, and Back still
returns to where the map was before. Otherwise the map only moves when the newly selected sheet is off screen.

### In the full-screen viewer

| Action | Keyboard | Mouse / trackpad | Touch (phone, tablet) |
|---|---|---|---|
| Move the scan | Arrow keys | Drag | Drag with one finger |
| Zoom in / out | `+` / `−` | Scroll wheel or two-finger scroll, toward the pointer; trackpad pinch | Pinch |
| Zoom in 2.5× at a point, or back to fit | — | Double-click | Double-tap |
| Fit the whole sheet | `0` or `R` | **Fit** button | **Fit** button |
| Next / previous sheet | `.` / `,` or Page Down / Page Up | Scroll sideways, as on the map | Swipe sideways with three fingers: left = next |
| Download | `D` | Download button | Download button |
| Share a link to the sheet | `S` | — | — |
| Close | `Esc` or `F` | × | × |

The map and the sheet card follow along behind the viewer, so after closing it the card shows the last sheet
you looked at.

The three-finger swipe steps once when the fingers lift, and only for a clearly sideways swipe of at least
50 px. While three fingers are down the map does not pan or zoom. Some phones use three-finger gestures
themselves (iOS: undo / redo while editing text; some Android phones: screenshots), and the system may
take the swipe first.

### Keyboard notes

- The toolbar keys (`+`, `−`, `N`, `R`, `L`, `V`) press their buttons, so a key does exactly what its button
  does, and each button's tooltip shows its key.
- Letter keys go by the physical key, so they also work with a Macedonian keyboard layout.
- Enter and Space only act on the map when no button or link has keyboard focus; otherwise they press
  that button, as usual.
- Keys pressed together with Cmd, Ctrl or Alt are left to the browser (page zoom, paste, …).
- Keys are ignored while typing in a field.

The compass needle shows where north is while the map is rotated.

### Night shift (Ноќна смена)

A dark mode with a taxi touch: the street map turns dark blue-grey, the hand-drawn sheets glow warmly as
if under a dashboard lamp, the labels turn taxi-sign yellow, the interface goes dark and the **Каде, шефе?**
roof sign lights up.

Choose it in the About dialog under **Ноќна смена**: **Автоматски** (the default: on from sunset to
sunrise in Skopje, worked out in the browser with the standard sunrise equation, accurate to a few
minutes, and re-checked every minute), **Вклучена** (always on) or **Исклучена** (always off). The choice
is remembered in the browser with the other display settings (`localStorage` key `taxi-maps-prefs-v1`,
field `night`: `auto`, `on` or `off`), so it carries over to the next visit.

`Z` switches it on or off directly by setting the choice to **Вклучена** or **Исклучена**, and that is
remembered too: pressing `Z` at night for light mode keeps it light on later nights as well. Choose
**Автоматски** in the About dialog to go back to following sunset and sunrise.

While night shift is on the canvas inverts the street map and tints it (`difference` then `multiply`
composite fills, so it works in every browser), sheets that are not selected are drawn 1.5× more opaque,
solid sheets get a warm glow instead of a shadow, and the interface switches its colour variables
(`body.night` in `style.css`).

### Extras

Under the logo, a little left column has three playful extras (all in `fun.js`):

- **Каде, шефе?** ("Where to, boss?", the yellow taxi-roof button, `K`): a ride to a random neighbourhood.
  It works like **Show on map**, so **Back** / `Esc` returns, and a taxi-driver line pops up
  ("Ченто? Може, ама по Партизанска е гужва.").
- **Taximeter** (the green-and-red display): counts how many kilometres the map has travelled (panning,
  flying, rides) and the fare on a made-up "Лудо" tariff: 40 ден start, 35 ден/km, +20 % at night
  (22:00–06:00, shown with ☾). Click it (or `M`) for a printed-style receipt listing the neighbourhoods
  visited; **Плати и ресетирај** (pay and reset) sets it back to zero. It resets on reload.
- **Погоди ја населбата** ("Guess the neighbourhood", `P`): five rounds, like GeoGuessr on Skopje's
  street map. The drawings disappear and a piece of one drawing is shown (turned the way it lies on the
  map).
  - **Place, then confirm:** tap the map to drop a pin, tap again to move it, then **Погоди!** (or `Enter`)
    confirms. **Прескокни** (shown while no pin is placed) skips the round for 0 points.
  - **Score:** up to 1000 points a round, depending on the distance (`1000 × e^(−metres / 800)`). The sheet
    then appears with a red pin where the piece really is, a dark pin where you guessed and a dashed line
    between them.
  - **Summary:** after round 5 the map shows all five rounds (numbered red pins, your pins, lines) and the
    panel lists each round's neighbourhood, distance and points, with the total and a verdict.
  - **Timer (optional):** **Тајмер: 60 секунди по рунда** in the About dialog's game section (off by
    default, remembered). When time runs out a placed pin counts; without one the round scores 0.
  - **Challenge a friend:** **Предизвикај пријател** on the summary shares (phone) or copies (computer) a
    link such as `…/?pogodi=k3x9qa&rez=3120&t=60`. Every game is built from a seed, so the link gives your
    friend the same five pieces, with your timer setting; at the end they see whether they beat your score.
    Opening the link starts the challenge at once and tidies the address.
  - × or `Esc` ends the game; the street map is switched on for it and set back afterwards.
  - The About dialog's **Игра „Погоди“** section shows the best score (and its date), the number of games
    and the last score, with **Играј** and **Избриши** (a second, confirming click clears them). Scores and
    the timer setting are kept only in this browser (`localStorage` keys `taxi-maps-guess` and
    `taxi-maps-guess-timer`).
- **The little taxi:** (drawn at twice the logo-taxi outline size) whenever the map flies to or from a sheet (**Show on map** / **Back**, next / previous,
  **Каде, шефе?**, opening a link), a small yellow taxi like the one in the logo drives along the flight:
  the camera follows it with a slight swerve, it faces the way it's going (wheels turning, headlight beam
  at night), then parks on the sheet with a bounce and a puff of exhaust and fades out after about a
  second. Flights take 0.75 s instead of 0.45 s so the ride can be seen; very short moves get no taxi,
  and dragging the map cancels it. Turn it off in the view settings (`V`): **Такси при летање до мапа**.
- **Secret:** type `T` `A` `X` `I` (none of these letters does anything else), or tap the logo inside the
  About dialog 5 times: the map spins once and honks (a synthesised two-tone horn, only ever on that
  action). It is left out of the in-app **Контроли** list on purpose.

### Coverage

Every action has a keyboard, a mouse / trackpad and a touch route. The one deliberate exception: on touch,
Show on map is only the card button, because double-tap zooms. The same controls are listed in the About
dialog under **Контроли**; when a control changes, update both.

### Downloads

Every download is the untouched original scan, byte for byte, under its original Cyrillic file name
(for example `9 карпош.jpg`).

- **Download all 26 maps** (red button at the top of the ☰ sheet list) gets one
  ZIP, `Лудо Такси - мапи на Скопје.zip` (about 22 MB), with all originals in a folder.
- **Download** on a sheet's card, **Download** in the full-screen viewer, or the ↓ icon
  next to each sheet in the list gets a single map.

### Sheet card

Tap a sheet to open its card. Its buttons, left to right:

- **Show on map** (`Enter` / `Space`, or double-click the sheet) animates to the sheet and turns the map
  so the drawing reads straight, with its neighbours around it. The button then reads **Back**: click it
  (or press `Enter`, `Space` or `Esc`) to animate the map back to exactly where it was.
- **Full screen** (`F`) opens the original scan over the whole screen, flat and not rotated, at full
  resolution. Pinch, scroll or double-tap to zoom, drag or arrow keys to move, next / previous sheet as
  on the map. **Fit** (greyed out until you zoom or move; `0` / `R`) brings the whole sheet back, and ×,
  `Esc` or `F` closes it.
- **Download**: see above.

The sheet's number shows in a red badge next to its name only when **Show sheet numbers** is on
(see [Display panel](#display-panel)). The 🔗 icon shares a link (see below).

### About

Clicking the logo badge opens a small dialog: развиено од Бојан Божиновски, with LinkedIn and GitHub
buttons, credits for the hand-drawn maps and OpenStreetMap, the guessing game's scores (see
[Extras](#extras)), the **Ноќна смена** (night shift) choice, cards linking to the author's other projects
(091 Скопје, Старо Скопје), and at the bottom a collapsible **Контроли** section (closed until clicked) listing every keyboard,
mouse / trackpad and touch control (the same as [Controls](#controls)). Its content scrolls when it does not fit the screen;
× stays in the corner. `Esc`, × or a click outside closes it, and map keys do nothing while it is open.
When a control changes, update both this README and the dialog in `index.html`.

The interface is in Macedonian.

### Links to a sheet

The address follows the selected sheet: selecting Центар changes it to `…/#centar`, and deselecting
removes it. Opening such a link goes straight to that sheet, selected and upright; **Back** on its card
then shows the whole city. Links use the sheet's name in Latin letters (spaces become `-`, commas are
dropped, for example `#skopje-sever-butel-2`), so they keep working if sheets are renumbered and stay
readable when pasted anywhere. The letters follow the usual Macedonian romanisation (ѓ gj, ж zh, ѕ dz,
љ lj, њ nj, ќ kj, ц c, ч ch, џ dzh, ш sh). Older links with the Cyrillic name (`#центар`) and a number
such as `#23` work too. The link icon on the card opens the phone's share menu, or copies the link on a computer.
Shared links never include `?edit`.

### List of sheets

The ☰ button (`L`) lists all 26 sheets alphabetically with thumbnails. Tap one to fly to it, shown
upright, or tap its ↓ icon to download it. The panel's title and × stay at the top while the list
scrolls. Number badges appear only with **Show sheet numbers** on.

### Display panel

The layers button (`V`) opens settings that are remembered in the browser:

- **Show street map underneath**: turns the OpenStreetMap layer on or off.
- **Street map strength**: how strongly the street map shows. It is kept muted and mostly grey by
  default so the coloured drawings stand out.
- **Sheet opacity**: how see-through the sheets you haven't selected are (default 0.4), so you can
  compare the drawings with the real streets. At 1 they're solid. The selected sheet is always solid.

Both sliders snap onto their default when you drag close to it (within ±0.04), and a small mark
under each slider shows where the default is.
- **Show sheet labels**: name badges on the sheets, shown while you're zoomed out.
- **Taxi on flights** (**Такси при летање до мапа**): on by default; the little taxi that drives along
  flights to a sheet (see [Extras](#extras)).
- **Show sheet numbers**: off by default. Turns on the sheet numbers everywhere: in the labels on the map
  (`11 · Козле`), in the list, on the sheet card and in the full-screen viewer.
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
index.html     page structure: canvas, buttons, panels, sheet card, About dialog (incl. its controls list)
style.css      styling
app.js         the viewer: rendering, gestures, base map, editing
layout.js      where each sheet sits: lat, lon, width (m), rot (°), z (stacking order)
               (rewritten by Edit layout when running server.py)
layout.claude.js  snapshot of the automatic alignment, used by the Restore buttons
layout.before-claude.js  your layout just before the automatic alignment
server.py      local server: serves the folder and saves layout.js (POST /api/layout)
fun.js         the playful extras: Каде, шефе?, the taxi on flights, taximeter, guessing game, secret code (uses window.LudoTaxi from app.js)
tools/         alignment helpers: grid.html, osm_lookup.py, scan_area.py, add_points.py, fit.py,
               control_points.json (every matched junction, sheet by sheet)
make_zip.py    rebuilds sheets/all-originals.zip from input/
build.py       builds the static site into dist/ (gitignored) for GitHub Pages
.github/workflows/pages.yml   runs build.py and deploys dist/ to GitHub Pages on every push to main
projects/      320×200 thumbnails of the other projects, for the About dialog
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
cd ~/Desktop/projects/ludo-taxi
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
