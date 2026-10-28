/* =========================================================
   SHITSUB - Main Application
========================================================= */

// =========================================================
// DOM ELEMENTS
// =========================================================

const apiKeyInput = document.getElementById("apiKey");
const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
const editApiKeyBtn = document.getElementById("editApiKeyBtn");
const apiKeyStatus = document.getElementById("apiKeyStatus");

const srtFile = document.getElementById("srtFile");
const fileName = document.getElementById("fileName");

const editPromptBtn = document.getElementById("editPromptBtn");
const savePromptBtn = document.getElementById("savePromptBtn");
const promptEditor = document.getElementById("promptEditor");
const customPrompt = document.getElementById("customPrompt");

const styleCard = document.getElementById("styleCard");
const presetButtons = document.querySelectorAll(".preset-btn");
const presetHint = document.getElementById("presetHint");

const translateBtn = document.getElementById("translateBtn");
const mainError = document.getElementById("mainError");

const statusCard = document.getElementById("statusCard");
const statusText = document.getElementById("statusText");
const progressBar = document.getElementById("progressBar");
const progressPercent = document.getElementById("progressPercent");
const activityText = document.getElementById("activityText");

const resultCard = document.getElementById("resultCard");
const resultInfo = document.getElementById("resultInfo");
const downloadBtn = document.getElementById("downloadBtn");
const newFileBtn = document.getElementById("newFileBtn");

const menuBtn = document.getElementById("menuBtn");
const menuBackdrop = document.getElementById("menuBackdrop");
const sideMenu = document.getElementById("sideMenu");
const menuCloseBtn = document.getElementById("menuCloseBtn");
const reloadBtn = document.getElementById("reloadBtn");

// =========================================================
// STATE
// =========================================================

let outputText = "";
let outputName = "";

// Selected translation style (for example 18+ or Family Friendly)
let selectedPreset = DEFAULT_PRESET;

// =========================================================
// INITIALIZATION
// =========================================================

function init() {
    loadSavedSettings();
    setupEventListeners();

    if (apiKeyInput && !apiKeyInput.disabled) {
        apiKeyInput.focus();
    }

    if (promptEditor) {
        promptEditor.style.display = "none";
    }

    if (statusCard) {
        statusCard.style.display = "none";
    }

    if (resultCard) {
        resultCard.style.display = "none";
    }

    if (progressBar) {
        progressBar.style.width = "0%";
    }

    if (progressPercent) {
        progressPercent.textContent = "0%";
    }
}

// =========================================================
// LOAD SAVED SETTINGS
// =========================================================

function loadSavedSettings() {
    loadSavedApiKey();

    // The Custom Prompt box holds only the user's EXTRA instructions.
    // They are saved per language under their own key (getCustomPromptKey),
    // so an old saved full prompt can never fight with the selected style.
    customPrompt.value =
        localStorage.getItem(getCustomPromptKey()) || "";

    setupStylePresets();
}

// =========================================================
// API KEY
// =========================================================

function loadSavedApiKey() {
    const savedApiKey = localStorage.getItem(
        CONFIG.STORAGE_KEYS.API_KEY
    );

    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        apiKeyInput.disabled = true;
        saveApiKeyBtn.style.display = "none";
        editApiKeyBtn.style.display = "block";
        apiKeyStatus.textContent = "API key saved on this device.";
    }
    else {
        apiKeyInput.disabled = false;
        saveApiKeyBtn.style.display = "block";
        editApiKeyBtn.style.display = "none";
        apiKeyStatus.textContent = "";
    }
}

// =========================================================
// SAVE API KEY
// =========================================================

function handleSaveApiKey() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        apiKeyStatus.textContent = "Please enter your Gemini API key.";
        apiKeyInput.focus();
        return;
    }

    localStorage.setItem(
        CONFIG.STORAGE_KEYS.API_KEY,
        apiKey
    );

    apiKeyInput.disabled = true;
    saveApiKeyBtn.style.display = "none";
    editApiKeyBtn.style.display = "block";
    apiKeyStatus.textContent = "API key saved on this device.";
}

// =========================================================
// EDIT API KEY
// =========================================================

function handleEditApiKey() {
    apiKeyInput.disabled = false;
    apiKeyInput.focus();
    saveApiKeyBtn.style.display = "block";
    editApiKeyBtn.style.display = "none";
    apiKeyStatus.textContent = "Edit your API key and save it again.";
}

// =========================================================
// EVENT LISTENERS
// =========================================================

function setupEventListeners() {
    saveApiKeyBtn.addEventListener("click", handleSaveApiKey);
    editApiKeyBtn.addEventListener("click", handleEditApiKey);
    srtFile.addEventListener("change", handleFileSelection);
    editPromptBtn.addEventListener("click", handleEditPrompt);
    savePromptBtn.addEventListener("click", handleSavePrompt);
    translateBtn.addEventListener("click", handleTranslate);
    downloadBtn.addEventListener("click", handleDownload);
    newFileBtn.addEventListener("click", handleNewFile);
    document.addEventListener("keydown", handleKeyboardNavigation);

    // Style presets
    presetButtons.forEach((button) => {
        button.addEventListener("click", () => {
            selectPreset(button.dataset.preset, true);
        });
    });

    // Hamburger menu
    menuBtn.addEventListener("click", toggleMenu);
    menuCloseBtn.addEventListener("click", closeMenu);
    reloadBtn.addEventListener("click", handleReload);
    menuBackdrop.addEventListener("click", closeMenu);

    sideMenu.querySelectorAll(".menu-item").forEach((item) => {
        item.addEventListener("click", () => {
            setTimeout(closeMenu, 300);
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeMenu();
        }
    });
}

// =========================================================
// HAMBURGER MENU
// =========================================================

function openMenu() {
    sideMenu.classList.add("open");
    menuBackdrop.classList.add("open");
    menuBtn.classList.add("open");
    menuBtn.setAttribute("aria-expanded", "true");
    sideMenu.setAttribute("aria-hidden", "false");
}

function closeMenu() {
    sideMenu.classList.remove("open");
    menuBackdrop.classList.remove("open");
    menuBtn.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
    sideMenu.setAttribute("aria-hidden", "true");
}

function toggleMenu() {
    if (sideMenu.classList.contains("open")) {
        closeMenu();
    }
    else {
        openMenu();
    }
}

// Reloads the page for a fresh start. The API key, style choice and saved
// prompt live in localStorage, so they are kept, and finished translation
// parts are kept too (saved progress). The changing ?r= value makes the
// browser fetch the page again instead of reusing an old copy.
function handleReload() {
    closeMenu();

    setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("r", String(Date.now()));
        window.location.replace(url.toString());
    }, 150);
}

// =========================================================
// STYLE PRESETS (18+ / Family Friendly)
// =========================================================

function setupStylePresets() {

    const presets = getStylePresets();

    // A language without presets simply hides the style card
    if (!presets) {

        selectedPreset = null;

        if (styleCard) {
            styleCard.style.display = "none";
        }

        return;
    }

    if (styleCard) {
        styleCard.style.display = "";
    }

    const saved = localStorage.getItem(getPresetStorageKey());

    selectPreset(
        presets[saved] ? saved : DEFAULT_PRESET,
        false
    );
}

function selectPreset(presetId, save) {

    const presets = getStylePresets();

    if (!presets) {
        return;
    }

    if (!presets[presetId]) {
        presetId = DEFAULT_PRESET;
    }

    selectedPreset = presetId;

    presetButtons.forEach((button) => {
        const active = button.dataset.preset === presetId;

        button.classList.toggle("active", active);
        button.setAttribute("aria-checked", active ? "true" : "false");
    });

    if (presetHint) {
        presetHint.textContent = presets[presetId].hint;
    }

    if (save) {
        localStorage.setItem(getPresetStorageKey(), presetId);
    }
}

// =========================================================
// FILE SELECTION
// =========================================================

function handleFileSelection() {
    if (srtFile.files && srtFile.files.length > 0) {
        fileName.textContent = srtFile.files[0].name;
        fileName.style.color = "var(--success)";
    }
    else {
        fileName.textContent = "No file selected.";
        fileName.style.color = "var(--muted)";
    }
}

// =========================================================
// START ANOTHER TRANSLATION
// =========================================================

function handleNewFile() {
    if (Translator.isTranslating) {
        return;
    }

    outputText = "";
    outputName = "";

    // Clearing the value also lets the same file be picked again
    srtFile.value = "";
    handleFileSelection();

    mainError.textContent = "";
    resultInfo.innerHTML = "";
    resultCard.style.display = "none";
    statusCard.style.display = "none";

    progressBar.style.width = "0%";
    progressPercent.textContent = "0%";
    statusText.textContent = "Getting your subtitles ready...";
    activityText.textContent = "Reading subtitles...";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// =========================================================
// CUSTOM PROMPT
// =========================================================

function handleEditPrompt() {
    promptEditor.style.display = "block";
    editPromptBtn.style.display = "none";
    customPrompt.focus();
}

function handleSavePrompt() {
    customPrompt.value = customPrompt.value.trim();

    localStorage.setItem(
        getCustomPromptKey(),
        customPrompt.value
    );

    promptEditor.style.display = "none";
    editPromptBtn.style.display = "block";
}

// =========================================================
// FRIENDLY PROGRESS MESSAGES
// =========================================================

function getFriendlyProgressMessage(percent, total, message) {
    if (percent < 10) {
        return "Getting your subtitles ready...";
    }

    if (percent < 20) {
        return "Preparing translation...";
    }

    if (percent < 95) {
        return "Translating your subtitles...";
    }

    if (percent < 100) {
        return "Almost finished...";
    }

    return "Translation complete!";
}

function getActivityMessage(percent, total, message) {
    if (percent < 10) {
        return "Reading subtitles...";
    }

    if (percent < 20) {
        return "Preparing translation...";
    }

    if (percent < 95) {
        return "Gemini is translating...";
    }

    if (percent < 100) {
        return "Finishing your subtitles...";
    }

    return "Ready to download";
}

// =========================================================
// TRANSLATE
// =========================================================

async function handleTranslate() {
    if (Translator.isTranslating) {
        return;
    }

    mainError.textContent = "";
    resultCard.style.display = "none";

    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showError("Please enter your Gemini API key.");
        apiKeyInput.focus();
        return;
    }

    if (!srtFile.files || srtFile.files.length === 0) {
        showError("Please select an English SRT file.");
        srtFile.focus();
        return;
    }

    // Selected style + the user's own extra instructions
    const finalPrompt = buildFinalPrompt(
        selectedPreset,
        customPrompt.value
    );

    // Disable button while translating
    translateBtn.disabled = true;
    translateBtn.textContent = "Translating...";

    // Reset progress
    if (progressBar) {
        progressBar.style.width = "0%";
    }

    if (progressPercent) {
        progressPercent.textContent = "0%";
    }

    if (statusText) {
        statusText.textContent = "Getting your subtitles ready...";
    }

    if (activityText) {
        activityText.textContent = "Reading subtitles...";
    }

    statusCard.style.display = "block";

    // Show waiting and resume notes from the Gemini code in the activity line
    GeminiAPI.onStatus = (text) => {
        if (activityText) {
            activityText.textContent = text;
        }
    };

    try {
        const file = srtFile.files[0];

        const result = await Translator.translateFile(
            file,
            apiKey,
            finalPrompt,
            (percent, total, message) => {
                const safePercent = Math.max(
                    0,
                    Math.min(
                        100,
                        Number(percent) || 0
                    )
                );

                progressBar.style.width = `${safePercent}%`;

                if (progressPercent) {
                    progressPercent.textContent = `${safePercent}%`;
                }

                if (statusText) {
                    statusText.textContent = getFriendlyProgressMessage(
                        safePercent,
                        total,
                        message
                    );
                }

                if (activityText) {
                    activityText.textContent = getActivityMessage(
                        safePercent,
                        total,
                        message
                    );
                }
            }
        );

        // Store output
        outputText = result.outputText;
        outputName = result.outputName;

        // Complete progress
        if (progressBar) {
            progressBar.style.width = "100%";
        }

        if (progressPercent) {
            progressPercent.textContent = "100%";
        }

        if (statusText) {
            statusText.textContent = "Translation complete!";
        }

        if (activityText) {
            activityText.textContent = "Ready to download";
        }

        // Success information
        const count = Number(result.totalSubtitles) || 0;
        const label = count === 1 ? "subtitle" : "subtitles";

        resultInfo.innerHTML = `
            <div class="result-summary">
                <div class="result-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 13l4 4L19 7"/>
                    </svg>
                </div>
                <div>
                    <div class="result-title">
                        <span class="result-count">${count}</span> ${label} translated
                    </div>
                    <div class="result-sub">
                        Your Malayalam SRT is ready to download
                    </div>
                </div>
            </div>
            <div class="result-file">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
                    <path d="M14 3v5h5"/>
                </svg>
                <span>${escapeHTML(outputName)}</span>
            </div>
        `;

        resultCard.style.display = "block";

        setTimeout(() => {
            resultCard.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }, 200);
    }
    catch (error) {
        console.error(error);

        showError(
            error?.message ||
            "Translation failed. Please try again."
        );

        if (statusText) {
            statusText.textContent = "Translation failed.";
        }

        if (activityText) {
            activityText.textContent = "Something went wrong.";
        }
    }
    finally {
        GeminiAPI.onStatus = null;
        translateBtn.disabled = false;
        translateBtn.textContent = "Translate SRT";
    }
}

// =========================================================
// DOWNLOAD
// =========================================================

function handleDownload() {
    if (!outputText) {
        return;
    }

    // UTF-8 BOM for Malayalam
    const textWithBom = "\uFEFF" + outputText;

    // Android WebView download handler
    if (
        typeof AndroidDownload !== "undefined" &&
        typeof AndroidDownload.saveSrt === "function"
    ) {
        try {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(textWithBom);

            let binary = "";
            const chunkSize = 0x8000;

            for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(
                    i,
                    Math.min(i + chunkSize, bytes.length)
                );

                binary += String.fromCharCode(...chunk);
            }

            const base64 = btoa(binary);

            AndroidDownload.saveSrt(base64, outputName);

            showDownloadNote();

            return;
        }
        catch (error) {
            console.error("Android download failed:", error);
        }
    }

    // Standard browser download
    try {
        const blob = new Blob(
            [textWithBom],
            { type: "application/x-subrip;charset=utf-8" }
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = outputName;
        a.style.display = "none";

        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        showDownloadNote();
    }
    catch (error) {
        console.error(error);
        showError("Could not download the SRT file.");
    }
}

// =========================================================
// KEYBOARD NAVIGATION
// =========================================================

function handleKeyboardNavigation(e) {
    // Escape / Android Back
    if (e.key === "Escape" || e.key === "Back") {
        if (promptEditor.style.display === "block") {
            promptEditor.style.display = "none";
            editPromptBtn.style.display = "block";
            editPromptBtn.focus();
            e.preventDefault();
        }
    }

    // Enter key
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
        if (document.activeElement === apiKeyInput) {
            srtFile.focus();
            e.preventDefault();
        }
    }
}

// =========================================================
// UTILITIES
// =========================================================

function showError(message) {
    mainError.textContent = message;
}

function showDownloadNote() {
    const old = resultInfo.querySelector(".result-note");

    if (old) {
        old.remove();
    }

    resultInfo.insertAdjacentHTML(
        "beforeend",
        '<div class="result-note">Download started</div>'
    );
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =========================================================
// START APPLICATION
// =========================================================

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
}
else {
    init();
}
