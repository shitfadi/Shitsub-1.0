/* =========================================================
   SHITSUB - Configuration
   ========================================================= */

const CONFIG = {
    // Gemini Model
    MODEL: "gemini-1.5-flash",

    // API Endpoint
    API_URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",

    // Translation Settings
    CHUNK_SIZE: 25,                // Subtitles per chunk
    MAX_PARALLEL: 15,              // Maximum parallel requests
    MIN_PARALLEL: 3,               // Minimum parallel requests (when throttled)

    // Retry Settings
    MAX_RETRIES: 3,                // Maximum retry attempts per chunk
    INITIAL_RETRY_DELAY: 1000,     // Initial retry delay (ms)
    MAX_RETRY_DELAY: 10000,        // Maximum retry delay (ms)

    // Progress Settings
    BATCH_DELAY: 300,              // Delay between batches (ms)

    // LocalStorage Keys
    STORAGE_KEYS: {
        API_KEY: "shitsub_api_key",
        CUSTOM_PROMPT: "shitsub_custom_prompt",
        PROGRESS: "shitsub_progress"
    }
};

/* =========================================================
   DEFAULT TRANSLATION PROMPT
   ========================================================= */

const DEFAULT_PROMPT = `Translate English movie or TV subtitles into natural, colloquial Kerala Malayalam.

IMPORTANT RULES:
1. Use spoken Malayalam that people in Kerala naturally use in real conversations.
2. Do NOT translate word-for-word.
3. Do NOT use overly formal, literary, textbook, or old-fashioned Malayalam.
4. Preserve the original meaning, emotion, attitude, humor, sarcasm, anger, fear, romance, insults, and personality.
5. Keep the dialogue natural for the character and situation.
6. English words commonly used in Kerala conversations may be kept when they sound natural.
7. Do not unnecessarily convert every English technical or modern word into Malayalam.
8. Preserve swear words, insults, slang, vulgar expressions, and offensive language when they are present and relevant to the original dialogue. Do not censor or soften them.
9. Do not add explanations.
10. Do not remove meaning.
11. Do not summarize.
12. Keep each subtitle reasonably short and natural for reading.
13. Return only the translated dialogue.
14. Preserve multi-line format using ||| separator.
15. The translation should sound like actual people speaking in Kerala, not like a machine translation.`;
