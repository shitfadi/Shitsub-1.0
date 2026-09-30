/* =========================================================
   SHITSUB - Gemini API Handler
   ========================================================= */
const GeminiAPI = {
    currentParallelLimit: CONFIG.MAX_PARALLEL,
    retryDelay: CONFIG.INITIAL_RETRY_DELAY,
    /**
     * Check whether the translation is still mostly/entirely English.
     * This is intentionally conservative so normal English words
     * used naturally inside Malayalam are not rejected.
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
        // If the entire translated text is exactly the same as
        // the original, Gemini clearly did not translate it.
        if (
            cleanOriginal.length > 0 &&
            cleanTranslated.toLowerCase() === cleanOriginal.toLowerCase()
        ) {
            return true;
        }
        // Detect whether the translated text contains Malayalam.
        const malayalamCount =
            (cleanTranslated.match(/[\u0D00-\u0D7F]/g) || []).length;
        // Count Latin letters.
        const englishCount =
            (cleanTranslated.match(/[A-Za-z]/g) || []).length;
        // Count all meaningful letters.
        const totalLetterCount =
            (cleanTranslated.match(/\p{L}/gu) || []).length;
        // If there is no Malayalam at all and the text is mostly
        // Latin letters, treat it as untranslated English.
        if (
            malayalamCount === 0 &&
            englishCount > 0 &&
            totalLetterCount > 0 &&
            englishCount / totalLetterCount > 0.75
        ) {
            return true;
        }
        return false;
    },
    /**
     * Detect scripts from other Indian languages.
     *
     * Malayalam naturally uses the Malayalam Unicode block.
     * We reject Tamil, Telugu and Kannada scripts because these
     * are common accidental outputs in Malayalam translation.
     */
    hasWrongLanguage(text) {
        if (!text) {
            return true;
        }
        const tamil =
            (text.match(/[\u0B80-\u0BFF]/g) || []).length;
        const telugu =
            (text.match(/[\u0C00-\u0C7F]/g) || []).length;
        const kannada =
            (text.match(/[\u0C80-\u0CFF]/g) || []).length;
        if (tamil > 0 || telugu > 0 || kannada > 0) {
            return true;
        }
        return false;
    },
    /**
     * Check whether a translation is acceptable.
     */
    isTranslationValid(original, translated) {
        if (!translated || !translated.trim()) {
            return false;
        }
        if (this.hasWrongLanguage(translated)) {
            return false;
        }
        if (this.looksUntranslated(original, translated)) {
            return false;
        }
        return true;
    },
    /**
     * Translate one individual subtitle.
     *
     * This is used ONLY when the normal chunk translation produces
     * an untranslated or wrong-language subtitle.
     *
     * Normal subtitles do not use this extra request.
     */
    async translateSingleSubtitle(subtitle, apiKey, customPrompt) {
        const protectedText = SRTParser.protectFormatting(subtitle.text);
        const prompt = `${customPrompt}
IMPORTANT:
This is a correction request for ONE subtitle.
Translate the subtitle into natural, colloquial Kerala Malayalam.
STRICT REQUIREMENTS:
- The original subtitle MUST be translated.
- Do NOT leave a complete English sentence unchanged.
- Do NOT output Tamil.
- Do NOT output Telugu.
- Do NOT output Kannada.
- Use natural spoken Kerala Malayalam.
- Preserve the exact meaning, emotion, attitude, humor, sarcasm, insults and profanity.
- Preserve <i>, <b>, <u> and other formatting tags.
- Preserve ||| for multi-line subtitles.
- Do not add explanations.
- Do not add numbering.
- Return ONLY the translated subtitle.
SUBTITLE:
${protectedText}`;
        const requestBody = {
            contents: [{
                role: "user",
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 512,
                topP: 0.95,
                topK: 40
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_NONE"
                }
            ]
        };
        let lastError = null;
        for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(
                    `${CONFIG.API_URL}?key=${encodeURIComponent(apiKey)}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(requestBody)
                    }
                );
                if (!response.ok) {
                    if (response.status === 429) {
                        throw new Error("RATE_LIMIT");
                    }
                    const errorText = await response.text();
                    throw new Error(
                        `API error ${response.status}: ${errorText}`
                    );
                }
                const data = await response.json();
                const text =
                    data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) {
                    throw new Error("Empty response from Gemini");
                }
                let translated = text
                    .trim()
                    .replace(
                        /^(Here's the translation:|Translation:|Malayalam:|സ്വാഗതം:)\s*/i,
                        ""
                    )
                    .trim();
                const restored =
                    SRTParser.restoreFormatting(translated);
                // First check the SRT structure.
                if (
                    !SRTParser.validate(
                        subtitle.text,
                        restored
                    )
                ) {
                    throw new Error(
                        `Validation failed for subtitle ${subtitle.index}`
                    );
                }
                // Then check language.
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
                // Rate limit gets handled by the main throttling system.
                if (error.message === "RATE_LIMIT") {
                    throw error;
                }
                if (attempt < CONFIG.MAX_RETRIES) {
                    const delay = Math.min(
                        CONFIG.INITIAL_RETRY_DELAY *
                            Math.pow(2, attempt - 1),
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
     * Translate a chunk of subtitles via Gemini API
     * @param {Array} chunk - Array of subtitle objects
     * @param {string} apiKey - Gemini API key
     * @param {string} customPrompt - Custom translation prompt
     * @returns {Promise<Array>} Translated subtitles
     */
    async translateChunk(chunk, apiKey, customPrompt) {
        // Skip empty subtitles
        const nonEmptyIndices = [];
        const textsToTranslate = [];
        chunk.forEach((sub, idx) => {
            if (!sub.isEmpty) {
                nonEmptyIndices.push(idx);
                // Protect formatting before sending
                const protectedText =
                    SRTParser.protectFormatting(sub.text);
                textsToTranslate.push(protectedText);
            }
        });
        // If all empty, return as-is
        if (textsToTranslate.length === 0) {
            return chunk;
        }
        // Build prompt
        const prompt = `${customPrompt}
SUBTITLES TO TRANSLATE (one per subtitle, separated by ~~~~):
${textsToTranslate.join('\n~~~~\n')}
IMPORTANT:
- Translate EVERY subtitle separately.
- Return exactly ONE translation for every subtitle.
- Preserve the exact order.
- Preserve ||| separator for multi-line subtitles.
- Preserve formatting tags.
- Do not skip any subtitle.
- Do not merge subtitles.
- Do not summarize.
- Do not add explanations or numbering.
- Use natural spoken Kerala Malayalam.
- Do not output Tamil, Telugu, Kannada or other Indian languages.
- Complete English sentences must not remain untranslated.`;
        const requestBody = {
            contents: [{
                role: "user",
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048,
                topP: 0.95,
                topK: 40
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_NONE"
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
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(requestBody)
                    }
                );
                if (!response.ok) {
                    if (response.status === 429) {
                        throw new Error("RATE_LIMIT");
                    }
                    const errorText = await response.text();
                    throw new Error(
                        `API error ${response.status}: ${errorText}`
                    );
                }
                const data = await response.json();
                const text =
                    data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) {
                    throw new Error(
                        "Empty response from Gemini"
                    );
                }
                // Parse translations
                const translations = text
                    .split("~~~~")
                    .map(t => t.trim())
                    .map(t => {
                        return t
                            .replace(
                                /^(Here's the translation:|Translation:|Malayalam:|സ്വാഗതം:)\s*/i,
                                ""
                            )
                            .trim();
                    })
                    .filter(t => t.length > 0);
                // IMPORTANT:
                // Never pad missing translations with the original
                // English text. That was one of the reasons English
                // subtitles could silently remain in the result.
                if (
                    translations.length !==
                    textsToTranslate.length
                ) {
                    throw new Error(
                        `TRANSLATION_COUNT_MISMATCH: expected ${textsToTranslate.length}, got ${translations.length}`
                    );
                }
                // Map translations back to chunk
                const result = [...chunk];
                const invalidSubtitles = [];
                nonEmptyIndices.forEach((idx, i) => {
                    const restored =
                        SRTParser.restoreFormatting(
                            translations[i]
                        );
                    // Validate structure AND language.
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
                        // Do not silently keep the English text.
                        // Mark it for individual correction.
                        invalidSubtitles.push(idx);
                        console.warn(
                            `⚠️ Translation validation failed for subtitle ${chunk[idx].index}`
                        );
                    }
                });
                // Retry ONLY the invalid subtitles.
                //
                // This means normal translations keep their original
                // speed. Only problematic subtitles make an additional
                // Gemini request.
                for (const idx of invalidSubtitles) {
                    try {
                        const corrected =
                            await this.translateSingleSubtitle(
                                chunk[idx],
                                apiKey,
                                customPrompt
                            );
                        result[idx] = corrected;
                    } catch (error) {
                        // Rate limits must reach the main throttling
                        // system.
                        if (
                            error.message ===
                            "RATE_LIMIT"
                        ) {
                            throw error;
                        }
                        console.warn(
                            `⚠️ Could not correct subtitle ${chunk[idx].index}:`,
                            error.message
                        );
                        // Keep the original only if Gemini completely
                        // fails to produce a valid replacement.
                        //
                        // This avoids corrupting the SRT structure.
                        result[idx] = {
                            ...chunk[idx]
                        };
                    }
                }
                return result;
            } catch (error) {
                lastError = error;
                if (error.message === "RATE_LIMIT") {
                    throw error;
                }
                if (attempt < CONFIG.MAX_RETRIES) {
                    const delay = Math.min(
                        CONFIG.INITIAL_RETRY_DELAY *
                            Math.pow(2, attempt - 1),
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
     * Translate with automatic throttling
     * @param {Array} chunks - Array of subtitle chunks
     * @param {string} apiKey - Gemini API key
     * @param {string} customPrompt - Custom translation prompt
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Array>} All translated subtitles
     */
    async translateWithThrottling(
        chunks,
        apiKey,
        customPrompt,
        onProgress
    ) {
        const results = new Array(chunks.length);
        let completed = 0;
        for (
            let i = 0;
            i < chunks.length;
            i += this.currentParallelLimit
        ) {
            const batch = chunks.slice(
                i,
                i + this.currentParallelLimit
            );
            const batchIndices = Array.from(
                { length: batch.length },
                (_, idx) => i + idx
            );
            try {
                // Process batch in parallel
                const batchResults = await Promise.all(
                    batch.map(chunk =>
                        this.translateChunk(
                            chunk,
                            apiKey,
                            customPrompt
                        )
                    )
                );
                // Store results
                batchResults.forEach((result, idx) => {
                    results[batchIndices[idx]] = result;
                });
                completed += batch.length;
                // Report progress
                if (onProgress) {
                    onProgress(
                        completed,
                        chunks.length
                    );
                }
                // Success - gradually increase speed
                if (
                    this.currentParallelLimit <
                    CONFIG.MAX_PARALLEL
                ) {
                    this.currentParallelLimit =
                        Math.min(
                            CONFIG.MAX_PARALLEL,
                            this.currentParallelLimit + 2
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
                // Small delay between batches
                if (
                    i + this.currentParallelLimit <
                    chunks.length
                ) {
                    await this.sleep(
                        CONFIG.BATCH_DELAY
                    );
                }
            } catch (error) {
                if (
                    error.message === "RATE_LIMIT"
                ) {
                    // Throttle down
                    this.currentParallelLimit =
                        Math.max(
                            CONFIG.MIN_PARALLEL,
                            Math.floor(
                                this.currentParallelLimit / 2
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
                    // Retry this batch
                    i -= this.currentParallelLimit;
                    continue;
                }
                throw error;
            }
        }
        return results;
    },
    /**
     * Sleep utility
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise}
     */
    sleep(ms) {
        return new Promise(resolve =>
            setTimeout(resolve, ms)
        );
    },
    /**
     * Reset throttling state
     */
    reset() {
        this.currentParallelLimit =
            CONFIG.MAX_PARALLEL;
        this.retryDelay =
            CONFIG.INITIAL_RETRY_DELAY;
    }
};
