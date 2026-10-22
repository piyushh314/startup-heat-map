# India Startup Atlas

An interactive dark map of where startups are registered across India: a glowing density heatmap, clustered district dots, state bubbles, a startups-per-lakh-people view, a gap finder, compare mode, leaderboards, search, and PNG/CSV export.
Plain HTML, CSS and JavaScript, with MapLibre GL JS and a CARTO Dark Matter basemap (free, no API key).

**Built by Piyush Yadav**, BMS, Shaheed Sukhdev College of Business Studies (SSCBS), Delhi University. piyushhh3.14@gmail.com

> Screenshots: add `docs/desktop.png` and `docs/mobile.png` here.

## What the data does and does not contain
`startup_location.xlsx` holds **counts only**: official DPIIT counts per state (30 Jun 2026) and Startup India portal registrations per district (Aug 2026, districts with 25+ startups). It has **no sector, year or startup names**, so the sector filter, year slider and per-startup dots are not built. Nothing is invented to fill the gap. The official and portal counts are different bases and are never mixed. Registered does not mean active.

## Run it (Windows)
```
cd "D:\projects\startup map\atlas"
pip install pandas openpyxl numpy
python preprocess.py
python -m http.server 8000
```
Open http://localhost:8000. (Opening `index.html` directly also works, because the data is bundled in `data/atlas-data.js`. You need internet for the basemap, map library and fonts.)

## Refresh the data from Excel
Replace `startup_location.xlsx` (same sheet layout) and run `python preprocess.py`. It prints a cleaning report: dropped rows, duplicates, states without population, and every district it could not place. To fix an unplaced district, add its alternative spelling to `CITY_ALIAS` in `preprocess.py` or a row to `reference/final_districts.csv`.

## Reference data (outside the Excel file)
- `reference/final_districts.csv`, `final_cities.csv`: coordinates and **Census 2011** populations from github.com/recurze/IndianCities. Approximate.
- `reference/state_population_approx.csv`: generated state populations (sum of district populations, 2011). Per-lakh figures divide the 2026 official count by a 2011 population, so treat them as a rough guide.

## Deploy free
Netlify: drag the project folder onto app.netlify.com/drop. Vercel: `npm i -g vercel`, then `vercel` in this folder (framework "Other", no build step).

## Known limitations
See the checklist in the chat summary. Highlights: ~3% of registrations sit in districts with no coordinates (listed in the CSV); Delhi's sub-districts are not placed; labels use the basemap's `Montserrat Regular` font.
