/* =========================================================
   SHITSUB - Gemini API Handler
   ========================================================= */
const GeminiAPI = {
    currentParallelLimit: CONFIG.MAX_PARALLEL,
    retryDelay: CONFIG.INITIAL_RETRY_DELAY,
    /**
     * Detect whether text contains scripts that should NOT appear
     * in a Kerala Malayalam translation.
     *
     * Malayalam:       U+0D00–U+0D7F
     * Tamil:           U+0B80–U+0BFF
     * Telugu:          U+0C00–U+0C7F
     * Kannada:         U+0C80–U+0CFF
     * Hindi/Devanagari:U+0900–U+097F
     */
    hasWrongLanguage(text) {
        if (!text || !text.trim()) {
            return true;
        }
        const tamil =
            (text.match(/[\u0B80-\u0BFF]/g) || []).length;
        const telugu =
            (text.match(/[\u0C00-\u0C7F]/g) || []).length;
        const kannada =
            (text.match(/[\u0C80-\u0CFF]/g) || []).length;
        const hindi =
            (text.match(/[\u0900-\u097F]/g) || []).length;
        if (
            tamil > 0 ||
            telugu > 0 ||
            kannada > 0 ||
            hindi > 0
        ) {
            return true;
        }
        return false;
    },
    /**
     * Detect subtitles that Gemini accidentally left in English.
     *
     * This is intentionally conservative.
     * Normal English words inside Malayalam are allowed.
     */
    looksUntranslated(original, translated) {
        if (!original || !translated) {
            return true;
        }
        const cleanOriginal = original
            .replace(/<[^>]+>/g, "")
            .replace(/\|\|\|/g, " ")
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .replace(/\s+/g, " ")
            .trim();
        const cleanTranslated = translated
            .replace(/<[^>]+>/g, "")
            .replace(/\|\|\|/g, " ")
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .replace(/\s+/g, " ")
            .trim();
        if (!cleanTranslated) {
            return true;
        }
        // Exact same text means it was not translated.
        if (
            cleanOriginal.length > 0 &&
            cleanTranslated.toLowerCase() ===
                cleanOriginal.toLowerCase()
        ) {
            return true;
        }
        const malayalamCount =
            (cleanTranslated.match(/[\u0D00-\u0D7F]/g) || [])
                .length;
        const englishCount =
            (cleanTranslated.match(/[A-Za-z]/g) || []).length;
        const totalLetters =
            (cleanTranslated.match(/\p{L}/gu) || []).length;
        // No Malayalam + mostly Latin letters = probably
        // untranslated English.
        if (
            malayalamCount === 0 &&
            englishCount > 0 &&
            totalLetters > 0 &&
            englishCount / totalLetters > 0.75
        ) {
            return true;
        }
        return false;
    },
    /**
     * Complete translation validation.
     */
    isTranslationValid(original, translated) {
        if (!translated || !translated.trim()) {
            return false;
        }
        if (this.hasWrongLanguage(translated)) {
            return false;
        }
        if (
            this.looksUntranslated(
                original,
                translated
            )
        ) {
            return false;
        }
        return true;
    },
    /**
     * Build the JSON schema dynamically.
     *
     * The number of translations is tied to the number of
     * subtitles in the current request.
     *
     * This removes the fragile ~~~~ separator system.
     */
    buildBatchSchema(count) {
        return {
            type: "object",
            properties: {
                translations: {
                    type: "array",
                    description:
                        `Exactly ${count} translations, in exactly the same order as the input subtitles.`,
                    minItems: count,
                    maxItems: count,
                    items: {
                        type: "string"
                    }
                }
            },
            required: ["translations"],
            additionalProperties: false
        };
    },
    /**
     * Schema for translating one subtitle.
     */
    buildSingleSchema() {
        return {
            type: "object",
            properties: {
                translation: {
                    type: "string",
                    description:
                        "The translated subtitle in natural spoken Kerala Malayalam."
                }
            },
            required: ["translation"],
            additionalProperties: false
        };
    },
    /**
     * Safely extract JSON from Gemini's response.
     */
    parseJsonResponse(text) {
        if (!text) {
            throw new Error(
                "Empty response from Gemini"
            );
        }
        let cleaned = text.trim();
        // Remove accidental markdown code fences if present.
        cleaned = cleaned
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
        try {
            return JSON.parse(cleaned);
        } catch (error) {
            throw new Error(
                "Invalid JSON response from Gemini"
            );
        }
    },
    /**
     * Clean common Gemini prefixes from a translation.
     */
    cleanTranslation(text) {
        if (!text) {
            return "";
        }
        return text
            .trim()
            .replace(
                /^(Here's the translation:|Translation:|Malayalam:|സ്വാഗതം:)\s*/i,
                ""
            )
            .trim();
    },
    /**
     * Translate ONE subtitle.
     *
     * This is only used when the normal batch result contains
     * a subtitle that fails validation.
     */
    async translateSingleSubtitle(
        subtitle,
        apiKey,
        customPrompt
    ) {
        const protectedText =
            SRTParser.protectFormatting(
                subtitle.text
            );
        const prompt = `${customPrompt}
IMPORTANT APPLICATION REQUIREMENTS:
You are translating ONE subtitle for ShitSub.
Translate the subtitle into natural, colloquial Kerala Malayalam.
STRICT LANGUAGE RULES:
- The final translation must be Malayalam.
- NEVER output Tamil.
- NEVER output Telugu.
- NEVER output Kannada.
- NEVER output Hindi or Devanagari.
- Do not use another Indian language.
- English words are allowed only when they are naturally used in Kerala Malayalam or are names, brands, places, acronyms, technical terms, etc.
- A complete English sentence MUST be translated.
STRICT SUBTITLE RULES:
- Preserve the exact meaning.
- Preserve emotion, sarcasm, humor, anger, fear, romance, insults and profanity.
- Do not censor.
- Do not summarize.
- Do not explain.
- Preserve formatting tags such as <i>, <b>, <u>.
- Preserve ||| for multi-line subtitles.
- Return only the translation inside the required JSON field.
IMPORTANT:
The application requires JSON output.
Do NOT use ~~~~ separators.
Do NOT add markdown.
Do NOT add explanations.
SUBTITLE:
${protectedText}`;
        const requestBody = {
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 512,
                topP: 0.95,
                topK: 40,
                responseMimeType:
                    "application/json",
                responseSchema:
                    this.buildSingleSchema()
            },
            safetySettings: [
                {
                    category:
                        "HARM_CATEGORY_HARASSMENT",
                    threshold:
                        "BLOCK_NONE"
                },
                {
                    category:
                        "HARM_CATEGORY_HATE_SPEECH",
                    threshold:
                        "BLOCK_NONE"
                },
                {
                    category:
                        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold:
                        "BLOCK_NONE"
                },
                {
                    category:
                        "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold:
                        "BLOCK_NONE"
                }
            ]
        };
        let lastError = null;
        for (
            let attempt = 1;
            attempt <= CONFIG.MAX_RETRIES;
            attempt++
        ) {
            try {
                const response = await fetch(
                    `${CONFIG.API_URL}?key=${encodeURIComponent(apiKey)}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body: JSON.stringify(
                            requestBody
                        )
                    }
                );
                if (!response.ok) {
                    if (
                        response.status === 429
                    ) {
                        throw new Error(
                            "RATE_LIMIT"
                        );
                    }
                    const errorText =
                        await response.text();
                    throw new Error(
                        `API error ${response.status}: ${errorText}`
                    );
                }
                const data =
                    await response.json();
                const text =
                    data?.candidates?.[0]
                        ?.content?.parts?.[0]?.text;
                const parsed =
                    this.parseJsonResponse(text);
                if (
                    !parsed ||
                    typeof parsed.translation !==
                        "string"
                ) {
                    throw new Error(
                        "Invalid structured translation response"
                    );
                }
                const cleaned =
                    this.cleanTranslation(
                        parsed.translation
                    );
                const restored =
                    SRTParser.restoreFormatting(
                        cleaned
                    );
                if (
                    !SRTParser.validate(
                        subtitle.text,
                        restored
                    )
                ) {
                    throw new Error(
                        `SRT validation failed for subtitle ${subtitle.index}`
                    );
                }
                if (
                    !this.isTranslationValid(
                        subtitle.text,
                        restored
                    )
                ) {
                    throw new Error(
                        `Language validation failed for subtitle ${subtitle.index}`
                    );
                }
                return {
                    ...subtitle,
                    text: restored
                };
            } catch (error) {
                lastError = error;
                if (
                    error.message ===
                    "RATE_LIMIT"
                ) {
                    throw error;
                }
                if (
                    attempt <
                    CONFIG.MAX_RETRIES
                ) {
                    const delay =
                        Math.min(
                            CONFIG.INITIAL_RETRY_DELAY *
                                Math.pow(
                                    2,
                                    attempt - 1
                                ),
                            CONFIG.MAX_RETRY_DELAY
                        );
                    await this.sleep(delay);
                }
            }
        }
        throw (
            lastError ||
            new Error(
                `Failed to translate subtitle ${subtitle.index}`
            )
        );
    },
    /**
     * Translate a chunk of subtitles.
     */
    async translateChunk(
        chunk,
        apiKey,
        customPrompt
    ) {
        const nonEmptyIndices = [];
        const textsToTranslate = [];
        chunk.forEach(
            (sub, idx) => {
                if (!sub.isEmpty) {
                    nonEmptyIndices.push(idx);
                    const protectedText =
                        SRTParser.protectFormatting(
                            sub.text
                        );
                    textsToTranslate.push(
                        protectedText
                    );
                }
            }
        );
        // If everything is empty, return unchanged.
        if (
            textsToTranslate.length === 0
        ) {
            return chunk;
        }
        const expectedCount =
            textsToTranslate.length;
        /*
         * IMPORTANT:
         *
         * We now use JSON instead of ~~~~.
         * Gemini is required to return exactly
         * expectedCount translation strings.
         */
        const prompt = `${customPrompt}
SHITSUB TRANSLATION TASK
Translate EVERY subtitle below into natural, colloquial Kerala Malayalam.
IMPORTANT APPLICATION RULES:
1. Translate every subtitle.
2. Return exactly ${expectedCount} translations.
3. Keep the exact same order.
4. NEVER skip a subtitle.
5. NEVER merge subtitles.
6. NEVER summarize subtitles.
7. NEVER return the original English sentence unchanged.
8. Do not output Tamil.
9. Do not output Telugu.
10. Do not output Kannada.
11. Do not output Hindi or Devanagari.
12. Do not output another Indian language.
13. Natural English words inside Malayalam are allowed when appropriate.
14. Preserve the original meaning and emotion.
15. Preserve slang, insults, profanity, sarcasm and humor.
16. Preserve <i>, <b>, <u> and other formatting tags.
17. Preserve ||| for multi-line subtitles.
18. Do not add explanations.
19. Do not add numbering.
20. Do not use ~~~~ as a separator.
The application requires JSON output according to the supplied schema.
SUBTITLES:
${textsToTranslate
    .map(
        (text, index) =>
            `SUBTITLE ${index + 1}:\n${text}`
    )
    .join("\n\n")}`;
        const requestBody = {
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.3,
                /*
                 * 4096 gives the model enough room for
                 * larger 25-subtitle batches and JSON.
                 */
                maxOutputTokens: 4096,
                topP: 0.95,
                topK: 40,
                /*
                 * Structured JSON output.
                 */
                responseMimeType:
                    "application/json",
                responseSchema:
                    this.buildBatchSchema(
                        expectedCount
                    )
            },
            safetySettings: [
                {
                    category:
                        "HARM_CATEGORY_HARASSMENT",
                    threshold:
                        "BLOCK_NONE"
                },
                {
                    category:
                        "HARM_CATEGORY_HATE_SPEECH",
                    threshold:
                        "BLOCK_NONE"
                },
                {
                    category:
                        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold:
                        "BLOCK_NONE"
                },
                {
                    category:
                        "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold:
                        "BLOCK_NONE"
                }
            ]
        };
        let lastError = null;
        for (
            let attempt = 1;
            attempt <= CONFIG.MAX_RETRIES;
            attempt++
        ) {
            try {
                const response = await fetch(
                    `${CONFIG.API_URL}?key=${encodeURIComponent(apiKey)}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body: JSON.stringify(
                            requestBody
                        )
                    }
                );
                if (!response.ok) {
                    if (
                        response.status === 429
                    ) {
                        throw new Error(
                            "RATE_LIMIT"
                        );
                    }
                    const errorText =
                        await response.text();
                    throw new Error(
                        `API error ${response.status}: ${errorText}`
                    );
                }
                const data =
                    await response.json();
                const text =
                    data?.candidates?.[0]
                        ?.content?.parts?.[0]?.text;
                const parsed =
                    this.parseJsonResponse(text);
                if (
                    !parsed ||
                    !Array.isArray(
                        parsed.translations
                    )
                ) {
                    throw new Error(
                        "Invalid structured response: translations array missing"
                    );
                }
                /*
                 * The schema should enforce this, but we
                 * still validate locally.
                 */
                if (
                    parsed.translations.length !==
                    expectedCount
                ) {
                    throw new Error(
                        `TRANSLATION_COUNT_MISMATCH: expected ${expectedCount}, got ${parsed.translations.length}`
                    );
                }
                const result = [...chunk];
                const invalidSubtitles = [];
                /*
                 * Validate every returned translation.
                 */
                nonEmptyIndices.forEach(
                    (idx, i) => {
                        const rawTranslation =
                            parsed.translations[i];
                        if (
                            typeof rawTranslation !==
                            "string"
                        ) {
                            invalidSubtitles.push(
                                idx
                            );
                            return;
                        }
                        const cleaned =
                            this.cleanTranslation(
                                rawTranslation
                            );
                        const restored =
                            SRTParser.restoreFormatting(
                                cleaned
                            );
                        const structureValid =
                            SRTParser.validate(
                                chunk[idx].text,
                                restored
                            );
                        const languageValid =
                            this.isTranslationValid(
                                chunk[idx].text,
                                restored
                            );
                        if (
                            structureValid &&
                            languageValid
                        ) {
                            result[idx] = {
                                ...chunk[idx],
                                text: restored
                            };
                        } else {
                            invalidSubtitles.push(
                                idx
                            );
                            console.warn(
                                `⚠️ Translation validation failed for subtitle ${chunk[idx].index}`
                            );
                        }
                    }
                );
                /*
                 * Retry ONLY invalid subtitles.
                 *
                 * Normal translations require no additional
                 * API request.
                 */
                for (
                    const idx of
                    invalidSubtitles
                ) {
                    try {
                        const corrected =
                            await this.translateSingleSubtitle(
                                chunk[idx],
                                apiKey,
                                customPrompt
                            );
                        result[idx] =
                            corrected;
                    } catch (error) {
                        if (
                            error.message ===
                            "RATE_LIMIT"
                        ) {
                            throw error;
                        }
                        /*
                         * Do NOT silently put the original
                         * English back.
                         *
                         * Failing loudly is safer because
                         * ShitSub promises complete translation.
                         */
                        throw new Error(
                            `Subtitle ${chunk[idx].index} could not be translated correctly after retries. ${error.message}`
                        );
                    }
                }
                return result;
            } catch (error) {
                lastError = error;
                if (
                    error.message ===
                    "RATE_LIMIT"
                ) {
                    throw error;
                }
                console.warn(
                    `⚠️ Gemini batch attempt ${attempt}/${CONFIG.MAX_RETRIES} failed:`,
                    error.message
                );
                if (
                    attempt <
                    CONFIG.MAX_RETRIES
                ) {
                    const delay =
                        Math.min(
                            CONFIG.INITIAL_RETRY_DELAY *
                                Math.pow(
                                    2,
                                    attempt - 1
                                ),
                            CONFIG.MAX_RETRY_DELAY
                        );
                    await this.sleep(delay);
                }
            }
        }
        throw (
            lastError ||
            new Error(
                "Translation failed after retries"
            )
        );
    },
    /**
     * Translate with automatic throttling.
     */
    async translateWithThrottling(
        chunks,
        apiKey,
        customPrompt,
        onProgress
    ) {
        const results =
            new Array(chunks.length);
        let completed = 0;
        for (
            let i = 0;
            i < chunks.length;
            i += this.currentParallelLimit
        ) {
            const batch =
                chunks.slice(
                    i,
                    i +
                        this.currentParallelLimit
                );
            const batchIndices =
                Array.from(
                    {
                        length:
                            batch.length
                    },
                    (_, idx) =>
                        i + idx
                );
            try {
                /*
                 * Process chunks in parallel.
                 *
                 * This part remains the same as your
                 * original system, so normal translation
                 * speed is preserved.
                 */
                const batchResults =
                    await Promise.all(
                        batch.map(
                            chunk =>
                                this.translateChunk(
                                    chunk,
                                    apiKey,
                                    customPrompt
                                )
                        )
                    );
                batchResults.forEach(
                    (result, idx) => {
                        results[
                            batchIndices[idx]
                        ] = result;
                    }
                );
                completed +=
                    batch.length;
                if (onProgress) {
                    onProgress(
                        completed,
                        chunks.length
                    );
                }
                /*
                 * Gradually increase parallel speed
                 * after successful batches.
                 */
                if (
                    this.currentParallelLimit <
                    CONFIG.MAX_PARALLEL
                ) {
                    this.currentParallelLimit =
                        Math.min(
                            CONFIG.MAX_PARALLEL,
                            this.currentParallelLimit +
                                2
                        );
                }
                if (
                    this.retryDelay >
                    CONFIG.INITIAL_RETRY_DELAY
                ) {
                    this.retryDelay =
                        Math.max(
                            CONFIG.INITIAL_RETRY_DELAY,
                            this.retryDelay - 200
                        );
                }
                /*
                 * Small delay between batches.
                 */
                if (
                    i +
                        this.currentParallelLimit <
                    chunks.length
                ) {
                    await this.sleep(
                        CONFIG.BATCH_DELAY
                    );
                }
            } catch (error) {
                if (
                    error.message ===
                    "RATE_LIMIT"
                ) {
                    /*
                     * Reduce parallel requests.
                     */
                    this.currentParallelLimit =
                        Math.max(
                            CONFIG.MIN_PARALLEL,
                            Math.floor(
                                this.currentParallelLimit /
                                    2
                            )
                        );
                    this.retryDelay =
                        Math.min(
                            CONFIG.MAX_RETRY_DELAY,
                            this.retryDelay * 2
                        );
                    console.log(
                        `⚠️ Rate limited. Reducing to ${this.currentParallelLimit} parallel requests`
                    );
                    console.log(
                        `⏳ Waiting ${this.retryDelay}ms before retry...`
                    );
                    await this.sleep(
                        this.retryDelay
                    );
                    /*
                     * Retry the failed batch.
                     */
                    i -=
                        this.currentParallelLimit;
                    continue;
                }
                /*
                 * Any non-rate-limit error stops the
                 * translation instead of silently
                 * producing incorrect subtitles.
                 */
                throw error;
            }
        }
        return results;
    },
    /**
     * Sleep utility.
     */
    sleep(ms) {
        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        );
    },
    /**
     * Reset throttling state.
     */
    reset() {
        this.currentParallelLimit =
            CONFIG.MAX_PARALLEL;
        this.retryDelay =
            CONFIG.INITIAL_RETRY_DELAY;
    }
};
