# App-local Library media backend

The Library Manager selects the exact pair in `media-backend.json`. Paths are relative to this directory, so moving the complete application folder does not require a private user-specific path. Runtime selection does not change global/user PATH or the original Studio's backend.

## Selected candidate

- Vendor: **BtbN**, linked from <https://ffmpeg.org/download.html>.
- Version: **n8.1.3-25-g611cec792a-20261029**, maintained 8.1 branch, not the newest major.
- Source commit: <https://github.com/FFmpeg/FFmpeg/commit/611cec792aa54e2e53dbc1be95dcf5955d9a99ba>.
- Archive: <https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-10-29-19-17/ffmpeg-n8.1.3-25-g611cec792a-win64-gpl-8.1.zip>.
- Published/archive SHA-256: `ae96349b271366b9df137cfe175aef1382186e11e74da6e25e489521da552f5d`.
- ffmpeg SHA-256: `d08357b3e0d05cb18e06b1a3f62978277dc6809d862af0b06403395f5135ca7c`.
- ffprobe SHA-256: `ee9624a74d2492b4b97fe116560c987ad733b68b0e3916a8c2c895c38d78bf61`.
- Architecture: AMD64. Authenticode: **unsigned**; Windows version resources absent. HTTPS/vendor-checksum/exact-byte validation is not a publisher signature.

The installed 9.0.1 build, Gyan 9.0.2 and tested current master all reproduced a native `anlmdn` crash on the selected STRONG fixture. This candidate passed all five unchanged repair levels three times each, plus SAR/crop/trim/Unicode/composite/silent-source/profile/full-decode cases. These are synthetic compatibility tests, not subjective listening or TV acceptance. Full application validation is recorded separately.

## Local files and recovery

The complete verified extraction is retained in `btbn-8.1-20261029/`; its `LICENSE.txt` is included. The exact ZIP is retained in `packages/` because daily release links have retention limits. Download, member-hash and native test receipts are retained in `evidence/`. These payloads are intentionally ignored by Git; the manifest and this guide are source-controlled candidates, not a claim that a clean source clone contains the binaries.

A present but missing/corrupt/unsupported pin fails closed. Do not replace only one executable, loosen its checksum or silently fall back to a different backend. Restore the exact verified archive and pair in a fresh owned runtime directory, then verify the manifest hashes. Normal Library tasks do not require editing this file or invoking PowerShell.

The final public installer/bootstrap and dependency distribution package remain Phase 6 work. Before publishing a binary release, assemble the required corresponding sources/build information for FFmpeg and bundled dependencies and complete GPL compliance review. The retained GPLv3 license and a source-commit URL alone are **not** a completed distribution-compliance package. Do not publish this development runtime folder as an approved release.
