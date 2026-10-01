/* =========================================================
   SHITSUB - Gemini API Handler
   Reliable + Fast Plain-Text Translation
   ========================================================= */

const GeminiAPI = {

    currentParallelLimit: CONFIG.MAX_PARALLEL,
    retryDelay: CONFIG.INITIAL_RETRY_DELAY,

    // Prevent one Gemini request from hanging forever.
    REQUEST_TIMEOUT: 60000,

    /**
     * Detect unwanted Indian scripts.
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

        return (
            tamil > 0 ||
            telugu > 0 ||
            kannada > 0 ||
            hindi > 0
        );
    },


    /**
     * Detect English that Gemini failed to translate.
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

        // Exact same text = definitely untranslated.
        if (
            cleanOriginal &&
            cleanTranslated.toLowerCase() ===
            cleanOriginal.toLowerCase()
        ) {
            return true;
        }

        const malayalamCount =
            (cleanTranslated.match(/[\u0D00-\u0D7F]/g) || []).length;

        const englishCount =
            (cleanTranslated.match(/[A-Za-z]/g) || []).length;

        const totalLetters =
            (cleanTranslated.match(/\p{L}/gu) || []).length;

        /*
         * If there is no Malayalam and the result is
         * predominantly English, reject it.
         *
         * This allows names, brands, numbers, etc.
         */
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
     * Remove accidental Gemini prefixes.
     */
    cleanTranslation(text) {

        if (!text) {
            return "";
        }

        return text
            .trim()
            .replace(
                /^(Here's the translation:|Translation:|Malayalam:)\s*/i,
                ""
            )
            .trim();
    },


    /**
     * Request Gemini with a timeout.
     *
     * This prevents the translation from becoming
     * permanently stuck on one network request.
     */
    async requestGemini(
        requestBody,
        apiKey
    ) {

        const controller =
            new AbortController();

        const timeout =
            setTimeout(
                () => controller.abort(),
                this.REQUEST_TIMEOUT
            );

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
                    ),

                    signal: controller.signal
                }
            );

            if (!response.ok) {

                if (response.status === 429) {
                    throw new Error("RATE_LIMIT");
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
                    ?.content?.parts?.[0]
                    ?.text;

            if (!text || !text.trim()) {
                throw new Error(
                    "EMPTY_RESPONSE"
                );
            }

            return text;

        } catch (error) {

            if (
                error.name === "AbortError"
            ) {
                throw new Error(
                    "REQUEST_TIMEOUT"
                );
            }

            throw error;

        } finally {

            clearTimeout(timeout);
        }
    },


    /**
     * Extract translations separated by ~~~~.
     *
     * We deliberately use plain text instead of
     * responseSchema/JSON because that caused API 400 errors.
     */
    parseTranslations(text) {

        if (!text) {
            throw new Error(
                "Empty Gemini response"
            );
        }

        let cleaned =
            text.trim();

        // Remove accidental code fences.
        cleaned = cleaned
            .replace(/^```[\w-]*\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        const parts =
            cleaned
                .split("~~~~")
                .map(item => item.trim());

        return parts;
    },


    /**
     * Build normal batch prompt.
     */
    buildBatchPrompt(
        texts,
        customPrompt
    ) {

        return `${customPrompt}

SHITSUB APPLICATION RULES:

Translate EVERY subtitle below into natural, colloquial
spoken Kerala Malayalam.

ABSOLUTE REQUIREMENTS:

- Translate every input subtitle.
- Return exactly ONE translation for every subtitle.
- Keep exactly the same order.
- NEVER skip a subtitle.
- NEVER merge two subtitles.
- NEVER split one subtitle into multiple translations.
- NEVER summarize.
- NEVER explain.
- NEVER return numbering.
- NEVER return the original English sentence unchanged.
- Do NOT output Tamil.
- Do NOT output Telugu.
- Do NOT output Kannada.
- Do NOT output Hindi.
- Do NOT output Bengali.
- Do NOT output any other Indian language.
- Use natural Kerala Malayalam.
- Malayalam must sound like normal spoken Kerala Malayalam.
- Preserve meaning and context.
- Preserve emotion.
- Preserve sarcasm.
- Preserve humor.
- Preserve slang.
- Preserve insults and profanity.
- Do not censor or soften dialogue.
- Preserve <i>, <b>, <u> and other formatting tags.
- Preserve ||| exactly for subtitle line breaks.
- English words are allowed only where naturally appropriate,
  such as names, brands, places, acronyms and technical terms.

OUTPUT FORMAT:

Return ONLY the translations.

Separate EVERY translation using exactly:

~~~~

Do not use ~~~~ anywhere inside a translation.

SUBTITLES:

${texts
    .map(
        (text, index) =>
            `SUBTITLE ${index + 1}:
${text}`
    )
    .join("\n\n")}

FINAL CHECK BEFORE ANSWERING:

Make sure the number of translations is exactly ${texts.length}.
Make sure every English dialogue sentence has been translated.
Make sure the output is Kerala Malayalam.
Make sure no Tamil, Telugu, Kannada, Hindi or other Indian script appears.
`;
    },


    /**
     * Translate one subtitle.
     *
     * Used only when a batch translation fails validation.
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

SHITSUB SINGLE SUBTITLE RETRY.

Translate this subtitle into natural,
colloquial Kerala Malayalam.

STRICT RULES:

- Translate the complete English dialogue.
- Do not leave the sentence in English.
- Do not output Tamil.
- Do not output Telugu.
- Do not output Kannada.
- Do not output Hindi.
- Do not output another Indian language.
- Preserve meaning.
- Preserve emotion.
- Preserve slang.
- Preserve profanity.
- Do not censor.
- Do not explain.
- Do not summarize.
- Preserve formatting tags.
- Preserve ||| for multi-line subtitles.

Return ONLY the Malayalam translation.
Do not add numbering.
Do not add explanations.
Do not use ~~~~.

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

                topK: 40
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

                const text =
                    await this.requestGemini(
                        requestBody,
                        apiKey
                    );

                const cleaned =
                    this.cleanTranslation(text);

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
                    error.message === "RATE_LIMIT"
                ) {
                    throw error;
                }

                if (
                    attempt < CONFIG.MAX_RETRIES
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
     * Translate one chunk.
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

                    textsToTranslate.push(
                        SRTParser.protectFormatting(
                            sub.text
                        )
                    );
                }
            }
        );

        // Blank subtitle blocks stay blank.
        if (
            textsToTranslate.length === 0
        ) {
            return chunk;
        }

        const expectedCount =
            textsToTranslate.length;

        const prompt =
            this.buildBatchPrompt(
                textsToTranslate,
                customPrompt
            );

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

                maxOutputTokens:
                    Math.max(
                        4096,
                        expectedCount * 180
                    ),

                topP: 0.95,

                topK: 40
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

                const text =
                    await this.requestGemini(
                        requestBody,
                        apiKey
                    );

                const translations =
                    this.parseTranslations(text);

                /*
                 * Exact count is mandatory.
                 */
                if (
                    translations.length !==
                    expectedCount
                ) {

                    throw new Error(
                        `TRANSLATION_COUNT_MISMATCH: expected ${expectedCount}, got ${translations.length}`
                    );
                }

                const result =
                    [...chunk];

                const invalidIndices = [];

                /*
                 * Validate every translation.
                 */
                nonEmptyIndices.forEach(
                    (idx, i) => {

                        const raw =
                            translations[i];

                        const cleaned =
                            this.cleanTranslation(
                                raw
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

                            invalidIndices.push(idx);
                        }
                    }
                );

                /*
                 * Retry invalid subtitles individually.
                 *
                 * This is normally zero requests.
                 * It only happens when Gemini gives
                 * a bad translation.
                 */
                for (
                    const idx of invalidIndices
                ) {

                    const corrected =
                        await this.translateSingleSubtitle(
                            chunk[idx],
                            apiKey,
                            customPrompt
                        );

                    result[idx] =
                        corrected;
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
                    `Gemini batch attempt ${attempt}/${CONFIG.MAX_RETRIES}:`,
                    error.message
                );

                if (
                    attempt < CONFIG.MAX_RETRIES
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
     * Fast parallel translation with safe rate-limit handling.
     *
     * Unlike the old system, this does NOT manipulate
     * the loop index when rate limiting occurs.
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

        let nextIndex = 0;

        /*
         * Worker function.
         *
         * Workers safely take the next chunk.
         */
        const worker = async () => {

            while (true) {

                if (
                    nextIndex >= chunks.length
                ) {
                    return;
                }

                const index =
                    nextIndex++;

                let translated = false;

                while (!translated) {

                    try {

                        results[index] =
                            await this.translateChunk(
                                chunks[index],
                                apiKey,
                                customPrompt
                            );

                        translated = true;

                        completed++;

                        if (onProgress) {
                            onProgress(
                                completed,
                                chunks.length
                            );
                        }

                    } catch (error) {

                        if (
                            error.message ===
                            "RATE_LIMIT"
                        ) {

                            /*
                             * Reduce future concurrency.
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
                                    Math.max(
                                        this.retryDelay * 2,
                                        2000
                                    )
                                );

                            console.warn(
                                `Rate limit detected. Waiting ${this.retryDelay}ms.`
                            );

                            await this.sleep(
                                this.retryDelay
                            );

                            continue;
                        }

                        /*
                         * Retry failed network/API requests
                         * instead of freezing the whole app.
                         */
                        console.warn(
                            `Chunk ${index + 1} failed:`,
                            error.message
                        );

                        await this.sleep(
                            this.retryDelay
                        );
                    }
                }
            }
        };


        /*
         * Start workers.
         *
         * Initial concurrency comes from CONFIG.
         */
        const workerCount =
            Math.min(
                this.currentParallelLimit,
                chunks.length
            );

        const workers =
            Array.from(
                {
                    length: workerCount
                },
                () => worker()
            );

        await Promise.all(workers);

        /*
         * Final safety check.
         */
        for (
            let i = 0;
            i < results.length;
            i++
        ) {

            if (!results[i]) {

                throw new Error(
                    `Translation incomplete: chunk ${i + 1} was not completed.`
                );
            }
        }

        return results;
    },


    /**
     * Sleep.
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
     * Reset.
     */
    reset() {

        this.currentParallelLimit =
            CONFIG.MAX_PARALLEL;

        this.retryDelay =
            CONFIG.INITIAL_RETRY_DELAY;
    }
};
