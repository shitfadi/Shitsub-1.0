# ShitSub — Android TV / Google TV app

A WebView wrapper around your Malayalam SRT Translator, packaged for **Google TV / Android TV**, styled in Netflix Red (`#E50914`) on white.

## What's included
- `app/src/main/assets/index.html` — your app, restyled (red/white, TV-friendly focus states). Functionality is unchanged: the **Remember this key** and **Remember these instructions** tick options still work exactly as before, saved to on-device storage (`localStorage`, via Android's `DomStorage`).
- `MainActivity.java` — loads the page in a full-screen WebView and (importantly) implements `onShowFileChooser`, so the "Upload English SRT" button actually opens a file picker on Android TV — this step is missing in most quick WebView wrappers and is the most common reason file-upload buttons silently do nothing in a TV WebView app.
- App icon + round icon + adaptive icon, in all 5 densities (mdpi → xxxhdpi).
- TV banner (16:9, 320×180 baseline, all densities) — required by Android TV OS for the home-screen launcher row.
- `AndroidManifest.xml` declares `LEANBACK_LAUNCHER` and `android.hardware.touchscreen required="false"`, which is what makes the app installable and visible on Google TV in the first place — without these two lines the Play-side/Android system won't surface it as a TV app at all.
- A GitHub Actions workflow that builds a debug `.apk` automatically.

## Icon/banner standard used (per Android's official TV design guidelines)
| Asset | Aspect | mdpi | hdpi | xhdpi | xxhdpi | xxxhdpi |
|---|---|---|---|---|---|---|
| Banner (`android:banner`) | 16:9 | 160×90 | 240×135 | 320×180 | 480×270 | 640×360 |
| Launcher icon | 1:1 | 80×80 | 120×120 | 160×160 | 240×240 | 320×320 |

Both `android:icon` and `android:banner` are set in the manifest (both are mandatory for a bug-free TV listing — a missing banner is the #1 reason apps get rejected from showing on the Google TV home screen).

## Build option 1 — GitHub Actions (no local install needed)
1. Create a new GitHub repo and push everything in this folder to it.
2. Go to the repo's **Actions** tab — a build starts automatically (or click **Run workflow** to trigger it manually).
3. When it finishes, open the run and download the **ShitSub-debug-apk** artifact — that's your installable `.apk`.

## Build option 2 — Android Studio (local)
1. Open this folder as a project in Android Studio (it will offer to create the Gradle wrapper automatically the first time).
2. Let it sync, then **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. Find the `.apk` under `app/build/outputs/apk/debug/`.

## Installing on your Google TV device
- Enable **Developer options → USB debugging** on the TV (Settings → System → About → click "Android TV OS build" 7 times).
- `adb connect <tv-ip-address>:5555`
- `adb install app-debug.apk`
- Or side-load via a file manager app / USB drive if you prefer not to use `adb`.

## Notes
- This app requires no `INTERNET`-blocked features — it calls the Gemini API directly from the WebView, same as it did in the browser.
- `usesCleartextTraffic` is set to `false` since the Gemini API is HTTPS-only; no changes needed there.
- If you want the launcher icon's "S" mark replaced with a different mark or your own artwork, swap the files in `app/src/main/res/mipmap-*/` and `app/src/main/res/drawable/ic_launcher_*` and keep the same filenames/sizes.
