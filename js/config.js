const GeminiAPI = {
    currentParallelLimit: CONFIG.MAX_PARALLEL,
    retryDelay: CONFIG.INITIAL_RETRY_DELAY,

    hasWrongLanguage(text) {
        if (!text) return true;

        return (
            /[\u0B80-\u0BFF]/.test(text) ||
            /[\u0C00-\u0C7F]/.test(text) ||
            /[\u0C80-\u0CFF]/.test(text) ||
            /[\u0900-\u097F]/.test(text)
        );
    },

    looksUntranslated(original, translated) {
        if (!original || !translated) return true;

        const clean = text => text
            .replace(/<[^>]+>/g, "")
            .replace(/\|\|\|/g, " ")
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .replace(/\s+/g, " ")
            .trim();

        const a = clean(original);
        const b = clean(translated);

        if (!b) return true;

        if (a.toLowerCase() === b.toLowerCase()) {
            return true;
        }

        const malayalam =
            (b.match(/[\u0D00-\u0D7F]/g) || []).length;

        const english =
            (b.match(/[A-Za-z]/g) || []).length;

        const total =
            (b.match(/\p{L}/gu) || []).length;

        return (
            malayalam === 0 &&
            english > 0 &&
            total > 0 &&
            english / total > 0.75
        );
    },

    isValid(original, translated) {
        return (
            translated &&
            translated.trim() &&
            !this.hasWrongLanguage(translated) &&
            !this.looksUntranslated(original, translated)
        );
    },

    parseJSON(text) {
        if (!text) {
            throw new Error("Empty response from Gemini");
        }

        let cleaned = text.trim();

        cleaned = cleaned
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        try {
            return JSON.parse(cleaned);
        } catch {
            throw new Error("Gemini returned invalid JSON");
        }
    },

    clean(text) {
        return String(text || "").trim();
    },

    async translateChunk(chunk, apiKey, customPrompt) {
        const indices = [];
        const subtitles = [];

        chunk.forEach((sub, idx) => {
            if (!sub.isEmpty) {
                indices.push(idx);
                subtitles.push(
                    SRTParser.protectFormatting(sub.text)
                );
            }
        });

        if (subtitles.length === 0) {
            return chunk;
        }

        const count = subtitles.length;

        const prompt = `
${customPrompt}

TRANSLATE THESE SUBTITLES INTO NATURAL SPOKEN KERALA MALAYALAM.

STRICT RULES:
- Translate EVERY subtitle.
- Return exactly ${count} translations.
- Keep exactly the same order.
- Never skip, merge, split, summarize, or remove a subtitle.
- Never leave a complete English sentence untranslated.
- Use natural colloquial Kerala Malayalam.
- Do not use Tamil, Telugu, Kannada, Hindi, or other Indian languages.
- English words are allowed only when naturally used, such as names, brands, places, technical terms, or Malayalam-English speech.
- Preserve meaning, emotion, sarcasm, humor, insults, profanity and personality.
- Preserve <i>, <b>, <u> and other formatting tags.
- Preserve ||| exactly for multi-line subtitles.
- Return ONLY valid JSON.
- The JSON must contain an array called "translations".
- The array MUST contain exactly ${count} strings.

Example format:
{"translations":["Malayalam 1","Malayalam 2"]}

SUBTITLES:
${subtitles.map((s, i) => `[${i + 1}] ${s}`).join("\n")}
`;

        const requestBody = {
            contents: [{
                role: "user",
                parts: [{ text: prompt }]
            }],

            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 4096,
                topP: 0.95,
                topK: 40,
                responseMimeType: "application/json"
            }
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

                const parsed = this.parseJSON(text);

                if (
                    !parsed ||
                    !Array.isArray(parsed.translations)
                ) {
                    throw new Error(
                        "Missing translations array"
                    );
                }

                if (parsed.translations.length !== count) {
                    throw new Error(
                        `Translation count mismatch: expected ${count}, got ${parsed.translations.length}`
                    );
                }

                const result = [...chunk];
                const invalid = [];

                parsed.translations.forEach((translation, i) => {
                    const original =
                        chunk[indices[i]].text;

                    const cleaned =
                        this.clean(translation);

                    if (!this.isValid(original, cleaned)) {
                        invalid.push(i);
                    } else {
                        result[indices[i]] = {
                            ...chunk[indices[i]],
                            text:
                                SRTParser.restoreFormatting(
                                    cleaned
                                )
                        };
                    }
                });

                if (invalid.length === 0) {
                    return result;
                }

                // Retry only subtitles that failed validation.
                for (const i of invalid) {
                    const original =
                        chunk[indices[i]].text;

                    let fixed = null;

                    for (
                        let retry = 1;
                        retry <= CONFIG.MAX_RETRIES;
                        retry++
                    ) {
                        try {
                            fixed =
                                await this.translateSingle(
                                    original,
                                    apiKey,
                                    customPrompt
                                );

                            if (fixed) break;

                        } catch (error) {
                            if (
                                error.message === "RATE_LIMIT"
                            ) {
                                throw error;
                            }

                            if (
                                retry < CONFIG.MAX_RETRIES
                            ) {
                                await this.sleep(
                                    CONFIG.INITIAL_RETRY_DELAY *
                                    Math.pow(2, retry - 1)
                                );
                            }
                        }
                    }

                    if (!fixed) {
                        throw new Error(
                            `Subtitle ${chunk[indices[i]].index} failed translation`
                        );
                    }

                    result[indices[i]] = {
                        ...chunk[indices[i]],
                        text: fixed
                    };
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

        throw lastError ||
            new Error("Translation failed after retries");
    },

    async translateSingle(originalText, apiKey, customPrompt) {
        const protectedText =
            SRTParser.protectFormatting(originalText);

        const prompt = `
${customPrompt}

Translate this subtitle into natural spoken Kerala Malayalam.

STRICT RULES:
- Return exactly ONE translation.
- Do not explain anything.
- Do not summarize.
- Do not leave a complete English sentence unchanged.
- Do not use Tamil, Telugu, Kannada, Hindi, or other Indian languages.
- Preserve meaning, emotion, slang, insults and profanity.
- Preserve formatting tags.
- Preserve ||| exactly.

Return ONLY valid JSON in this format:

{"translation":"Malayalam translation"}

SUBTITLE:
${protectedText}
`;

        const requestBody = {
            contents: [{
                role: "user",
                parts: [{ text: prompt }]
            }],

            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 512,
                topP: 0.95,
                topK: 40,
                responseMimeType: "application/json"
            }
        };

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

        const parsed = this.parseJSON(text);

        const translation =
            this.clean(parsed.translation);

        if (!this.isValid(originalText, translation)) {
            throw new Error("INVALID_TRANSLATION");
        }

        return SRTParser.restoreFormatting(
            translation
        );
    },

    async translateWithThrottling(
        chunks,
        apiKey,
        customPrompt,
        onProgress
    ) {
        const results = new Array(chunks.length);
        let completed = 0;

        this.currentParallelLimit =
            CONFIG.MAX_PARALLEL;

        this.retryDelay =
            CONFIG.INITIAL_RETRY_DELAY;

        for (
            let i = 0;
            i < chunks.length;
            i += this.currentParallelLimit
        ) {
            const batch =
                chunks.slice(
                    i,
                    i + this.currentParallelLimit
                );

            const batchIndices =
                Array.from(
                    { length: batch.length },
                    (_, idx) => i + idx
                );

            try {
                const batchResults =
                    await Promise.all(
                        batch.map(chunk =>
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

                completed += batch.length;

                if (onProgress) {
                    onProgress(
                        completed,
                        chunks.length
                    );
                }

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
                    error.message === "RATE_LIMIT"
                ) {
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

                    await this.sleep(
                        this.retryDelay
                    );

                    i -=
                        this.currentParallelLimit;

                    continue;
                }

                throw error;
            }
        }

        return results;
    },

    sleep(ms) {
        return new Promise(
            resolve => setTimeout(resolve, ms)
        );
    },

    reset() {
        this.currentParallelLimit =
            CONFIG.MAX_PARALLEL;

        this.retryDelay =
            CONFIG.INITIAL_RETRY_DELAY;
    }
};
