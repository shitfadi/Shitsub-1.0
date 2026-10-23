/* =========================================================
   SHITSUB - Translation Style Presets
   18+  and  Family Friendly

   The preset prompts live here, not in the page. The Custom
   Prompt box only holds the user's own extra instructions,
   which are added on top of the selected preset.
========================================================= */

const STYLE_STORAGE = {
    // saved per language, for example: shitsub_style_preset_malayalam
    PRESET: "shitsub_style_preset"
};

const DEFAULT_PRESET = "adult";

// ---------------------------------------------------------
// Shared part of both presets
// ---------------------------------------------------------

const PRESET_BASE_PROMPT = `Translate every English movie or TV subtitle  strictly into natural street level local everyday slang (no bookish words) spoken Kerala Malayalam  

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
6. The meaning and emotion are preserved`;

// ---------------------------------------------------------
// The two presets
// ---------------------------------------------------------

const MALAYALAM_PRESETS = {

    adult: {

        label: "18+",

        hint: "Street Malayalam with lots of bad words and vulgar language.",

        prompt: PRESET_BASE_PROMPT + `

Comprehensive Profanity & Slang Mapping

When characters express rage, panic, contempt, frustration, rebellion, or hostility, use the following Malayalam profanity and street slang according to the original dialogue’s meaning, context, and emotional intensity.

Pinned Vocabulary Priority (Very Important)

Prioritize these words when they are natural, contextually accurate equivalents of the original dialogue. Preserve their raw, vulgar, and offensive tone. Do not force them into unrelated contexts or unnecessarily intensify mild dialogue.

1. General Insults & Contempt (Asshole, Jerk, Prick, Loser)

* തായോളി / തള്ളയോളി: Extremely vulgar insult equivalent to “motherfucker.”
* പൂറി / പൂറിമോൻ: Heavy vulgar insults expressing contempt, equivalent to “bitch,” “son of a bitch,” or similar context-dependent abuse.
* വെടി / വെടിപ്പൂറി: Derogatory slang equivalent to “slut” or “whore” when the context warrants it.
* മൈര്: Versatile, high-frequency profanity equivalent to “fuck,” “shit,” or similar expletives, depending on context.
* കുണ്ണ: Crude slang referring to a penis/dick or used as an insult for an obnoxious, arrogant, or contemptible person.
* ഊമ്പ്: Aggressive slang expressing that someone is screwed, ruined, or in serious trouble.
* തന്തയില്ലാത്തവൻ: “Bastard” or a similarly harsh insult.
* തെണ്ടി: “Wretch,” “scumbag,” or “beggar,” depending on context.
* നാറി: A contemptuous insult for a despicable or repulsive person.
* കുണ്ടി: Crude term for “ass” or “butt,” depending on context.
* പൂർ / പൂറ്: Vulgar terms for “pussy” or “cunt,” depending on context.
* മൈരൻ / മൈരത്തി / മൈര്: Vulgar insults and expletives. Select the appropriate form according to the person, grammatical context, and intended meaning.
* ഊള / ഊളൻ: “Loser,” “idiot,” or an incompetent fool.
* പട്ടി / പട്ടിപ്പയ്യൻ / പൂറൻ / പൂറി: Insults ranging from “dog” or “worthless punk” to stronger vulgar abuse, depending on context.
* ചുമ്മാതെ ഊമ്പിയവൻ: A contemptuous expression for a useless idiot or good-for-nothing fool.

2. Intense Profanity & Expletives (Fuck, Fucking, Shit, Bullshit)

* മൈര്: General-purpose profanity for “fuck,” “shit,” and related expletives.
* മൈരത്തി: Vulgar feminine insult or expletive when appropriate to the original meaning.
* ഊമ്പ് / ഊമ്പിയ: Expressions for being screwed, messed up, ruined, or behaving like a fool.
* പൂറ്: Strong vulgar expletive or insult equivalent to “cunt,” where contextually appropriate.
* തേങ്ങ / മാങ്ങ / കോപ്പ്: Casual dismissive expressions for nonsense, rubbish, or “bullshit.”
* പണ്ടാരം: An expression of frustration, annoyance, or a damned, troublesome mess.
* തള്ളൽ / തള്ളിക്കയറ്റൽ: Expressions for exaggeration, shameless boasting, or talking bullshit.

3. Severe Abuses & Direct Attacks (Motherfucker, Cocksucker, Bitch, Whore)

* തായോളി: Extremely vulgar direct insult equivalent to “motherfucker.”
* പൂറിമോൻ: Severe vulgar insult comparable to “son of a bitch.”
* വെടി / വെടിപ്പൂറി: Derogatory terms comparable to “slut” or “whore,” according to context.
* കുടിച്ചി: Derogatory slang for a woman who is drunk or behaves like a drunkard.
* ചരക്ക്: Crude slang describing an attractive person or desirable item. Use only when the original dialogue conveys that meaning.

4. Despair, Destruction & Extreme States (Dead, Screwed, Fucked Up)

* ഊമ്പിപ്പൊളിഞ്ഞു: Completely ruined or fucked beyond repair.
* തീർന്നു / ചത്തു: Done for, finished, or dead, depending on context.
* തലവേദന: A headache or a figurative pain in the ass.
* കോപ്പിലെ ജീവിതം: A contemptuous expression describing a miserable or worthless life.

5. Contextual Translation of “Fuck You” and Similar Expressions

Translate “Fuck you” and related expressions according to the character’s anger, intent, relationship, and the situation. Never use one fixed Malayalam equivalent for every occurrence.

Natural Kerala Malayalam equivalents:

* പോടാ മൈരേ: Common, direct insult expressing anger or contempt.
* പോടാ തായോളി: Strong, highly vulgar insult.
* പോടാ പൂറിമോനേ: Severe, aggressive personal insult.
* ഊമ്പടാ മൈരേ: Aggressive, confrontational expression.
* പോയി ഊമ്പടാ: Dismissive, vulgar equivalent of “Fuck off.”
* പോടീ മൈരേ: Vulgar insult directed at a woman, when contextually appropriate.
* നിന്റെ കോപ്പിലെ വർത്താനം നിർത്ത്: Dismissive response to someone’s offensive or nonsensical talk.
* പോയി പണി നോക്കടാ: Less vulgar dismissal, similar to “Get lost” or “Go mind your own business.”

Strict rules:

* Choose the expression that best preserves the original meaning and intensity.
* Distinguish “Fuck you,” “Fuck off,” “Fuck you and your bullshit,” and similar expressions according to their actual intent.
* Preserve gender, character personality, emotional tone, and natural spoken sentence structure.
* Use strong profanity when warranted, but do not force the same insult into every situation.

6. Distinguish Profanity by Intensity

Match profanity to the original dialogue’s intensity: use mild expressions for casual irritation, everyday profanity for casual swearing, stronger insults for direct hostility, and the harshest pinned words for extreme rage or aggression. Preserve the original intensity without unnecessarily escalating or softening the dialogue.

Tone Execution

* Never soften, sanitize, or unnecessarily censor profanity, insults, or abusive dialogue.
* When a character is panicking, intoxicated, furious, threatening someone, rebelling, or facing imminent death, preserve the appropriate desperation, hostility, vulgarity, and raw street-level cadence.
* Match the intensity of the original dialogue. Distinguish casual swearing, playful insults, irritation, direct abuse, rage, and extreme hostility.
* Give priority to the pinned vocabulary when it fits naturally, but never insert a curse word merely to use it.
* Prefer authentic, everyday spoken Kerala Malayalam over literal translations, formal vocabulary, or textbook phrasing.
* Preserve each character’s personality, attitude, humour, sarcasm, and distinctive speaking style.
* Choose the most natural expression for the complete sentence rather than translating individual English swear words mechanically.
* Do not make every character sound equally vulgar. Their profanity must reflect the original character, relationship, situation, and emotional intensity.

Return ONLY the translations in the required output format.`
    },

    family: {

        label: "Family Friendly",

        hint: "Street style colloquial Malayalam with no bad words and nothing vulgar.",

        prompt: PRESET_BASE_PROMPT + `

Slang Mapping:

1. Common Insults

* Idiot / Moron / Dumbass: മണ്ടൻ, പൊട്ടൻ, വിഡ്ഢി
* Asshole / Jerk: ശല്യക്കാരൻ, മര്യാദയില്ലാത്തവൻ
* Bastard / Son of a bitch: ദുഷ്ടൻ, നാറിയവൻ
* Bitch: ദുഷ്ടത്തി, മര്യാദയില്ലാത്തവൾ
* Loser: തോൽവിക്കാരൻ, കഴിവില്ലാത്തവൻ
* Dickhead / Prick: അഹങ്കാരി, മണ്ടൻ
* Creep: വൃത്തികെട്ട സ്വഭാവക്കാരൻ
* Coward / Chicken: പേടിത്തൊണ്ടൻ
* Liar: കള്ളൻ, കള്ളത്തി
* Scumbag: വൃത്തികെട്ടവൻ
* Punk / Brat: എടാ ചെക്കാ, വികൃതിച്ചെക്കൻ
* Clown: കോമാളി
* Dog / Pig / Donkey: പട്ടി, പന്നി, കഴുത
* Dumb animal insults: മണ്ടൻ കഴുത, കുരങ്ങൻ

2. Common Swear Words

* Fuck! / Shit! / Damn it!: നാശം! / ശ്ശേ!
* What the fuck?! / What the hell?!: ഇതെന്ത് കൂത്ത്?! / ഇതെന്താ ഈ കാണിക്കുന്നേ?!
* Bullshit!: വെറുതെ തള്ളല്ലേ! / എന്ത് മണ്ടത്തരമാ ഇത്!
* Fuck you!: പോടാ മണ്ടാ! / നീയാരാണെന്നാ നിന്റെ വിചാരം?
* Fuck off!: പോയി പണി നോക്ക്! / ഒന്ന് പോയെ!
* Screw you!: പോയി പണി നോക്ക്!
* Fucking idiot: മഹാമണ്ടൻ
* Fucking annoying: വല്ലാത്ത ശല്യം
* This sucks!: ഇത് തീരെ കൊള്ളില്ല!
* You’re screwed!: നീ പെട്ടെടാ!
* Shut the hell up!: വായടച്ച് മിണ്ടാതിരിക്ക്!
* Goddammit!: എന്റെ ദൈവമേ, നാശം!
* Holy shit!: എന്റെ ദൈവമേ!
* Piece of crap: ഒരു കാര്യത്തിനും കൊള്ളാത്തത്
* Cut the crap!: ഈ തള്ളൽ നിർത്ത്!
* I don’t give a damn!: എനിക്കൊരു ചുക്കും ഇല്ല!

3. Common Rude Expressions

* Get lost!: പോയി പണി നോക്ക്!
* You idiot!: എടാ മണ്ടാ!
* Are you crazy?: നിനക്ക് വട്ടാണോ?
* What is wrong with you?: നിനക്കെന്താ കുഴപ്പം?
* Don’t mess with me!: എന്നോട് കളിക്കാൻ നിൽക്കണ്ട!
* Who do you think you are?: നീയാരാണെന്നാ നിന്റെ വിചാരം?
* You’re full of crap!: നീ വെറുതെ തള്ളുന്നതാ!
* Stop whining!: കിടന്ന് മോങ്ങുന്നത് നിർത്ത്!
* Give me a break!: എന്നെ വെറുതെ വിട്!
* You’re pathetic!: എന്തൊരു ഗതികേടാ നിനക്ക്!
* What a joke!: എന്തൊരു കോമഡിയാ ഇത്!
* Nice going, genius!: കൊള്ളാം, വലിയ ബുദ്ധിമാനാണല്ലോ!
* Get a life!: വേറെ പണിയൊന്നും ഇല്ലേ നിനക്ക്?
* Drop dead!: ഒന്ന് പോയിത്തരാമോ!
* You’re dead meat!: നീ പെട്ടെടാ!
* Bring it on!: വാടാ, നോക്കാം!
* Watch your mouth!: വായിൽ തോന്നിയത് വിളിച്ചുപറയണ്ട!

4. Translation Rules

* Choose the Malayalam expression according to context, not by fixed word-for-word substitution.
* Keep the dialogue natural, casual, and recognisably spoken in Kerala.
* Preserve anger, sarcasm, humour, and character personality without using explicit profanity.
* Use mild insults like പട്ടി, കഴുത, മണ്ടൻ, and പൊട്ടൻ where appropriate.
* Do not replace every insult with the same word or make angry characters sound overly polite.
* Do not add insults when the original dialogue contains none.
* Translate the meaning of expressions such as “fuck” differently depending on whether they express anger, surprise, frustration, emphasis, or an insult.

5. Subtitle Preservation

* Translate every subtitle without skipping, merging, or summarising.
* Preserve the exact block count, numbering, timestamps, order, and formatting tags.
* Preserve multi-line subtitle structure.
* Write all translated text in Malayalam script, including names and acronyms through consistent transliteration.
* Do not leave complete English dialogue untranslated.
* Do not include the original English subtitle, explanations, or notes.
* Before responding, silently check subtitle completeness, formatting, naturalness, and the absence of explicit profanity.

Intensity rules

* Never use vulgar or sexually explicit Malayalam words.
* Do not make a mild expression harsher than the original.
* For strong insults, use forceful but non-vulgar Malayalam expressions.
* Consider the character’s anger, sarcasm, relationship, and situation.
* Translate the intended meaning and emotional force, not the literal words.
* Do not add insults or intensify dialogue when the original does not justify it.
* When an expression is playful teasing between friends, keep it playful rather than making it sound genuinely hostile.
* When an expression is serious or threatening, preserve that seriousness without introducing vulgarity.

6. Context, Tone, and Character Consistency

* Understand the meaning of each line in the context of the scene.
* Use surrounding subtitle lines to identify the speaker, target, emotion, and conversational intent.
* Maintain consistent speech patterns for each character.
* Use familiar forms of address such as എടാ, എടി, നീ, നിങ്ങൾ, ചേട്ടാ, or മോളേ only when appropriate to the relationship and scene.
* Preserve sarcasm, jokes, teasing, anger, fear, and frustration.
* Translate rhetorical questions and idioms according to their intended meaning.
* Avoid repeating the same insult when another natural equivalent fits better.
* Do not make every character sound identical.
* Do not add extra jokes, insults, explanations, or emotional details that are absent from the original.

Return ONLY the Malayalam translations in the required output format.`
    }
};

// ---------------------------------------------------------
// Presets per target language (CONFIG.TARGET_LANGUAGE)
// To give another language the style buttons, add its presets here.
// A language without an entry simply hides the Translation Style card.
// ---------------------------------------------------------

const STYLE_PRESETS_BY_LANGUAGE = {
    malayalam: MALAYALAM_PRESETS
};

function getStylePresets() {

    return STYLE_PRESETS_BY_LANGUAGE[CONFIG.TARGET_LANGUAGE] || null;
}

function getPresetStorageKey() {

    return STYLE_STORAGE.PRESET + "_" + CONFIG.TARGET_LANGUAGE;
}

// ---------------------------------------------------------
// Final prompt = selected preset (or the language default prompt when
// the language has no presets) + the user's own extra instructions
// ---------------------------------------------------------

function buildFinalPrompt(presetId, extraText) {

    const presets = getStylePresets();

    const base = presets
        ? (presets[presetId] || presets[DEFAULT_PRESET]).prompt
        : (LANGUAGES[CONFIG.TARGET_LANGUAGE] || LANGUAGES.malayalam).prompt;

    const extra = String(extraText || "").trim();

    if (!extra) {
        return base;
    }

    return base +
        "\n\nADDITIONAL INSTRUCTIONS FROM THE USER " +
        "(follow these as well; if they conflict with the style rules above, " +
        "the user's instructions win):\n" +
        extra;
}
