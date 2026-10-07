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

// =========================================================
// STATE
// =========================================================

let outputText = "";
let outputName = "";

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

    const savedPrompt = localStorage.getItem(
        CONFIG.STORAGE_KEYS.CUSTOM_PROMPT
    );

    customPrompt.value = savedPrompt || DEFAULT_PROMPT;
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
    document.addEventListener("keydown", handleKeyboardNavigation);
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
// CUSTOM PROMPT
// =========================================================

function handleEditPrompt() {
    promptEditor.style.display = "block";
    editPromptBtn.style.display = "none";
    customPrompt.focus();
}

function handleSavePrompt() {
    const prompt = customPrompt.value.trim();

    if (!prompt) {
        customPrompt.value = DEFAULT_PROMPT;
    }

    localStorage.setItem(
        CONFIG.STORAGE_KEYS.CUSTOM_PROMPT,
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

    const prompt = customPrompt.value.trim();

    if (!prompt) {
        customPrompt.value = DEFAULT_PROMPT;

        localStorage.setItem(
            CONFIG.STORAGE_KEYS.CUSTOM_PROMPT,
            DEFAULT_PROMPT
        );
    }

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

    try {
        const file = srtFile.files[0];

        const result = await Translator.translateFile(
            file,
            apiKey,
            customPrompt.value,
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
        resultInfo.innerHTML = `
            <div class="success">
                ✅ ${result.totalSubtitles}
                subtitles translated successfully!
            </div>
            <div style="margin-top:8px; color:var(--text);">
                File:
                <strong>${escapeHTML(outputName)}</strong>
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

            resultInfo.innerHTML += `
                <div class="success" style="margin-top:12px;">
                    ✅ Downloaded to:
                    ${escapeHTML(outputName)}
                </div>
            `;

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

        resultInfo.innerHTML += `
            <div class="success" style="margin-top:12px;">
                ✅ Downloaded to:
                ${escapeHTML(outputName)}
            </div>
        `;
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
