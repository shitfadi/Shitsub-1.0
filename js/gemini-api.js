/* =========================================================
   SHITSUB - Simple Gemini API
   Fast parallel translation + Malayalam detection
   ========================================================= */

const GeminiAPI = {

    async translateChunk(chunk, apiKey, customPrompt) {

        const subtitles = chunk
            .map((sub, index) => `${index + 1}. ${sub.text}`)
            .join("\n");

        const prompt = `${customPrompt}

IMPORTANT OUTPUT RULES:
- Translate EVERY subtitle.
- Return exactly ONE Malayalam translation for each subtitle.
- Keep the exact same order.
- Do not skip any subtitle.
- Do not merge subtitles.
- Do not add explanations.
- Do not add numbering.
- Return ONLY the translations.
- Separate each translation with exactly four tildes:

~~~~

SUBTITLES:
${subtitles}`;

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
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        const result =
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!result) {
            throw new Error("Gemini returned an empty response");
        }

        const translations = result
            .split("~~~~")
            .map(text => text.trim())
            .filter(text => text.length > 0);

        if (translations.length !== chunk.length) {
            throw new Error(
                `Translation count mismatch: expected ${chunk.length}, got ${translations.length}`
            );
        }

        // Lightweight Malayalam detection
        const validMalayalam = translations.every(text => {
            const malayalam = (text.match(/[\u0D00-\u0D7F]/g) || []).length;
            const letters = (text.match(/[A-Za-z\u0D00-\u0D7F]/g) || []).length;

            // Very short things such as names or "OK" can legitimately
            // contain little Malayalam, so don't reject them.
            if (letters < 4) {
                return true;
            }

            return malayalam / letters >= 0.35;
        });

        if (!validMalayalam) {
            throw new Error("Gemini returned text that is not sufficiently Malayalam");
        }

        return chunk.map((subtitle, index) => ({
            ...subtitle,
            text: translations[index]
        }));
    },


    async translateWithThrottling(
        chunks,
        apiKey,
        customPrompt,
        onProgress
    ) {

        const results = new Array(chunks.length);
        let completed = 0;

        const maxParallel = CONFIG.MAX_PARALLEL || 5;

        for (
            let start = 0;
            start < chunks.length;
            start += maxParallel
        ) {

            const batch = chunks.slice(
                start,
                start + maxParallel
            );

            const translated = await Promise.all(
                batch.map(async (chunk, batchIndex) => {

                    const chunkIndex = start + batchIndex;

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

                            lastError = error;

                            if (
                                attempt <
                                CONFIG.MAX_RETRIES
                            ) {

                                await this.sleep(
                                    CONFIG.INITIAL_RETRY_DELAY *
                                    attempt
                                );
                            }
                        }
                    }

                    throw new Error(
                        `Chunk ${chunkIndex + 1} failed: ${lastError.message}`
                    );
                })
            );

            translated.forEach((chunk, index) => {
                results[start + index] = chunk;
            });

            completed += translated.length;

            if (onProgress) {
                onProgress(
                    completed,
                    chunks.length
                );
            }

            if (
                start + maxParallel < chunks.length &&
                CONFIG.BATCH_DELAY > 0
            ) {
                await this.sleep(CONFIG.BATCH_DELAY);
            }
        }

        return results;
    },


    sleep(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    },


    reset() {
        // Nothing to reset in the simple version.
    }
};
