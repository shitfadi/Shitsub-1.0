/* =========================================================
   SHITSUB - Gemini API Handler
   ========================================================= */

const GeminiAPI = {
    currentParallelLimit: CONFIG.MAX_PARALLEL,
    retryDelay: CONFIG.INITIAL_RETRY_DELAY,

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
                const protected = SRTParser.protectFormatting(sub.text);
                textsToTranslate.push(protected);
            }
        });

        // If all empty, return as-is
        if (textsToTranslate.length === 0) {
            return chunk;
        }

        // Build prompt
        const prompt = `${customPrompt}

SUBTITLES TO TRANSLATE (one per line, separated by ~~~~):

${textsToTranslate.join('\n~~~~\n')}

IMPORTANT:
- Translate each subtitle separately
- Preserve ||| separator for multi-line subtitles
- Return translations in the same order
- Use natural Kerala Malayalam
- Do not add explanations or numbering`;

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

        // Retry logic
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
                        // Rate limit - will be handled by throttling
                        throw new Error("RATE_LIMIT");
                    }
                    const errorText = await response.text();
                    throw new Error(`API error ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

                if (!text) {
                    throw new Error("Empty response from Gemini");
                }

                // Parse translations
                const translations = text
                    .split('~~~~')
                    .map(t => t.trim())
                    .map(t => {
                        // Remove common Gemini prefixes
                        return t
                            .replace(/^(Here's the translation:|Translation:|Malayalam:|സ്വാഗതം:)\s*/i, '')
                            .trim();
                    })
                    .filter(t => t.length > 0);

                // Validate count
                if (translations.length !== textsToTranslate.length) {
                    console.warn(`Translation count mismatch: expected ${textsToTranslate.length}, got ${translations.length}`);
                    // Try to recover by padding or trimming
                    while (translations.length < textsToTranslate.length) {
                        translations.push(textsToTranslate[translations.length]);
                    }
                    translations.length = textsToTranslate.length;
                }

                // Map translations back to chunk
                const result = [...chunk];
                nonEmptyIndices.forEach((idx, i) => {
                    if (i < translations.length) {
                        // Restore formatting
                        const restored = SRTParser.restoreFormatting(translations[i]);

                        // Validate structure
                        if (SRTParser.validate(chunk[idx].text, restored)) {
                            result[idx] = {
                                ...chunk[idx],
                                text: restored
                            };
                        } else {
                            // Keep original if validation fails
                            console.warn(`Validation failed for subtitle ${chunk[idx].index}`);
                        }
                    }
                });

                return result;

            } catch (error) {
                lastError = error;

                if (attempt < CONFIG.MAX_RETRIES) {
                    const delay = Math.min(
                        CONFIG.INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1),
                        CONFIG.MAX_RETRY_DELAY
                    );
                    await this.sleep(delay);
                }
            }
        }

        throw lastError || new Error("Translation failed after retries");
    },

    /**
     * Translate with automatic throttling
     * @param {Array} chunks - Array of subtitle chunks
     * @param {string} apiKey - Gemini API key
     * @param {string} customPrompt - Custom translation prompt
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Array>} All translated subtitles
     */
    async translateWithThrottling(chunks, apiKey, customPrompt, onProgress) {
        const results = new Array(chunks.length);
        let completed = 0;

        for (let i = 0; i < chunks.length; i += this.currentParallelLimit) {
            const batch = chunks.slice(i, i + this.currentParallelLimit);
            const batchIndices = Array.from(
                { length: batch.length },
                (_, idx) => i + idx
            );

            try {
                // Process batch in parallel
                const batchResults = await Promise.all(
                    batch.map(chunk => this.translateChunk(chunk, apiKey, customPrompt))
                );

                // Store results
                batchResults.forEach((result, idx) => {
                    results[batchIndices[idx]] = result;
                });

                completed += batch.length;

                // Report progress
                if (onProgress) {
                    onProgress(completed, chunks.length);
                }

                // Success - gradually increase speed
                if (this.currentParallelLimit < CONFIG.MAX_PARALLEL) {
                    this.currentParallelLimit = Math.min(
                        CONFIG.MAX_PARALLEL,
                        this.currentParallelLimit + 2
                    );
                }
                if (this.retryDelay > CONFIG.INITIAL_RETRY_DELAY) {
                    this.retryDelay = Math.max(
                        CONFIG.INITIAL_RETRY_DELAY,
                        this.retryDelay - 200
                    );
                }

                // Small delay between batches
                if (i + this.currentParallelLimit < chunks.length) {
                    await this.sleep(CONFIG.BATCH_DELAY);
                }

            } catch (error) {
                if (error.message === "RATE_LIMIT") {
                    // Throttle down
                    this.currentParallelLimit = Math.max(
                        CONFIG.MIN_PARALLEL,
                        Math.floor(this.currentParallelLimit / 2)
                    );
                    this.retryDelay = Math.min(
                        CONFIG.MAX_RETRY_DELAY,
                        this.retryDelay * 2
                    );

                    console.log(`⚠️ Rate limited. Reducing to ${this.currentParallelLimit} parallel requests`);
                    console.log(`⏳ Waiting ${this.retryDelay}ms before retry...`);

                    await this.sleep(this.retryDelay);

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
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Reset throttling state
     */
    reset() {
        this.currentParallelLimit = CONFIG.MAX_PARALLEL;
        this.retryDelay = CONFIG.INITIAL_RETRY_DELAY;
    }
};
