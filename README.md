# ShitSub

**English SRT to natural, colloquial Kerala Malayalam, right in your browser.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-8ff0b8?style=for-the-badge)](https://shitfadi.github.io/Shitsub-1.0/)
![Platforms](https://img.shields.io/badge/Web%20%7C%20iOS%20%7C%20Android-0b0f0d?style=for-the-badge)
![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Gemini-4285F4?style=for-the-badge)

ShitSub translates English subtitle files (`.srt`) into everyday spoken Malayalam using Google's Gemini API. It is a static website with no backend, it keeps your timestamps and numbering exactly as they are, and it can be used as a website, as an iPhone or iPad Home Screen app, and as an Android app.

**Live site:** https://shitfadi.github.io/Shitsub-1.0/

---

## Table of contents

- [Features](#features)
- [Quick start](#quick-start)
- [Install as an app](#install-as-an-app)
- [Translation styles](#translation-styles)
- [How it works](#how-it-works)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [Run locally and deploy](#run-locally-and-deploy)
- [Adding another language](#adding-another-language)
- [Privacy and security](#privacy-and-security)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Credits and disclaimer](#credits-and-disclaimer)

---

## Features

**Translation quality**
- Natural street style Kerala Malayalam instead of textbook wording.
- Malayalam script only. Names, places, brands and abbreviations are written in Malayalam letters too (for example FBI becomes എഫ്ബിഐ), and names are spelled consistently.
- Three translation styles: **18+**, **Family Friendly** and **None**.
- A Custom Prompt box for your own extra instructions, such as character names and their Malayalam spelling. It is added on top of the selected style.
- Original timestamps, numbering, multi line subtitles and HTML tags such as `<i>` are preserved.

**Reliability**
- Every translated line is validated, and problem lines are repaired automatically (see [How it works](#how-it-works)).
- Automatic retries that respect the wait time Google asks for.
- A request timeout, so a hung request is cancelled and retried on its own.
- Saved progress. Finished parts are kept on your device, so if the page closes you can upload the same file again and continue.

**Usability**
- Liquid glass interface with a video background, designed for phones.
- Works as an iPhone and iPad Home Screen app, with a share sheet for saving the result.
- An Android app that saves the SRT straight to Downloads.
- Hamburger menu with the Android APK download, an Add to Home Screen guide for iPhone and iPad, and a Reload App button.
- A **Translate Another File** button, so you never need to close the app to start over.

---

## Quick start

1. Open the [live site](https://shitfadi.github.io/Shitsub-1.0/).
2. Create a free API key in [Google AI Studio](https://aistudio.google.com/), paste it into the **Gemini API Key** box and tap **Save API Key**. It is stored only on your device.
3. Choose your English `.srt` file.
4. Pick a **Translation Style**, and add extra instructions in **Custom Prompt** if you want.
5. Tap **Translate SRT** and wait for the progress bar to finish.
6. Tap **Download Malayalam SRT**. The new file is named `<original name>_Malayalam.srt`.
7. Tap **Translate Another File** to start again.

---

## Install as an app

**iPhone and iPad**

1. Open the site in Safari.
2. Tap the Share button.
3. Tap **Add to Home Screen**, then **Add**.
4. Open ShitSub from your Home Screen. It runs full screen, like an app.

The Home Screen app keeps its own saved settings, so you may need to enter your API key once.

**Android**

1. Open the menu and tap **Download ShitSub App**.
2. Open the downloaded `.apk` file and allow **Install unknown apps** if your phone asks.

---

## Translation styles

The style prompts are stored in `js/presets.js`. They are not shown on the page, and your Custom Prompt is added after the selected style.

| Style | What it does |
|---|---|
| **18+** | Raw street Malayalam. Keeps strong language and uses a vocabulary list of vulgar words and insults, matched to the intensity of the original dialogue. |
| **Family Friendly** | Street style Malayalam without bad words or vulgar language. Insults are turned into mild, everyday expressions. |
| **None** | Only the shared base rules, with no style specific word list. Strong words follow the original dialogue. |

> **Content note:** the 18+ style produces strong language on purpose. Use it only where that is appropriate.

---

## How it works

1. **Parse** the SRT into subtitle blocks (number, timestamp, text).
2. **Split** the file into chunks (200 subtitles by default).
3. **Translate** each chunk with Gemini. Every subtitle gets an ID, and Gemini echoes the first words of each English line so that shifted or merged lines can be detected.
4. **Clean up locally** by removing English that was copied next to the Malayalam.
5. **Fix leftover English words** with one small request that returns only those words in Malayalam letters. The spellings are remembered for the whole file.
6. **Validate** every line:
   - missing or shifted lines
   - letters from the wrong script
   - English letters left in the translation
   - broken HTML tags, numbers or URLs
   - suspicious duplicate translations
   - stray digits inside a word
7. **Recover** problem lines with a targeted batch request, then a last attempt that translates the English line on its own. A line that cannot be fixed is kept, with a warning in the browser console, so one stubborn line never stops the whole file.
8. **Rebuild** the SRT with the original numbers and timestamps, and save it with a UTF-8 BOM so Malayalam displays correctly in players.

Several chunks run in parallel. Finished chunks are saved on the device, and a saved copy is ignored if the file, style or prompt changes, or if it is older than 24 hours.

---

## Configuration

Settings live in `js/config.js`.

| Setting | Default | Description |
|---|---|---|
| `MODEL` and `API_URL` | `gemini-3.5-flash-lite` | The Gemini model and its endpoint. |
| `TARGET_LANGUAGE` | `"malayalam"` | Which entry of the `LANGUAGES` table to translate into. |
| `CHUNK_SIZE` | `200` | Subtitles per request. |
| `MAX_PARALLEL` | `3` | Chunks translated at the same time. |
| `BATCH_DELAY` | `12500` | Pause in milliseconds between rounds of chunks. |
| `MAX_RETRIES` | `5` | Attempts per chunk before it is reported as failed. |
| `INITIAL_RETRY_DELAY` | `5000` | First wait in milliseconds before a retry. It doubles each time. |
| `MAX_RETRY_DELAY` | `120000` | The longest single wait in milliseconds. |
| `REQUEST_TIMEOUT` | `120000` (optional) | How long one request may take before it is cancelled and retried. |

**Rate limits:** the free tier has per minute and per day limits that depend on the model. Check the limits for your model in Google AI Studio. If you see too many requests errors, lower `MAX_PARALLEL`. Remember that some chunks also use extra requests for the fixes described above.

---

## Project structure

```
.
├── index.html            Page markup
├── manifest.json         Web app manifest
├── sw.js                 Service worker (caches the background video)
├── assets/               Background video and app icons
├── downloads/
│   └── ShitSub.apk       Android app (shown in the menu)
├── css/
│   ├── style.css         Main glass interface styles
│   └── presets.css       Style presets, menu card and extra button styles
└── js/
    ├── config.js         Settings and the LANGUAGES table
    ├── presets.js        18+, Family Friendly and None prompts
    ├── srt-parser.js     SRT parsing and rebuilding
    ├── gemini-api.js     Requests, validation, recovery, retries, saved progress
    ├── translator.js     Chunking and the translation flow
    └── app.js            Page logic and user interface
```

The Android app is a small WebView wrapper (`MainActivity.java`). It loads the hosted site and adds a bridge that saves the finished SRT to the Downloads folder.

---

## Run locally and deploy

The project is plain HTML, CSS and JavaScript with no build step.

```bash
git clone https://github.com/shitfadi/Shitsub-1.0.git
cd Shitsub-1.0
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Use a local server rather than opening `index.html` directly, because the service worker and some browser features need `http` or `https`.

**Deploy with GitHub Pages:** open **Settings → Pages**, choose **Deploy from a branch**, select your branch and the root folder, and save.

After you change a script or stylesheet, increase its `?v=` number in `index.html` so browsers load the new file instead of a cached copy.

---

## Adding another language

The code is ready for more languages. Add an entry to the `LANGUAGES` table in `js/config.js`:

| Field | Purpose |
|---|---|
| `name` | The language name used inside prompts. |
| `dialect` | The kind of spoken language you want. |
| `style` | Extra flavour instructions. It can be empty. |
| `script` | A Unicode script name used by the checks, such as `Devanagari` or `Tamil`. |
| `latinAllowed` | `true` only for languages written in Latin letters. It switches off the no English letters checks. |
| `examples` | Short samples of English words written in the target language, used for names. |
| `prompt` | The full default prompt for the language. |

Then set `TARGET_LANGUAGE` to the new key. If the language has no entry in `js/presets.js`, the Translation Style card is hidden and the language's own default prompt is used. The Custom Prompt text is saved separately for each language.

---

## Privacy and security

- There is no ShitSub server. Your browser sends subtitle text directly to Google's Gemini API. Please read Google's terms for how the API handles that data.
- Your API key is saved in your browser's local storage on your device and is not sent anywhere except to Google with each request.
- Saved progress, your style choice and your Custom Prompt are also stored locally on your device.
- Anyone who can use your browser profile or phone can read the saved key. Use your own key, and do not publish a build that has a key inside it.

---

## Troubleshooting

| Problem | What to try |
|---|---|
| The progress bar stays still for a while | The bar moves when a group of chunks finishes. Requests that hang are cancelled after the timeout and retried, and rate limit waits end on their own. Wait a couple of minutes before restarting. |
| It stopped partway | Open the menu and tap **Reload App**, then upload the same file again with the same style and prompt. Finished parts are reused. |
| Too many requests errors | Lower `MAX_PARALLEL` in `js/config.js`, or check your model's limits in Google AI Studio. |
| An English word or name was translated into a Malayalam word you do not want | Add the word and the spelling you want to **Custom Prompt**, for example `operation = ഓപ്പറേഷൻ`. |
| The saved key is missing on iPhone | The Home Screen app keeps separate storage from Safari. Enter the key once in the app. |
| Changes do not show after an update | Tap **Reload App**, or increase the `?v=` numbers in `index.html`. |

---

## Roadmap

- Batch translation: several SRT files (episodes) in one run, up to 10.
- More target languages, using the existing `LANGUAGES` table.

---

## Credits and disclaimer

Created by Fadi ([@shitfadi](https://github.com/shitfadi)). Translations are generated with Google's Gemini API. ShitSub is an independent project and is not affiliated with Google.

AI translations can contain mistakes, so review the result before you use it. Only translate subtitle files that you have the right to use.
