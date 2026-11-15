# Install Retro TV Cart Builder on Windows

This guide covers **2.0.0-beta.1**, the source-based desktop release. A signed installer and bundled FFmpeg are not provided.

## 1. Install the prerequisites

- A Windows desktop PC. USB volume discovery and labeling are implemented for Windows.
- **Node.js 22 or newer**, including npm. Use a supported LTS Windows installer from the [official Node.js download page](https://nodejs.org/en/download). The repository declares its minimum version in `v2/package.json`; it does not require you to chase the newest release.
- **FFmpeg and FFprobe from the same build.** The [official FFmpeg download page](https://ffmpeg.org/download.html) links to Windows executable providers. Extract a full build into a permanent tools folder and retain `ffmpeg.exe` and `ffprobe.exe` together in its `bin` folder. The application needs H.264/AAC encoding and the V1 audio restoration filters.
- Your media, stored in one or more source library folders.
- Enough free disk space for source media, cached previews, staged/final builds and retained previous finals.

If upgrading from V1, keep its known-working FFmpeg build. The project encountered native crashes with a particular FFmpeg 9.0.1 build; a newer version number is not proof that a build will work better with these restoration filters. You can explicitly choose the executable in Studio.

After installing Node.js, close and reopen any terminals. To check the prerequisites, run:

```powershell
node --version
npm.cmd --version
```

These are setup checks; routine cart work happens inside the application.

## 2. Obtain and extract the application

Download the source ZIP from the repository or release you are using, or clone that repository with Git. Extract the complete tree into a normal writable application folder. You should have:

```text
Retro-TV-Cart-Builder/
  v2/
    Start-RetroTV.cmd
    package.json
    package-lock.json
    src/
    test/
  docs/
```

Do not place your personal project or media inside the application source tree. You do not need the archived `legacy-v1/` tree to run V2, except if you are deliberately reusing its FFmpeg installation.

## 3. Launch

Double-click **`v2/Start-RetroTV.cmd`**. On first launch it runs `npm ci` if the Electron runtime is missing, then starts the app. The first installation needs internet access to download dependencies. Allow it to finish; it may take longer than later launches.

The launcher is designed to work with bracketed folder names such as `[WORKSPACE]`. No administrator launch is normally needed for the application. Windows may still deny drive labeling; that produces a warning after a successful verified copy.

If a launch fails, keep the console error for troubleshooting. Do not open a second copy to compensate; the application uses a single-instance lock.

## 4. Create or open a project

Choose **New Project**, give it a name, choose its parent folder, and add named source library folders. The app creates a new child folder for that project. It creates managed folders for data, artwork, composites, cache, builds and exports inside it.

For example, your application could be in `C:\RetroTV-App`, your project in `D:\RetroTV-Projects\Weekend-TV`, and your libraries in `D:\Media\TV` and `D:\Media\Commercials`. These are illustrative locations, not required paths.

The project cannot be inside a source library, and a source library cannot be inside the project. Source libraries remain external references; scans do not move or copy their media.

To reopen existing work, choose **Open Project** and select that project's `project.json`. Opening a different project gives you a different set of networks, shows, carts and classifications.

## 5. Select FFmpeg

Open a saved lineup in Studio. Use **CHOOSE FFMPEG** to select the `ffmpeg.exe` in your working installation. `ffprobe.exe` must be alongside it. The app remembers this machine's choice between launches. It is not stored as an executable instruction in a shared project.

If no executable has been chosen, it tries `ffmpeg`/`ffprobe` from PATH. If the selected tools later move or disappear, choose their new location. Test playback and one processed preview before reviewing a large cart.

## Update an existing installation

1. Close the application and wait for any build/copy cleanup to finish.
2. Back up your project. Keep a copy of the working app version or its Git commit.
3. Replace the application files with the new version. Preserve your separate project and source folders.
4. Launch the app and open the **same** `project.json`.
5. Do not regenerate lineups or rerun any old preparation script simply because the app was updated.

If a release changes dependencies, run `npm.cmd ci` from `v2` before relaunching. For paths containing brackets:

```powershell
Set-Location -LiteralPath 'C:\RetroTV-App\v2'
npm.cmd ci
npm.cmd start
```

Use your actual extracted folder in that command. An app Git rollback does not roll back project data; restore a matching project backup if a future data-format change requires it.

## First successful run

Create a small test cart, classify its assets, generate/save its lineup, approve the clips with Good + next, and build locally. Then use an empty cartridge drive for a first verified USB copy and test playback on your device.

The release has 76 automated checks. The project owner has also reported the completed workflow working on their Windows setup. That does not replace checking a new PC's FFmpeg build and physical playback device.

## Download sources

- Node.js: https://nodejs.org/en/download
- FFmpeg Windows-provider links: https://ffmpeg.org/download.html

These links were checked on 2026-11-15. This guide intentionally does not pin a future-changing “latest” download version.
