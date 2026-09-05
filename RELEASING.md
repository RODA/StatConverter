# Releasing StatConverter

Every download lives in the `latest` release of this repository, which is also the
generic update feed the app reads. One other release exists, `macos-intel-staging`: a
prerelease holding the signed-but-not-yet-notarized Intel build between the CI lane that
produces it and the release machine that notarizes it. Nothing in it is meant to be
downloaded by users.

Each architecture has its own channel file, so the two macOS builds never overwrite
each other:

| Channel file | Built by | Read by |
| --- | --- | --- |
| `latest-x64-mac.yml` | GitHub Actions (`build MacOS Intel`) | Intel Macs |
| `latest-arm64-mac.yml` | a local `npm run dist:sign` | Apple Silicon Macs |
| `latest-x64.yml` | GitHub Actions (`build Windows Intel`) | Windows |
| `latest-x64-linux.yml` | GitHub Actions (`build Linux Intel`) | Linux |

## Download names carry no version

`StatConverter_silicon.dmg`, `StatConverter_intel.dmg`, `StatConverter_setup_intel.exe`,
`StatConverter_intel.exe`, `StatConverter_intel.AppImage`. Gatekeeper and SmartScreen
accumulate reputation per file, so a name that stays the same across releases keeps the
trust it has already earned, and the links on the download page never need editing. The
version is still in the app itself and in the update metadata; only the file names drop
it. The `.deb` is the exception — Debian tooling expects `name_version_arch.deb`, so it
keeps electron-builder's name.

## Local builds

- `npm run dist` — unsigned build, for testing. It skips code signing entirely.
- `npm run dist:sign` — signed build, the first step of a macOS release.

Neither renames anything. The CI lanes run `npm run rename:*` as their own step; a local
macOS release renames in the sequence below, immediately before the notarization steps
that look the renamed disk images up.

## The screenshot on the site

`docs/images/StatConverter.png` shows the version in the app's sidebar, so it goes stale
every release. `npm run capture:screenshot` launches the packaged application, waits for
its window, photographs it with `screencapture` — which keeps the title bar, rounded
corners and drop shadow the existing image has — quits the app, and replaces the file.
It only overwrites the published image once a capture has actually succeeded.

It needs a packaged build in `build/output` (so run it after `npm run dist:sign`, or
after a plain `npm run dist`), macOS, and Screen Recording permission for the terminal
running it; without that permission `screencapture` refuses and the script says so.
`--app <path>`, `--out <path>`, `--delay <seconds>` and `--no-shadow` are available if
the defaults do not suit. Look at the result before committing it.

## macOS release

Notarization runs here rather than in CI, because the notary credentials live in a
keychain profile on this machine (`developer-id-notary`, or whatever
`STATCONVERTER_NOTARY_PROFILE` names). Both architectures are notarized in one pass, so
the Intel build produced by GitHub Actions is pulled back down first.

1. Run the **build MacOS Intel** workflow and let it finish. It signs the Intel build,
   checks it is ready for the notary, and uploads it to the `macos-intel-staging`
   prerelease, creating that release on its first run. Nothing reaches the download
   release until step 9.
2. `npm run dist:sign` — builds and signs Apple Silicon locally.
3. `npm run capture:screenshot` — refreshes the site screenshot from the build you
   just made, so the version in its sidebar matches the release.
4. `npm run verify:mac-signing` — every Mach-O file must carry a Developer ID
   signature, the hardened runtime and a secure timestamp. The bundled R runtime is
   relocated with `install_name_tool`, which invalidates signatures, so this catches an
   ad-hoc binary before the notary does.
5. `npm run rename:mac` — produces `StatConverter_silicon.dmg`, the name the download
   page links to.
6. `npm run fetch:intel` — downloads the Intel disk image, updater ZIP and
   `latest-x64-mac.yml` from the staging release, and expands the ZIP into
   `build/output/mac` so the Intel app can be stapled too.
7. `npm run submit` — submits both disk images and waits for a verdict.
   `npm run history` shows the last couple of submissions. To re-submit one
   architecture without uploading the other again, name it: `npm run submit -- silicon`.
   Both disk images have to be present by then, or the step stops and says which is
   missing — notarizing one and discovering the other has no ticket only at the stapling
   step wastes a round trip.
8. `npm run staple` — staples both apps and both disk images, then rebuilds each
   updater ZIP from its own stapled app and rewrites the checksum in the matching
   `latest-<arch>-mac.yml`. Without this an update would install an app whose ticket has
   to be fetched from Apple, which fails offline.
9. `npm run publish` — uploads the disk images and both update channels to the `latest`
   release, which is the first time this build is reachable by users. It refuses to
   upload a disk image that is not stapled. `npm run publish -- --dry-run` lists what
   would be uploaded and checks every link on the download page against the release as
   it will be afterwards, which is worth a look before the upload itself.

The repository and the two tags can be overridden with `SC_PUBLISH_REPO`,
`SC_STAGING_TAG` and `SC_PUBLISH_TAG`.

## Windows and Linux

Both are fully automated: they are signed and complete as they leave CI, so they go
straight to the `latest` release. Run the **build Windows Intel** and **build Linux
Intel** workflows, or **build binaries**, which runs all three lanes and then publishes
Linux and Windows to `latest` and macOS Intel to staging.

Each lane publishes on its own: if one platform fails to build, the platforms that built
cleanly are still published, and the run is marked failed by the lane that failed. The
run summary lists which platforms were published and which were not, so a partial
release is visible without digging through the release assets.
Windows artifacts are signed with Azure Trusted Signing after packaging, so
`npm run refresh:update-metadata` re-pairs the channel with the signed installer and
regenerates its blockmap.

## Before tagging a release

`npm run verify:update` checks that the update UI, the per-architecture channels, the
build scripts and the workflows still agree with each other.
