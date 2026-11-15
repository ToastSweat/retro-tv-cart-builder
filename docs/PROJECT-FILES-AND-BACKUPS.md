# Project files, backups and recovery

The app source and a personal project are different things. A Git commit of the application does not necessarily back up your cart definitions or classifications: those belong to the project folder you selected.

## What lives where

| Location | Purpose |
| --- | --- |
| Application `v2/` | Code, dependency manifests, launcher and tests |
| Project `project.json` | Project identity, library references and managed-folder layout |
| Project `data/organization.json` | Networks, shows, associations and artwork references |
| Project `data/cart-plans.json` | Cart definitions and templates |
| Project `data/media-library.json` | Indexed media and project-local classification/quality metadata |
| Project `data/generated-carts.json` | Saved lineups, reservations, per-clip edits and review progress |
| Project `artwork/` | Copied artwork owned by the project |
| Project `cache/` | Derived playback/render caches |
| Project `builds/` | Numbered finals, previous-final backups and optional full reviews |
| Project `composites/`, `exports/` | Reserved managed folders; their presence is not a claim that composite creation or Jellyfin export exists |
| External source libraries | Original media, left unchanged |
| Electron machine preferences | Recent-project navigation and the selected FFmpeg location |

Library identity includes its configured ID and relative file path. Relink an existing library when moving it instead of removing/re-adding it casually.

## What to back up

Close the app or wait for scans/builds to finish. Copy the entire project folder to another location. Also keep a backup of original media; project metadata does not contain the media itself.

A smaller essential backup includes `project.json`, all of `data/` and `artwork/`. Keep `builds/` as well if you want final outputs without rebuilding. Cache files can generally be regenerated from available originals, but deleting them forces work to be repeated. Do not delete data files, reservations or backup directories as if they were a render cache.

Keep projects, media, generated videos and local runtime binaries out of an application-code commit unless you deliberately intend to version them. Version-control exclusions depend on your repository layout; do not blindly replace an existing `.gitignore`.

## Automatic backups are checkpoints, not a full backup system

Catalog operations retain JSON backups. Generation and Studio use backed-up writes; operations changing multiple records use rollback-aware batches. Local final replacement retains a `FINAL-previous-*` folder. These backups are inside the same project and do not protect against losing the disk or deleting the entire project.

Backup filenames and timestamps identify snapshots. More recently modified is not automatically the correct snapshot, and an old cart definition can refer to network/show/template IDs absent from the current project.

## If carts appear to disappear

1. Check the project name and path on the hub. Open the intended `project.json`, not a new empty project or an older copy.
2. Distinguish cart definitions from saved lineups: `cart-plans.json` and `generated-carts.json` have different roles.
3. Check whether networks/shows still exist. Their artwork references live in `organization.json`; actual images live in `artwork/`.
4. Inspect matching `cart-plans*.json` backups and copies inside operation-backup folders under `data/`. Compare cart IDs/codes, template IDs and associations before restoring anything.
5. Make a complete copy of the current project before recovery. Do not replace the whole data directory with an old snapshot just to recover one cart.

The documentation bundle includes an optional read-only inspector outside the repo documentation. It writes a new CSV/summary report without editing project records. If it finds a missing cart in a backup, retain that backup and its referenced artwork; recovery should merge only the missing records after checking references.

Never rerun an old cart-generation/setup script as a generic repair step. Saving a newly generated lineup replaces the active lineup and can discard its review progress.

## USB recovery

Ordinary failures roll back app-owned cartridge files. If a drive disconnects or the process is killed during commit, `.retro-building-*` or `.retro-previous-*` folders can remain. Preserve them while inspecting the root receipt and final files. Do not format the drive or delete recovery folders blindly.
