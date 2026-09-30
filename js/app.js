/* =========================================================
   SHITSUB - Main Application
   ========================================================= */

// DOM Elements
const apiKeyInput = document.getElementById("apiKey");
const rememberKey = document.getElementById("rememberKey");
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
const resultCard = document.getElementById("resultCard");
const resultInfo = document.getElementById("resultInfo");
const downloadBtn = document.getElementById("downloadBtn");

// State
let outputText = "";
let outputName = "";

/* =========================================================
   INITIALIZATION
   ========================================================= */

function init() {
    // Load saved settings
    loadSavedSettings();

    // Setup event listeners
    setupEventListeners();

    // Auto-focus first input
    apiKeyInput.focus();

    // Initial UI state
    promptEditor.style.display = "none";
    statusCard.style.display = "none";
    resultCard.style.display = "none";
}

/* =========================================================
   LOAD SAVED SETTINGS
   ========================================================= */

function loadSavedSettings() {
    // Load API key
    const savedApiKey = localStorage.getItem(CONFIG.STORAGE_KEYS.API_KEY);
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        rememberKey.checked = true;
    }

    // Load custom prompt
    const savedPrompt = localStorage.getItem(CONFIG.STORAGE_KEYS.CUSTOM_PROMPT);
    customPrompt.value = savedPrompt || DEFAULT_PROMPT;
}

/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEventListeners() {
    // Remember API key checkbox
    rememberKey.addEventListener("change", handleRememberKeyChange);
    apiKeyInput.addEventListener("input", handleApiKeyInput);

    // File selection
    srtFile.addEventListener("change", handleFileSelection);

    // Custom prompt
    editPromptBtn.addEventListener("click", handleEditPrompt);
    savePromptBtn.addEventListener("click", handleSavePrompt);

    // Translate button
    translateBtn.addEventListener("click", handleTranslate);

    // Download button
    downloadBtn.addEventListener("click", handleDownload);

    // Keyboard navigation
    document.addEventListener("keydown", handleKeyboardNavigation);
}

/* =========================================================
   REMEMBER API KEY
   ========================================================= */

function handleRememberKeyChange() {
    if (rememberKey.checked) {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.API_KEY, apiKey);
        }
    } else {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.API_KEY);
    }
}

function handleApiKeyInput() {
    if (rememberKey.checked) {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.API_KEY, apiKey);
        }
    }
}

/* =========================================================
   FILE SELECTION
   ========================================================= */

function handleFileSelection() {
    if (srtFile.files && srtFile.files.length > 0) {
        fileName.textContent = srtFile.files[0].name;
        fileName.style.color = "var(--success)";
    } else {
        fileName.textContent = "No file selected.";
        fileName.style.color = "var(--muted)";
    }
}

/* =========================================================
   CUSTOM PROMPT
   ========================================================= */

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
    localStorage.setItem(CONFIG.STORAGE_KEYS.CUSTOM_PROMPT, customPrompt.value);
    promptEditor.style.display = "none";
    editPromptBtn.style.display = "block";
}

/* =========================================================
   TRANSLATE
   ========================================================= */

async function handleTranslate() {
    if (Translator.isTranslating) {
        return;
    }

    // Clear previous errors/results
    mainError.textContent = "";
    resultCard.style.display = "none";

    // Validate API key
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showError("Please enter your Gemini API key.");
        apiKeyInput.focus();
        return;
    }

    // Validate file
    if (!srtFile.files || srtFile.files.length === 0) {
        showError("Please select an English SRT file.");
        srtFile.focus();
        return;
    }

    // Validate prompt
    const prompt = customPrompt.value.trim();
    if (!prompt) {
        customPrompt.value = DEFAULT_PROMPT;
        localStorage.setItem(CONFIG.STORAGE_KEYS.CUSTOM_PROMPT, DEFAULT_PROMPT);
    }

    // Save API key if remember is checked
    if (rememberKey.checked) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.API_KEY, apiKey);
    }

    // Start translation
    translateBtn.disabled = true;
    translateBtn.textContent = "Translating...";
    statusCard.style.display = "block";

    try {
        const file = srtFile.files[0];

        const result = await Translator.translateFile(
            file,
            apiKey,
            customPrompt.value,
            (percent, total, message) => {
                statusText.textContent = message;
                progressBar.style.width = `${percent}%`;
            }
        );

        // Store output
        outputText = result.outputText;
        outputName = result.outputName;

        // Show success
        resultInfo.innerHTML = `
            <div class="success">
                ✅ ${result.totalSubtitles} subtitles translated successfully!
            </div>
            <div style="margin-top:8px;color:var(--text);">
                File: <strong>${escapeHTML(outputName)}</strong>
            </div>
        `;
        resultCard.style.display = "block";

        // Scroll to result
        setTimeout(() => {
            resultCard.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }, 200);

    } catch (error) {
        console.error(error);
        showError(error?.message || "Translation failed. Please try again.");
        statusText.textContent = "Translation failed.";
    } finally {
        translateBtn.disabled = false;
        translateBtn.textContent = "Translate SRT";
    }
}

/* =========================================================
   DOWNLOAD
   ========================================================= */

function handleDownload() {
    if (!outputText) {
        return;
    }

    // Add UTF-8 BOM for Malayalam support
    const textWithBom = "﻿" + outputText;

    // Check for Android WebView download handler
    if (typeof AndroidDownload !== "undefined" &&
        typeof AndroidDownload.saveSrt === "function") {
        try {
            // Convert to base64 for Android
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

            // Show success message
            resultInfo.innerHTML += `
                <div class="success" style="margin-top:12px;">
                    ✅ Downloaded to: ${escapeHTML(outputName)}
                </div>
            `;
            return;
        } catch (error) {
            console.error("Android download failed:", error);
        }
    }

    // Standard browser download
    try {
        const blob = new Blob([textWithBom], {
            type: "application/x-subrip;charset=utf-8"
        });
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

        // Show success message
        resultInfo.innerHTML += `
            <div class="success" style="margin-top:12px;">
                ✅ Downloaded to: ${escapeHTML(outputName)}
            </div>
        `;
    } catch (error) {
        console.error(error);
        showError("Could not download the SRT file.");
    }
}

/* =========================================================
   KEYBOARD NAVIGATION
   ========================================================= */

function handleKeyboardNavigation(e) {
    // Escape key - close prompt editor
    if (e.key === "Escape" || e.key === "Back") {
        if (promptEditor.style.display === "block") {
            promptEditor.style.display = "none";
            editPromptBtn.style.display = "block";
            editPromptBtn.focus();
            e.preventDefault();
        }
    }

    // Enter key - move to next field (except in textarea)
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
        if (document.activeElement === apiKeyInput) {
            srtFile.focus();
            e.preventDefault();
        }
    }
}

/* =========================================================
   UTILITIES
   ========================================================= */

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

/* =========================================================
   START APPLICATION
   ========================================================= */

// Initialize when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
