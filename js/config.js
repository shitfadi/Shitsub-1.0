const CONFIG = {
    MODEL: "gemini-3.5-flash-lite",
    API_URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",

    CHUNK_SIZE: 25,
MAX_PARALLEL: 1,
MIN_PARALLEL: 1,

MAX_RETRIES: 3,
INITIAL_RETRY_DELAY: 4000,
MAX_RETRY_DELAY: 10000,

BATCH_DELAY: 4000,

    STORAGE_KEYS: {
        API_KEY: "shitsub_api_key",
        CUSTOM_PROMPT: "shitsub_custom_prompt",
        PROGRESS: "shitsub_progress"
    }
};

const DEFAULT_PROMPT = `Translate every English movie or TV subtitle into natural, colloquial Kerala Malayalam.

STRICT RULES:
- Translate EVERY subtitle. Never skip, omit, merge, or summarize.
- Every complete English sentence, question, statement, command, or dialogue line MUST be translated into Malayalam.
- NEVER leave a complete English sentence unchanged.
- If several subtitles form an English conversation, translate EVERY line.
- English words may remain only for names, places, brands, acronyms, technical terms, or words naturally used inside Malayalam speech.
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
3. It contains no accidental Tamil, Telugu, Kannada, Hindi, Bengali, or other Indian-language text.
4. The meaning and emotion are preserved.

Return ONLY the translations in the required output format.`;
