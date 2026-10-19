const CONFIG = {
    MODEL: "gemini-3.5-flash-lite",
    API_URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",

    CHUNK_SIZE: 200,
MAX_PARALLEL: 2,
MIN_PARALLEL: 1,

MAX_RETRIES: 5,
INITIAL_RETRY_DELAY: 5000,
MAX_RETRY_DELAY: 120000,

BATCH_DELAY: 8300,

    STORAGE_KEYS: {
        API_KEY: "shitsub_api_key",
        CUSTOM_PROMPT: "shitsub_custom_prompt",
        PROGRESS: "shitsub_progress"
    }
};

const DEFAULT_PROMPT = `Translate every English movie or TV subtitle into natural spoken Kerala Malayalam with street-level local flavor and everyday slang (no bookish words). 

STRICT RULES:
- Translate EVERY subtitle. Never skip, omit, merge, or summarize.
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
