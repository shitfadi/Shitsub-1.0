/* =========================================================
   SHITSUB - Gemini API
   Robust translation + validation + targeted recovery
   ========================================================= */

const GeminiAPI = {

    async translateChunk(chunk, apiKey, customPrompt) {

        const input = chunk.map((subtitle, index) => {
            return `[[SUBTITLE_${index + 1}]]\n${subtitle.text}`;
        }).join("\n\n");

        const prompt = `${customPrompt}

IMPORTANT:
Translate EVERY subtitle below into natural, spoken Kerala Malayalam.

The subtitles are identified by immutable IDs.

STRICT RULES:
- Translate every subtitle.
- Preserve every [[SUBTITLE_X]] ID exactly.
- Each ID must appear exactly once.
- Never change an ID.
- Never remove an ID.
- Never invent an ID.
- Never duplicate an ID.
- The translation after an ID MUST correspond to the English subtitle belonging to that exact ID.
- Never move a translation from one subtitle ID to another.
- Translate each subtitle independently.
- Use surrounding subtitles only to understand context.
- Do not merge subtitles.
- Do not split subtitles.
- Do not skip subtitles.
- Do not summarize.
- Do not add explanations.
- Return ONLY subtitle IDs and translations.
- Use natural colloquial Kerala Malayalam.
- Preserve the character's personality, emotion, tone, slang and profanity.
- Do not unnecessarily make casual dialogue formal.
- Use Malayalam script for Malayalam dialogue.
- Never use Devanagari, Tamil, Telugu, Kannada, Bengali, Assamese, Gujarati, Gurmukhi, Odia, Sinhala, Meitei or Ol Chiki script.
- Do not transliterate Malayalam into another Indian script.
- Do not mix Malayalam with another Indian script.
- Keep names, numbers, URLs and important proper nouns accurate.
- Preserve HTML tags such as <i>, </i>, <b>, </b>, <u>, </u> exactly when present.
- Do not add Markdown.
- Do not add quotation marks unless they are part of the original subtitle.

IMPORTANT DUPLICATE RULE:
- Different English subtitles may legitimately have similar Malayalam translations.
- However, never copy a translation from another subtitle simply because the English subtitles look similar.
- Each translation must be based on the English text belonging to its own ID.

FORMAT:
[[SUBTITLE_1]]
Malayalam translation

[[SUBTITLE_2]]
Malayalam translation

[[SUBTITLE_3]]
Malayalam translation

SUBTITLES:
${input}`;

        const result = await this.callGemini(
            prompt,
            apiKey
        );

        let translations =
            this.parseIdTranslations(
                result,
                chunk.length
            );

        let problems =
            this.validateTranslations(
                chunk,
                translations
            );

        if (problems.length > 0) {

            console.warn(
                "Translation validation problems:",
                problems
            );

            translations =
                await this.recoverProblems(
                    chunk,
                    translations,
                    problems,
                    apiKey,
                    customPrompt
                );
        }

        const finalProblems =
            this.validateTranslations(
                chunk,
                translations
            );

        if (finalProblems.length > 0) {

            throw new Error(
                "Translation validation failed: " +
                finalProblems.join(", ")
            );
        }

        return chunk.map(
            (subtitle, index) => ({
                ...subtitle,
                text: translations[index]
            })
        );
    },


    async callGemini(prompt, apiKey) {

        const response = await fetch(
            `${CONFIG.API_URL}?key=${encodeURIComponent(apiKey)}`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ]
                })
            }
        );

        if (!response.ok) {

            let errorData = null;

            try {
                errorData =
                    await response.json();
            } catch (e) {
                // Ignore JSON parsing failure
            }

            const error =
                new Error(
                    `Gemini API error ${response.status}: ` +
                    JSON.stringify(
                        errorData || {}
                    )
                );

            error.status =
                response.status;

            error.retryDelay =
                errorData?.error?.details
                    ?.find(
                        d =>
                            d["@type"] ===
                            "type.googleapis.com/google.rpc.RetryInfo"
                    )
                    ?.retryDelay || null;

            throw error;
        }

        const data =
            await response.json();

        const result =
            data?.candidates?.[0]
                ?.content?.parts?.[0]
                ?.text;

        if (!result) {
            throw new Error(
                "Gemini returned an empty response"
            );
        }

        return result;
    },


    parseIdTranslations(
        result,
        count
    ) {

        const translations =
            new Array(count);

        const seen =
            new Set();

        const lines =
            result.split(/\r?\n/);

        let currentNumber =
            null;

        for (const rawLine of lines) {

            const line =
                rawLine.trim();

            if (!line) {
                continue;
            }

            const match =
                line.match(
                    /^\s*\[\[SUBTITLE_(\d+)\]\]\s*$/
                );

            if (match) {

                const number =
                    parseInt(
                        match[1],
                        10
                    );

                if (
                    number >= 1 &&
                    number <= count
                ) {

                    currentNumber =
                        number;

                    seen.add(number);

                    if (
                        translations[
                            number - 1
                        ] === undefined
                    ) {
                        translations[
                            number - 1
                        ] = "";
                    }

                    continue;
                }
            }

            if (
                currentNumber !== null
            ) {

                const index =
                    currentNumber - 1;

                if (!translations[index]) {

                    translations[index] =
                        line;

                } else {

                    translations[index] +=
                        " " + line;
                }
            }
        }

        return translations;
    },


    validateTranslations(
        chunk,
        translations
    ) {

        const problems = [];

        if (
            !Array.isArray(translations) ||
            translations.length !== chunk.length
        ) {

            problems.push(
                "translation count mismatch"
            );

            return problems;
        }

        for (
            let i = 0;
            i < chunk.length;
            i++
        ) {

            const english =
                chunk[i].text || "";

            const translated =
                translations[i];

            if (
                !translated ||
                !translated.trim()
            ) {

                problems.push(
                    `missing:${i + 1}`
                );

                continue;
            }

            if (
                this.hasBadLanguage(
                    translated
                )
            ) {

                problems.push(
                    `language:${i + 1}`
                );
            }

            if (
                this.hasBrokenTags(
                    english,
                    translated
                )
            ) {

                problems.push(
                    `tags:${i + 1}`
                );
            }

            if (
                this.hasBrokenImportantTokens(
                    english,
                    translated
                )
            ) {

                problems.push(
                    `tokens:${i + 1}`
                );
            }

            if (
                this.isSuspiciousDuplicate(
                    chunk,
                    translations,
                    i
                )
            ) {

                problems.push(
                    `duplicate:${i + 1}`
                );
            }

            if (
                this.isSuspiciousEnglishCarryover(
                    english,
                    translated
                )
            ) {

                problems.push(
                    `english:${i + 1}`
                );
            }
        }

        return problems;
    },


    hasBadLanguage(text) {

    const malayalamCount =
        (
            text.match(
                /[\u0D00-\u0D7F]/g
            ) || []
        ).length;

    const latinCount =
        (
            text.match(
                /[A-Za-z]/g
            ) || []
        ).length;

    // Detect other Indic scripts
    const foreignScriptPatterns = [

    // Devanagari - Hindi, Marathi, Nepali, Sanskrit
    /[\u0900-\u097F]/g,

    // Bengali / Assamese
    /[\u0980-\u09FF]/g,

    // Gurmukhi - Punjabi
    /[\u0A00-\u0A7F]/g,

    // Gujarati
    /[\u0A80-\u0AFF]/g,

    // Odia
    /[\u0B00-\u0B7F]/g,

    // Tamil
    /[\u0B80-\u0BFF]/g,

    // Telugu
    /[\u0C00-\u0C7F]/g,

    // Kannada
    /[\u0C80-\u0CFF]/g,

    // Sinhala
    /[\u0D80-\u0DFF]/g,

    // Thai
    /[\u0E00-\u0E7F]/g,

    // Lao
    /[\u0E80-\u0EFF]/g,

    // Tibetan
    /[\u0F00-\u0FFF]/g,

    // Myanmar
    /[\u1000-\u109F]/g,

    // Khmer
    /[\u1780-\u17FF]/g,

    // Chinese / Japanese Kanji
    /[\u3400-\u4DBF]/g,
    /[\u4E00-\u9FFF]/g,

    // Japanese Hiragana
    /[\u3040-\u309F]/g,

    // Japanese Katakana
    /[\u30A0-\u30FF]/g,

    // Korean Hangul
    /[\uAC00-\uD7AF]/g,

    // Meitei / Manipuri
    /[\uABC0-\uABFF]/g,

    // Ol Chiki - Santali
    /[\u1C50-\u1C7F]/g
];

    let foreignScriptCount = 0;

    for (
        const pattern of foreignScriptPatterns
    ) {

        foreignScriptCount +=
            (
                text.match(pattern) || []
            ).length;
    }

    // Any meaningful amount of another
    // Indic script means contamination.
    if (
        foreignScriptCount >= 1
    ) {
        return true;
    }

    const letterCount =
        malayalamCount +
        latinCount;

    // Very short subtitles such as:
    // "അതെ", "ഇല്ല", "OK", "FBI"
    // should not be rejected only because
    // they contain very few characters.
    if (
        letterCount < 4
    ) {
        return false;
    }

    const ratio =
        malayalamCount /
        letterCount;

    return ratio < 0.35;
},


    hasBrokenTags(
        original,
        translated
    ) {

        const tagPattern =
            /<\/?[a-zA-Z][^>]*>/g;

        const originalTags =
            original.match(tagPattern) || [];

        const translatedTags =
            translated.match(tagPattern) || [];

        if (
            originalTags.length !==
            translatedTags.length
        ) {
            return true;
        }

        for (
            let i = 0;
            i < originalTags.length;
            i++
        ) {

            if (
                originalTags[i] !==
                translatedTags[i]
            ) {
                return true;
            }
        }

        return false;
    },


    hasBrokenImportantTokens(
    original,
    translated
) {

    const tokens =
        this.extractImportantTokens(
            original
        );

    for (const token of tokens) {

        const normalizedToken =
            token
                .replace(/[.,!?;:'"“”‘’()[\]{}<>]/g, "")
                .trim();

        if (!normalizedToken) {
            continue;
        }

        const normalizedTranslated =
            translated
                .replace(/[.,!?;:'"“”‘’()[\]{}<>]/g, "")
                .trim();

        if (
            !normalizedTranslated.includes(
                normalizedToken
            )
        ) {

            return true;
        }
    }

    return false;
},


    extractImportantTokens(
        text
    ) {

        const tokens = [];

        const patterns = [

            // URLs
            /https?:\/\/[^\s]+/gi,

            // Email addresses
            /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,

            // Percentages
            /\b\d+(?:\.\d+)?%/g,

            // Currency / amounts
            /[$€£₹]\s?\d+(?:[.,]\d+)*/g,

            // Numbers
            /\b\d+(?:[.,]\d+)*\b/g
        ];

        for (const pattern of patterns) {

            const matches =
                text.match(pattern) || [];

            for (const match of matches) {

                if (
                    !tokens.includes(match)
                ) {
                    tokens.push(match);
                }
            }
        }

        return tokens;
    },


    isSuspiciousEnglishCarryover(
        original,
        translated
    ) {

        const originalWords =
            this.getEnglishWords(
                original
            );

        if (
            originalWords.length < 4
        ) {
            return false;
        }

        const translatedLower =
            translated.toLowerCase();

        let unchanged = 0;

        for (
            const word of originalWords
        ) {

            if (
                translatedLower.includes(
                    word.toLowerCase()
                )
            ) {

                unchanged++;
            }
        }

        return (
            unchanged >= 4 &&
            unchanged /
            originalWords.length >= 0.7
        );
    },


    getEnglishWords(text) {

        return (
            text.match(
                /\b[A-Za-z]{3,}\b/g
            ) || []
        );
    },


    normalizeForDuplicateCheck(
        text
    ) {

        return text
            .toLowerCase()
            .replace(
                /[\u200B-\u200D\uFEFF]/g,
                ""
            )
            .replace(
                /[.,!?;:'"“”‘’()[\]{}<>]/g,
                ""
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    },


    isSuspiciousDuplicate(
        chunk,
        translations,
        index
    ) {

        const current =
            this.normalizeForDuplicateCheck(
                translations[index] || ""
            );

        if (
            !current ||
            current.length < 8
        ) {
            return false;
        }

        const currentEnglish =
            this.normalizeForDuplicateCheck(
                chunk[index].text || ""
            );

        for (
            let i = 0;
            i < translations.length;
            i++
        ) {

            if (i === index) {
                continue;
            }

            const other =
                this.normalizeForDuplicateCheck(
                    translations[i] || ""
                );

            if (
                !other ||
                other !== current
            ) {
                continue;
            }

            const otherEnglish =
                this.normalizeForDuplicateCheck(
                    chunk[i].text || ""
                );

            if (
                currentEnglish ===
                otherEnglish
            ) {
                continue;
            }

            if (
                this.englishMeaningLooksDifferent(
                    currentEnglish,
                    otherEnglish
                )
            ) {

                return true;
            }
        }

        return false;
    },


    englishMeaningLooksDifferent(
        a,
        b
    ) {

        const wordsA =
            new Set(
                a
                    .split(/\s+/)
                    .filter(
                        word =>
                            word.length > 2
                    )
            );

        const wordsB =
            new Set(
                b
                    .split(/\s+/)
                    .filter(
                        word =>
                            word.length > 2
                    )
            );

        if (
            wordsA.size === 0 ||
            wordsB.size === 0
        ) {
            return false;
        }

        let common = 0;

        for (
            const word of wordsA
        ) {

            if (
                wordsB.has(word)
            ) {
                common++;
            }
        }

        const similarity =
            common /
            Math.max(
                wordsA.size,
                wordsB.size
            );

        return similarity < 0.5;
    },


    async recoverProblems(
        chunk,
        translations,
        problems,
        apiKey,
        customPrompt
    ) {

        const indexes =
            [
                ...new Set(
                    problems
                        .map(problem => {

                            const match =
                                problem.match(
                                    /:(\d+)$/
                                );

                            return match
                                ? parseInt(
                                    match[1],
                                    10
                                )
                                : null;
                        })
                        .filter(
                            number =>
                                number !== null
                        )
                )
            ];

        if (
            indexes.length === 0
        ) {

            throw new Error(
                "Translation validation failed"
            );
        }

        const input =
            indexes.map(number => {

                const index =
                    number - 1;

                const previous =
                    index > 0
                        ? chunk[index - 1].text
                        : "";

                const current =
                    chunk[index].text;

                const next =
                    index < chunk.length - 1
                        ? chunk[index + 1].text
                        : "";

                return `[[SUBTITLE_${number}]]

PREVIOUS CONTEXT:
${previous}

TARGET ENGLISH:
${current}

NEXT CONTEXT:
${next}`;

            }).join("\n\n");


        const prompt = `${customPrompt}

A previous translation response contained one or more suspicious subtitle translations.

Translate ONLY the requested subtitle IDs below.

STRICT RULES:
- Preserve every [[SUBTITLE_X]] ID exactly.
- Each requested ID must appear exactly once.
- Translate the TARGET ENGLISH belonging to that exact ID.
- Do not copy the translation of another subtitle.
- Use PREVIOUS CONTEXT and NEXT CONTEXT only to understand meaning.
- Do not translate the context as separate subtitles.
- Use natural spoken Kerala Malayalam.
- Preserve emotion, personality, slang and profanity.
- Do not use Tamil, Telugu, Kannada, Hindi or Bengali.
- Preserve HTML tags exactly.
- Preserve important numbers, URLs and proper nouns.
- Return ONLY the requested IDs and their Malayalam translations.
- Do not add explanations.

FORMAT:
[[SUBTITLE_X]]
Malayalam translation

SUBTITLES:
${input}`;


        let lastError;

        for (
            let attempt = 1;
            attempt <= CONFIG.MAX_RETRIES;
            attempt++
        ) {

            try {

                const result =
                    await this.callGemini(
                        prompt,
                        apiKey
                    );

                const recovered =
                    this.parseIdTranslations(
                        result,
                        chunk.length
                    );

                for (
                    const number of indexes
                ) {

                    const value =
                        recovered[
                            number - 1
                        ];

                    if (
                        value &&
                        value.trim()
                    ) {

                        translations[
                            number - 1
                        ] = value;
                    }
                }

                const remaining =
                    indexes.filter(
                        number => {

                            const value =
                                translations[
                                    number - 1
                                ];

                            return (
                                !value ||
                                !value.trim()
                            );
                        }
                    );

                if (
                    remaining.length === 0
                ) {

                    return translations;
                }

                throw new Error(
                    "Recovery still incomplete"
                );

            } catch (error) {

                lastError =
                    error;

                if (
                    attempt >=
                    CONFIG.MAX_RETRIES
                ) {
                    break;
                }

                let delay;

                if (
                    error.retryDelay
                ) {

                    delay =
                        this.parseRetryDelay(
                            error.retryDelay
                        );

                } else {

                    delay =
                        CONFIG.INITIAL_RETRY_DELAY *
                        Math.pow(
                            2,
                            attempt - 1
                        );
                }

                delay =
                    Math.min(
                        delay,
                        CONFIG.MAX_RETRY_DELAY
                    );

                console.log(
                    `Waiting ` +
                    `${Math.ceil(delay / 1000)}s ` +
                    `before recovery retry...`
                );

                await this.sleep(
                    delay
                );
            }
        }

        throw lastError ||
            new Error(
                "Could not recover problematic translations"
            );
    },


    async translateWithThrottling(
        chunks,
        apiKey,
        customPrompt,
        onProgress
    ) {

        const results =
            new Array(chunks.length);

        let completed = 0;

        const maxParallel =
            CONFIG.MAX_PARALLEL || 1;

        for (
            let start = 0;
            start < chunks.length;
            start += maxParallel
        ) {

            const currentChunks =
                chunks.slice(
                    start,
                    start + maxParallel
                );

            const translated =
                await Promise.all(
                    currentChunks.map(
                        async (
                            chunk,
                            index
                        ) => {

                            const chunkNumber =
                                start + index + 1;

                            let lastError;

                            for (
                                let attempt = 1;
                                attempt <= CONFIG.MAX_RETRIES;
                                attempt++
                            ) {

                                try {

                                    return await this.translateChunk(
                                        chunk,
                                        apiKey,
                                        customPrompt
                                    );

                                } catch (error) {

                                    lastError =
                                        error;

                                    console.warn(
                                        `Chunk ${chunkNumber} ` +
                                        `failed ` +
                                        `(attempt ${attempt}/` +
                                        `${CONFIG.MAX_RETRIES})`,
                                        error
                                    );

                                    if (
                                        attempt >=
                                        CONFIG.MAX_RETRIES
                                    ) {
                                        break;
                                    }

                                    let delay;

                                    if (
                                        error.retryDelay
                                    ) {

                                        delay =
                                            this.parseRetryDelay(
                                                error.retryDelay
                                            );

                                    } else {

                                        delay =
                                            CONFIG.INITIAL_RETRY_DELAY *
                                            Math.pow(
                                                2,
                                                attempt - 1
                                            );
                                    }

                                    delay =
                                        Math.min(
                                            delay,
                                            CONFIG.MAX_RETRY_DELAY
                                        );

                                    console.log(
                                        `Waiting ` +
                                        `${Math.ceil(delay / 1000)}s ` +
                                        `before retrying chunk ` +
                                        `${chunkNumber}...`
                                    );

                                    await this.sleep(
                                        delay
                                    );
                                }
                            }

                            throw new Error(
                                `Chunk ${chunkNumber} failed: ` +
                                `${lastError?.message ||
                                "Unknown error"}`
                            );
                        }
                    )
                );

            translated.forEach(
                (chunk, index) => {

                    results[
                        start + index
                    ] = chunk;
                }
            );

            completed +=
                translated.length;

            if (onProgress) {

                onProgress(
                    completed,
                    chunks.length
                );
            }

            if (
                start + maxParallel <
                chunks.length
            ) {

                await this.sleep(
                    CONFIG.BATCH_DELAY
                );
            }
        }

        return results;
    },


    parseRetryDelay(value) {

        if (!value) {
            return 5000;
        }

        if (
            typeof value === "string" &&
            value.endsWith("s")
        ) {

            const seconds =
                parseFloat(
                    value.slice(
                        0,
                        -1
                    )
                );

            if (
                Number.isFinite(seconds)
            ) {

                return (
                    seconds * 1000
                ) + 1000;
            }
        }

        return 5000;
    },


    sleep(ms) {

        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        );
    },


    reset() {
        // Nothing to reset.
    }
};
