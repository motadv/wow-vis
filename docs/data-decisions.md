# Data Pipeline & Manifest Decisions

This document records every non-obvious decision made during data collection and manifest construction, including bugs fixed, manual adjustments, and design choices that are not derivable from the code alone.

---

## 1. Data pipeline fixes

### 1.1 Invalid realm IDs

The original script hardcoded `SAMPLE_REALM_IDS = [11, 3, 4, 57]`. IDs 3, 4, and 57 are not valid US connected-realm IDs, so every request to those realms returned HTTP 500 ("Downstream Error" — Blizzard's opaque error for a resource that does not exist). Only realm 11 ever returned data.

**Fix:** Switched to a verified list of the 5 highest-population US connected realms, looked up by querying `/data/wow/connected-realm/index` and then `/data/wow/connected-realm/{id}` to confirm name and existence:

| Connected realm ID | Realm names |
| ------------------ | ----------- |
| 3676               | Area 52     |
| 60                 | Stormrage   |
| 57                 | Illidan     |
| 3684               | Mal'Ganis   |
| 11                 | Tichondrius |

### 1.2 First-period-only dungeon discovery

`discoverActiveDungeons` probed only `periods[0]` to find which dungeons were active in a season. Seasons 13 (TWW S1) and 15 (TWW S3) returned zero dungeons on their first period, so the script skipped them entirely.

**Fix:** `discoverActiveDungeons` now iterates all periods in order and stops as soon as one returns data. This recovered full dungeon lists for both seasons.

### 1.3 API error visibility

The `get<T>` helper only logged the HTTP status code on failure. With Blizzard returning 500 for non-existent resources, the status alone was not enough to diagnose the cause.

**Fix:** On non-OK responses the helper now reads and appends the response body to the error message. The body consistently reads `"Downstream Error"` for missing realm/dungeon/period combos, which confirmed that the root cause was the invalid realm IDs (§1.1), not a rate-limit or auth issue.

---

## 2. Data coverage

### Seasons with data

Seasons 1–5 returned empty Parquet files (100 bytes, zero rows). Blizzard's leaderboard API does not retain history for those early BfA-era seasons. All visualization logic should treat them as having no data.

| Season ID | Name             | Has data |
| --------- | ---------------- | -------- |
| 1–5       | BfA S1–S4, SL S1 | No       |
| 6–15      | SL S2 → TWW S3   | Yes      |

### Missing continents

The world map includes Northrend and Pandaria, but neither has any dungeon in the dataset. Northrend dungeons (Halls of Reflection etc.) and Pandaria dungeons (Stormstout Brewery, Temple of the Jade Serpent) appeared only in M+ Seasons 1–3, for which we have no data.

---

## 3. Map coordinate system

The world map image (`public/map.jpg`) is **3840 × 2560 pixels** and contains the following continents: Kalimdor, Eastern Kingdoms, Northrend, Broken Isles, Kul Tiras, Zandalar, Pandaria, Dragon Isles, Khaz Algar.

Continents **not on the map** (relevant for `offWorld` classification): Outland, Draenor, Shadowlands, Argus, and any time/pocket-dimension realms.

---

## 4. DungeonManifest schema evolution

The original schema stored `mapX: number` and `mapY: number` per dungeon (precise world-map pixel coordinates). This was replaced with a zone-anchor approach for two reasons:

1. WoW itself does not pin dungeons to exact world-map coordinates.
2. Several zones host multiple dungeons (e.g. Val'sharah ×2, Thaldraszus ×2, Tiragarde Sound ×2, Isle of Dorn ×3), making individual placement redundant and harder to maintain.

**New schema:**

- `DungeonMeta.zone: string` — overworld zone slug (see §6)
- `ZoneMeta { slug, x, y }` — one anchor point per geographic zone
- `DungeonManifest.zones: ZoneMeta[]` — array of all on-world zone anchors

The map chart (`src/charts/map.ts`) groups dungeons by zone at init time and distributes them radially around the zone anchor with a fixed `CLUSTER_RADIUS = 22` px. Off-world dungeons are laid out in a horizontal row at the `OFF_WORLD_X / OFF_WORLD_Y` constants.

---

## 5. Era classification

All 49 dungeons were classified by expansion of origin (not the season they appeared in). The `era` field drives the colour palette on the map.

| Era            | Dungeons                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shadowlands`  | Mists of Tirna Scithe, The Necrotic Wake, De Other Side, Halls of Atonement, Plaguefall, Sanguine Depths, Spires of Ascension, Theater of Pain, Tazavesh: Streets of Wonder, Tazavesh: So'leah's Gambit |
| `wod`          | Iron Docks, Grimrail Depot, The Everbloom                                                                                                                                                               |
| `legion`       | Return to Karazhan: Upper, Return to Karazhan: Lower, Neltharion's Lair, Darkheart Thicket, Black Rook Hold                                                                                             |
| `bfa`          | Operation: Mechagon - Junkyard, Operation: Mechagon - Workshop, The Underrot, Freehold, Waycrest Manor, Atal'Dazar, Siege of Boralus, The MOTHERLODE!!                                                  |
| `cataclysm`    | The Vortex Pinnacle, Throne of the Tides, Grim Batol                                                                                                                                                    |
| `dragonflight` | Uldaman: Legacy of Tyr, Neltharus, Brackenhide Hollow, Halls of Infusion, Dawn of the Infinite ×2, Ruby Life Pools, The Nokhud Offensive, The Azure Vault, Algeth'ar Academy                            |
| `tww`          | The Stonevault, City of Threads, Ara-Kara, The Dawnbreaker, Priory of the Sacred Flame, The Rookery, Darkflame Cleft, Cinderbrew Meadery, Operation: Floodgate, Eco-Dome Al'dani                        |

---

## 6. offWorld classification

`offWorld: true` means the dungeon is not on the Azeroth map and should render in the off-world cluster. Rules applied:

- **Entire Shadowlands expansion** — off-world by definition (a separate afterlife realm).
- **Tazavesh** — a pocket dimension, also off-world.
- **WoD dungeons** (Iron Docks, Grimrail Depot, The Everbloom) — set on Draenor, which is not on the map.
- **Operation: Mechagon** — an off-coast island treated as a separate zone; no surface position on the map.
- **Dawn of the Infinite** — set inside the Infinite Dragonflight's timeways.
- **Eco-Dome Al'dani** — uncertain location (TWW S3, new); flagged off-world conservatively. Revisit if a clear map position is confirmed.

Edge cases resolved:

- **The Vortex Pinnacle** — initially flagged off-world (Skywall elemental plane), then corrected to `offWorld: false`. Its entrance is physically in Uldum, Kalimdor, and the in-game world map places it there. Anchor: `uldum`.
- **Throne of the Tides** — underwater (Vashj'ir), but Vashj'ir is off the EK coast and visible on the map. Anchor: `vashj-ir`.
- **Return to Karazhan** — despite being a Legion content revamp, the physical location (Deadwind Pass) is in Eastern Kingdoms and on the map. Anchor: `deadwind-pass`.

---

## 7. Zone slug mapping

The Blizzard API's `zone.slug` per dungeon is an instance-level slug (e.g. `freehold`, `siege-of-boralus`), not the overworld zone. A custom overworld mapping was defined to group dungeons that share a geographic area:

| Zone slug (custom)   | Dungeons                                                                                                                       | Continent                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `deadwind-pass`      | Karazhan Lower, Karazhan Upper                                                                                                 | Eastern Kingdoms            |
| `badlands`           | Uldaman: Legacy of Tyr                                                                                                         | Eastern Kingdoms            |
| `vashj-ir`           | Throne of the Tides                                                                                                            | Eastern Kingdoms (offshore) |
| `twilight-highlands` | Grim Batol                                                                                                                     | Eastern Kingdoms            |
| `uldum`              | The Vortex Pinnacle                                                                                                            | Kalimdor                    |
| `val-sharah`         | Darkheart Thicket, Black Rook Hold                                                                                             | Broken Isles                |
| `highmountain`       | Neltharion's Lair                                                                                                              | Broken Isles                |
| `tiragarde-sound`    | Freehold, Siege of Boralus                                                                                                     | Kul Tiras                   |
| `drustvar`           | Waycrest Manor                                                                                                                 | Kul Tiras                   |
| `zuldazar`           | Atal'Dazar                                                                                                                     | Zandalar                    |
| `kezan`              | The MOTHERLODE!!                                                                                                               | Zandalar (underground)      |
| `nazmir`             | The Underrot                                                                                                                   | Zandalar                    |
| `waking-shores`      | Ruby Life Pools                                                                                                                | Dragon Isles                |
| `ohnahran-plains`    | The Nokhud Offensive                                                                                                           | Dragon Isles                |
| `azure-span`         | The Azure Vault, Brackenhide Hollow                                                                                            | Dragon Isles                |
| `thaldraszus`        | Algeth'ar Academy, Halls of Infusion                                                                                           | Dragon Isles                |
| `forbidden-reach`    | Neltharus                                                                                                                      | Dragon Isles                |
| `khaz-algar`         | Stonevault, City of Threads, Ara-Kara, Dawnbreaker, Priory, Rookery, Darkflame Cleft, Cinderbrew Meadery, Operation: Floodgate | Khaz Algar                  |

**Khaz Algar** was collapsed to a single anchor (instead of per-subzone anchors for Isle of Dorn, Ringing Deeps, Azj-Kahet, Hallowfall, The Undermine) because the continent occupies a small area on the world map and its underground zones cannot be meaningfully distinguished at that scale.

---

## 8. What is pre-processed vs manually set

### Pre-processed (scripted, no manual input needed)

- Season Parquet files — generated by `npm run fetch`
- `dungeons.json` dungeon list and season membership — generated by `npm run fetch`
- `era` and `offWorld` fields — applied via a one-off Node.js patch script using the zone slugs returned by the Blizzard dungeon API
- `zone` field — applied via a one-off patch script using a hand-authored dungeon-ID → overworld-zone mapping

### Manually set

- **Zone anchor coordinates** (`zones[].x` and `zones[].y` in `dungeons.json`) — measured by the developer against `public/map.jpg` (3840 × 2560 px). Pixel coordinates were noted by opening the image in an editor with cursor position display.
- Any corrections to `era`, `offWorld`, or `zone` that the scripts got wrong (e.g. Vortex Pinnacle `offWorld` flip, Khaz Algar consolidation).
