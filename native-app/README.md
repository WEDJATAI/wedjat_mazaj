# Mazaj native shell (Android APK)

The real, installable Android app — **direct download, no Play Store**.
It is a thin native shell (Capacitor) that loads the live production
platform (`https://wmazaj.vercel.app`): one codebase, one two-way sync
system (offline queue + Background Sync + web push), the same service
worker offline stack as the PWA.

- Package: `com.mazaj.hookah` · versionName follows `public/downloads/app.json`
- Web source: the production deployment (server.url mode) — the APK always
  runs the latest deployed code, no repack needed for web changes.

## Rebuild from a fresh clone

```bash
cd native-app
bun install                      # @capacitor/core, cli, android (7.x)
bunx cap sync android            # regenerates capacitor-cordova-android-plugins/, assets/ and configs (gitignored on purpose)
cd android
export JAVA_HOME=/home/z/jdk-21*           # JDK 21 (javac required — a JRE is NOT enough)
export ANDROID_HOME=/home/z/android-sdk     # platform-tools + platforms;android-35 + build-tools;35.0.0
./gradlew assembleRelease --no-daemon
```

Output: `android/app/build/outputs/apk/release/app-release.apk`.

## Release (publish a new version)

1. Bump `versionCode` + `versionName` in `android/app/build.gradle`.
2. `./gradlew assembleRelease --no-daemon`
3. Copy the APK: `cp app/build/outputs/apk/release/app-release.apk ../../public/downloads/mazaj.apk`
4. Regenerate `public/downloads/app.json` (version, sizeBytes, `sha256sum`, apk path) —
   the install landing reads it to render "vX.Y.Z · N MB".
5. Commit + push — Vercel serves it at `/downloads/mazaj.apk`
   (Content-Type: application/vnd.android.package-archive).

## Signing

`android/app/mazaj-release.keystore` is committed **on purpose**: it is the
distribution keystore for the sideload channel (no Play Store). Every future
build MUST reuse it — same signature = existing installs update in place
instead of forcing an uninstall. Passwords live in `app/build.gradle`
(`signingConfigs.release`).

## Art

Launcher icons + splash screens are regenerated from the brand icon:
`node scripts/make-android-art.mjs` (repo root, uses the root project's sharp).

## Environment note (sandbox)

The Android SDK lives at `/home/z/android-sdk`, the JDK at `/home/z/jdk-21…`.
Both were downloaded into the sandbox this session — if a recycle wipes them,
re-fetch: cmdline-tools from dl.google.com (+ `platform-tools`,
`platforms;android-35`, `build-tools;35.0.0` via sdkmanager) and Temurin JDK 21
from adoptium.net.
