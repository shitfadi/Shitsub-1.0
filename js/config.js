/* =========================================================
   SHITSUB - Config
   Multi-language ready. Change CONFIG.TARGET_LANGUAGE to switch.
   ========================================================= */

const CONFIG = {
    // Which company's API to call: "mistral" or "gemini"
    PROVIDER: "mistral",

    // ----- Mistral (free Experiment plan) -----
    // Paste your MISTRAL key in the API key box of the page.
    MODEL: "mistral-large-2512",     // Mistral Large 3 (250,000 tokens/min, 1 request/sec)
    API_URL: "https://api.mistral.ai/v1/chat/completions",

    // ----- To go back to Gemini, comment out the 4 lines above and use these -----
    // PROVIDER: "gemini",
    // MODEL: "gemini-3.1-flash-lite",
    // API_URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
    // (paste your Gemini key in the API key box again)

    // Which entry of LANGUAGES (below) to translate into
    TARGET_LANGUAGE: "malayalam",

    /* ---------- Speed ---------- */
    CHUNK_SIZE: 100,        // subtitles per request (answers are capped at 16k tokens)
    MIN_CHUNK_SIZE: 50,     // used only by balanceChunks(): never split smaller than this
    MAX_PARALLEL: 5,        // requests sent at the same time
    MIN_PARALLEL: 1,

    // false = your old behavior (chunks of CHUNK_SIZE, last one smaller)
    // true  = equal-sized chunks that fill every worker (700 lines = 5 x 140)
    // Set to true again only after a normal test works.
    BALANCE_CHUNKS: false,

    // Max length of Gemini's answer. 16384 is your old working value.
    MAX_OUTPUT_TOKENS: 16384,

    // Sent only when set. Remove or comment out to skip.
    TEMPERATURE: 0.3,

    // Gemini only (ignored for Mistral). "low" = faster. Set to "" if the API rejects it.
    THINKING_LEVEL: "",

    /* ---------- Rate-limit protection ---------- */
    // Mistral free plan: about 1 request per second per model.
    // Requests are started at least this far apart (ms). Mistral only.
    MIN_REQUEST_GAP_MS: 1100,

    // Pause between groups of parallel requests (ms).
    BATCH_DELAY: 5000,

    // Cancel a request that gets no answer (ms).
    REQUEST_TIMEOUT: 120000,

    /* ---------- Retry protection ---------- */
    MAX_RETRIES: 5,
    INITIAL_RETRY_DELAY: 5000,   // 5s, then 10s, 20s, 40s ...
    MAX_RETRY_DELAY: 120000,     // never wait more than 2 minutes

    STORAGE_KEYS: {
        API_KEY: "shitsub_api_key",
        CUSTOM_PROMPT: "shitsub_custom_prompt",
        PROGRESS: "shitsub_progress"
    }
};


/* =========================================================
   OPTIONAL: balanced chunks
   Splits a file into equal chunks that fill every worker,
   for example 700 lines becomes 5 x 140 instead of 200+200+200+100.
   Only runs when CONFIG.BALANCE_CHUNKS is true.
   ========================================================= */

function balanceChunks(chunks) {

    const all = chunks.flat();

    if (all.length === 0) {
        return chunks;
    }

    const parallel = CONFIG.MAX_PARALLEL || 1;
    const minSize = CONFIG.MIN_CHUNK_SIZE || 50;

    // Number of chunks: enough for CHUNK_SIZE, rounded up to fill every worker
    let count = Math.ceil(all.length / CONFIG.CHUNK_SIZE);
    count = Math.ceil(count / parallel) * parallel;

    // Never make chunks smaller than MIN_CHUNK_SIZE
    count = Math.max(1, Math.min(count, Math.floor(all.length / minSize) || 1));

    const base = Math.floor(all.length / count);
    const extra = all.length % count;

    const out = [];
    let pos = 0;

    for (let i = 0; i < count; i++) {

        const size = base + (i < extra ? 1 : 0);

        out.push(all.slice(pos, pos + size));

        pos += size;
    }

    return out;
}


const DEFAULT_PROMPT = `Translate every English movie or TV subtitle into natural spoken Kerala Malayalam with street-level local flavor and everyday slang (no bookish words). 

STRICT RULES:
- Translate EVERY subtitle. Never skip, omit, merge, or summarize.
- Prefer everyday spoken vocabulary
* സംഭാഷണം → വർത്തമാനം / വർത്താനം
* സംസാരിക്കുക → സംസാരിക്കുക / മിണ്ടുക, depending on context
* എന്താണ് → എന്താ
* എവിടെയാണ് → എവിടെയാ
* എങ്ങനെയാണ് → എങ്ങനെയാ
* ഇപ്പോൾ → ഇപ്പൊ
* അപ്പോൾ → അപ്പൊ
* ഇവിടെ → ഇവടെ, where natural
* അവിടെ → അവടെ, where natural
* സാധിക്കില്ല → പറ്റൂല
* ആവശ്യമില്ല → വേണ്ട
* ഉപേക്ഷിക്കുക → വിട്ടേക്ക്
* അവസാനിപ്പിക്കുക → നിർത്ത് / മതിയാക്ക്
* മനസ്സിലായില്ല → മനസ്സിലായില്ല / പിടികിട്ടിയില്ല
* എന്താണ് സംഭവിച്ചത്? → എന്താ പറ്റിയത്?
* എന്നെ വെറുതെ വിടൂ → എന്നെ വെറുതെ വിട്
* എന്തുകൊണ്ടാണ്? → എന്തിനാ? / എന്താ കാരണം?

These are contextual examples, not rigid word-for-word substitutions. Always choose the expression that sounds most natural in the complete sentence.

2. Use authentic spoken sentence structures
Prefer:

* നീ എന്താണ് ചെയ്യുന്നത്? → നീയെന്താ ചെയ്യുന്നേ?
* ഞാൻ അത് ചെയ്തിട്ടില്ല → ഞാനത് ചെയ്തിട്ടില്ല.
* ഞാൻ പറഞ്ഞുകൊണ്ടിരിക്കുകയാണ് → ഞാൻ പറഞ്ഞോണ്ടിരിക്കാ.
* നിനക്ക് എന്താണ് പ്രശ്നം? → നിനക്കെന്താ പ്രശ്നം?
* നീ എന്താണ് ഉദ്ദേശിക്കുന്നത്? → നീയെന്താ ഉദ്ദേശിക്കുന്നേ?
* അത് എനിക്ക് അറിയില്ല → അതെനിക്കറിയില്ല.
* നീ തമാശ പറയുകയാണോ? → നീ കളി പറയാണോ? / നീ കാര്യായിട്ടാണോ?
- Never use English letters. Write every English word, name, place, brand and abbreviation in Malayalam letters (FBI = എഫ്ബിഐ, OK = ഓകെ, Mr. = മിസ്റ്റർ, John = ജോൺ, New York = ന്യൂയോർക്ക്, iPhone = ഐഫോൺ, bangs = ബാങ്സ്).
Never use Tamil, Hindi or any other language's words. If Malayalam has no common word, write the English word in Malayalam letters.
Spell every name the same way every time.
- Every complete English sentence, question, statement, command, or dialogue line MUST be translated into Malayalam.
- NEVER leave a complete English sentence unchanged.
- If several subtitles form an English conversation, translate EVERY line.
- Write EVERYTHING in Malayalam script. Never use English (Latin) letters in the translation, not even a single word.
- Write names, places, brands, acronyms, abbreviations and technical terms in Malayalam script too (for example FBI becomes എഫ്ബിഐ, OK becomes ഓകെ, John becomes ജോൺ). Spell each name the same way every time.
- Numbers may stay as digits.
- Never copy the English subtitle before or after the Malayalam. Write only the Malayalam translation.
- These rules override any other instruction about keeping names, acronyms or proper nouns in English.
- Do NOT output Tamil, Telugu, Kannada, Hindi, Bengali, or any other Indian language.
- The translation must be Malayalam, using natural spoken Kerala Malayalam.
- Do NOT use formal, literary, textbook, or robotic Malayalam.
- Do NOT translate word-for-word when that sounds unnatural.
- Preserve the original meaning, emotion, sarcasm, humor, slang, insults, profanity, and character personality.
- Do not censor or soften dialogue.
- Do not add explanations.
- Do not summarize.
- Preserve <i>, <b>, <u> and other formatting tags.
- Preserve multi-line subtitles using |||.
- Return exactly ONE translation for every input subtitle.
- Keep the exact same order.

FINAL CHECK:
Before returning each translation, make sure:
1. It is translated into Malayalam if the original is English dialogue.
2. It is not a complete English sentence.
3. It contains no English letters at all. Names and abbreviations are written in Malayalam script.
4. It does not repeat the English subtitle anywhere.
5. It contains no accidental English, Tamil, Telugu, Kannada, Hindi, Bengali, or other non-Malayalam language text.
6. The meaning and emotion are preserved.

Return ONLY the translations in the required output format.`;


/* =========================================================
   LANGUAGES
   To add a language, copy the "malayalam" entry and fill in:
   - name:         shown inside prompts
   - dialect:      the kind of spoken language you want
   - style:        extra flavour instructions (can be "")
   - script:       a valid Unicode script name used by the checks
                   (Malayalam, Devanagari, Tamil, Telugu, Kannada,
                    Bengali, Gujarati, Gurmukhi, Arabic, Cyrillic,
                    Hangul, Latin ...)
   - latinAllowed: true ONLY for Latin-script targets (Spanish,
                   French...). Turns off the "no English letters"
                   checks, which would otherwise reject everything.
   - examples:     short "English becomes Native" samples for names
   - prompt:       the full default prompt for this language
   ========================================================= */

const FOREIGN_SCRIPT_NAMES = [
    "Devanagari", "Tamil", "Telugu", "Kannada", "Bengali", "Assamese",
    "Gujarati", "Gurmukhi", "Odia", "Malayalam", "Sinhala", "Ethiopic",
    "Arabic", "Cyrillic", "Korean", "Chinese", "Japanese", "Thai",
    "Meitei", "Ol Chiki"
];

const LANGUAGES = {

    malayalam: {
        name: "Malayalam",
        dialect: "natural spoken Kerala Malayalam",
        style: "with street-level local flavor and everyday slang (no bookish words)",
        script: "Malayalam",
        latinAllowed: false,
        examples: "FBI becomes എഫ്ബിഐ, John becomes ജോൺ, OK becomes ഓകെ",
        prompt: DEFAULT_PROMPT
    }

    // Example for later:
    // hindi: {
    //     name: "Hindi",
    //     dialect: "natural spoken Hindi",
    //     style: "with everyday street-level slang (no bookish words)",
    //     script: "Devanagari",
    //     latinAllowed: false,
    //     examples: "FBI becomes एफबीआई, John becomes जॉन, OK becomes ओके",
    //     prompt: HINDI_PROMPT   // write this prompt first
    // }
};


// Custom prompt is stored per language so switching language never
// loads another language's saved prompt. Use this key in index.html.
function getCustomPromptKey() {

    return CONFIG.STORAGE_KEYS.CUSTOM_PROMPT +
        "_" +
        CONFIG.TARGET_LANGUAGE;
}
