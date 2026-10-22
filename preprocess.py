"""India Startup Atlas - data preprocessing.  Run:  python preprocess.py
Reads startup_location.xlsx (all sheets), cleans it, attaches coordinates and
population from reference/ files, and writes data/*.json + data/atlas-data.js.
Nothing is invented: rows without coordinates are listed, not guessed."""
import pandas as pd, numpy as np, re, json, difflib, sys, pathlib
ROOT = pathlib.Path(__file__).parent
XLSX = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "startup_location.xlsx"
OUT = ROOT / "data"; OUT.mkdir(exist_ok=True)
k = lambda s: re.sub(r"[^a-z]", "", re.sub(r"\(.*?\)", "", str(s).lower()))
STATE_ALIAS = {"jammuandkashmir": "Jammu and Kashmir", "jammukashmir": "Jammu and Kashmir", "orissa": "Odisha",
    "nctofdelhi": "Delhi", "pondicherry": "Puducherry", "uttaranchal": "Uttarakhand",
    "andamanandnicobarislands": "Andaman and Nicobar Islands"}
# Alternative spellings used by the reference table (new name -> old/other names)
CITY_ALIAS = {"bengaluru": ["bangalore", "bangaloreurban"], "gurugram": ["gurgaon"], "mumbai": ["mumbaisuburban", "mumbaicity", "greatermumbai"],
    "mangaluru": ["mangalore", "dakshinakannada"], "belagavi": ["belgaum"], "shivamogga": ["shimoga"], "kalaburagi": ["gulbarga"],
    "kachchh": ["kutch"], "prayagraj": ["allahabad"], "delhi": ["newdelhi", "centraldelhi"], "vadodara": ["baroda"],
    "bagalkote": ["bagalkot"], "ramanagaram": ["bangalorerural", "ramanagara"], "chikballapur": ["chikkaballapura"],
    "kheri": ["lakhimpurkheri"], "baghpat": ["bagpat"], "thiruvananthapuram": ["trivandrum"], "kozhikode": ["calicut"],
    "puducherry": ["pondicherry"], "tiruchirappalli": ["trichy", "tiruchirapalli"], "ayodhya": ["faizabad"], "palakkad": ["palghat"],
    "chamarajanagar": ["chamrajnagar"]}
def nstate(s):
    s = re.sub(r"\s+", " ", str(s).replace("&", "and")).strip()
    return STATE_ALIAS.get(k(s), s.title().replace(" And ", " and "))

report = {"sheets": {}, "dropped": [], "unmatched": []}
xl = pd.ExcelFile(XLSX)
for s in xl.sheet_names: report["sheets"][s] = list(xl.parse(s, header=None).shape)

# ---- Sheets (title rows above the real header are skipped) ----
def table(sheet, first_col):
    raw = xl.parse(sheet, header=None)
    h = raw.index[raw.iloc[:, 0].astype(str).str.strip() == first_col][0]
    return raw.iloc[h + 1:].reset_index(drop=True)
off = table("State_Official", "Rank").iloc[:, :4]; off.columns = ["rank", "state", "official", "pct"]
cd = table("City_District", "State / UT").iloc[:, :7]; cd.columns = ["state", "city", "registered", "dpiit", "rank_india", "rank_state", "share_state"]

n0 = len(off); off = off[pd.to_numeric(off["rank"], errors="coerce").notna()].copy()
report["dropped"].append(f"State_Official: {n0 - len(off)} total/blank rows dropped")
off["state"] = off.state.map(nstate); off["official"] = off.official.astype(int)
n0 = len(cd); cd = cd[cd.state.notna() & pd.to_numeric(cd.registered, errors="coerce").notna()].copy()
report["dropped"].append(f"City_District: {n0 - len(cd)} total/check/blank rows dropped")
cd["state"] = cd.state.map(nstate); cd["city"] = cd.city.astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
cd["registered"] = cd.registered.astype(int)
n0 = len(cd); cd = cd.drop_duplicates(["state", "city"]); report["dropped"].append(f"City_District: {n0 - len(cd)} duplicate state+city rows dropped")

# ---- Coordinates + population (reference/ files, Census 2011) ----
dist = pd.read_csv(ROOT / "reference/final_districts.csv"); city = pd.read_csv(ROOT / "reference/final_cities.csv")
coords = {}
for df, col in ((dist, "District"), (city, "City")):
    for _, r in df.iterrows():
        if r.Latitude and r.Longitude: coords.setdefault((k(nstate(r["State"])), k(r[col])), (float(r.Latitude), float(r.Longitude)))
bystate = {}
for (s, n), v in coords.items(): bystate.setdefault(s, {})[n] = v
def locate(state, name):
    c = bystate.get(k(state), {})
    for cand in [k(name)] + CITY_ALIAS.get(k(name), []):
        if cand in c: return c[cand]
    m = difflib.get_close_matches(k(name), c.keys(), 1, 0.88)
    return c[m[0]] if m else None
pts = [locate(r.state, r.city) for r in cd.itertuples()]
cd["lat"] = [p[0] if p else np.nan for p in pts]; cd["lon"] = [p[1] if p else np.nan for p in pts]
um = cd[cd.lat.isna()]
report["unmatched"] = [{"state": r.state, "city": r.city, "registered": int(r.registered)} for r in um.sort_values("registered", ascending=False).itertuples()]

dist["Population"] = pd.to_numeric(dist.Population.astype(str).str.replace(",", ""), errors="coerce").fillna(0)
dist["st"] = dist.State.map(nstate)
pop = dist.groupby("st").Population.sum()
# A few UTs repeat one population value across districts in the source -> treat as missing, not guessed
nun = dist.groupby("st").Population.nunique(); bad = set(nun[(nun == 1) & (dist.groupby("st").size() > 1)].index)
pop_rows, states = [], []
for r in off.itertuples():
    p = None if (r.state in bad or r.state not in pop.index or pop[r.state] <= 0) else int(pop[r.state])
    pop_rows.append({"state": r.state, "population_2011": p})
    g = cd[cd.state == r.state]; top = g.sort_values("registered", ascending=False).head(1); mg = g.dropna(subset=["lat"])
    ctr = [float(np.average(mg.lon, weights=mg.registered)), float(np.average(mg.lat, weights=mg.registered))] if len(mg) else None
    states.append({"state": r.state, "official": int(r.official), "pct_india": float(r.pct), "population_2011": p,
        "per_lakh": round(r.official / (p / 1e5), 2) if p else None, "portal_sum": int(g.registered.sum()),
        "districts_listed": int(len(g)), "top_district": top.city.iloc[0] if len(top) else None, "center": ctr})
report["states_in_districts_not_official"] = sorted(set(cd.state) - set(off.state))
feats = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(r.lon, 4), round(r.lat, 4)]},
    "properties": {"name": r.city, "state": r.state, "registered": int(r.registered),
    "dpiit": None if pd.isna(r.dpiit) else int(r.dpiit), "rank_india": int(r.rank_india), "rank_state": int(r.rank_state),
    "share_state": round(float(r.share_state), 4)}} for r in cd.dropna(subset=["lat"]).itertuples()]
withpop = [s for s in states if s["population_2011"]]
nat = sum(s["official"] for s in withpop) / (sum(s["population_2011"] for s in withpop) / 1e5)
for s in states: s["underserved"] = bool(s["per_lakh"] is not None and s["per_lakh"] < 0.5 * nat)
meta = {"official_total": int(off.official.sum()), "portal_total": int(cd.registered.sum()), "national_per_lakh": round(nat, 2),
    "official_asof": "30 June 2026", "portal_asof": "August 2026",
    "sources": {"official": "Lok Sabha Unstarred Q.1446 (28 Jul 2026), DPIIT, Annexure-I", "portal": "indianstartupmap.com/cities (Startup India register)",
    "coordinates_population": "recurze/IndianCities (Census 2011 populations; latlong.net / Wikipedia coordinates) - approximate"},
    "districts_plotted": len(feats), "districts_total": int(len(cd)), "unmatched_startups": int(um.registered.sum()), "report": report}
fc = {"type": "FeatureCollection", "features": feats}
for n, o in (("districts", fc), ("states", states), ("meta", meta)):
    (OUT / f"{n}.json").write_text(json.dumps(o, ensure_ascii=False), encoding="utf-8")
(OUT / "atlas-data.js").write_text("window.ATLAS=" + json.dumps({"districts": fc, "states": states, "meta": meta}, ensure_ascii=False) + ";", encoding="utf-8")
pd.DataFrame(pop_rows).assign(note="Census 2011, approximate (sum of district populations)", source="recurze/IndianCities").to_csv(ROOT / "reference/state_population_approx.csv", index=False)
print(f"States: {len(states)} | Districts: {len(cd)} | plotted: {len(feats)} | unmatched: {len(um)} ({int(um.registered.sum())} registered startups not on the map)")
for d in report["dropped"]: print(" -", d)
print("States with no usable population:", [s["state"] for s in states if not s["population_2011"]])
print("Unmatched (top 40 by startups):")
for u in report["unmatched"][:40]: print("  ", u["state"], "|", u["city"], u["registered"])
