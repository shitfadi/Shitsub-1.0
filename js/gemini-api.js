/* =========================================================
   SHITSUB - Simple Gemini API
   Fast translation + simple Malayalam detection
   ========================================================= */

const GeminiAPI = {

    async translateChunk(chunk, apiKey, customPrompt) {

        const input = chunk.map((subtitle, index) => {
            return `${index + 1}. ${subtitle.text}`;
        }).join("\n");

        const prompt = `${customPrompt}

IMPORTANT:
Translate every subtitle into natural spoken Kerala Malayalam.

OUTPUT RULES:
- Translate every subtitle.
- Keep the exact same order.
- Do not skip anything.
- Do not merge subtitles.
- Do not add explanations.
- Return ONLY the numbered translations.
- Keep the numbering exactly as shown.
- Use Malayalam for dialogue.
- Do not use Tamil, Telugu, Kannada, Hindi, or Bengali.

FORMAT:
1. Malayalam translation
2. Malayalam translation
3. Malayalam translation

SUBTITLES:
${input}`;

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
            const errorText = await response.text();
            throw new Error(
                `Gemini API error ${response.status}: ${errorText}`
            );
        }

        const data = await response.json();

        const result =
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!result) {
            throw new Error("Gemini returned an empty response");
        }

        /*
         * Read numbered translations.
         * Example:
         * 1. സുഖമാണോ?
         * 2. ഇവിടെ നിന്ന് പോ!
         */

        const translations = new Array(chunk.length);

        const lines = result.split("\n");

        for (const line of lines) {

            const match = line.match(
                /^\s*(\d+)\s*[\.\):\-]\s*(.+)$/
            );

            if (!match) {
                continue;
            }

            const number = parseInt(match[1], 10);
            const text = match[2].trim();

            if (
                number >= 1 &&
                number <= chunk.length &&
                text
            ) {
                translations[number - 1] = text;
            }
        }

        /*
         * Check only whether every subtitle received
         * a translation.
         */

        for (let i = 0; i < translations.length; i++) {

            if (!translations[i]) {
                throw new Error(
                    `Missing translation for subtitle ${i + 1}`
                );
            }
        }

        /*
         * Simple Malayalam detection.
         * This is local JavaScript, so it uses no API request.
         */

        for (let i = 0; i < translations.length; i++) {

            const text = translations[i];

            const malayalamCount =
                (text.match(/[\u0D00-\u0D7F]/g) || []).length;

            const letterCount =
                (text.match(/[A-Za-z\u0D00-\u0D7F]/g) || []).length;

            // Short names/words such as "OK" are allowed.
            if (letterCount >= 4) {

                const ratio =
                    malayalamCount / letterCount;

                if (ratio < 0.35) {
                    throw new Error(
                        `Translation ${i + 1} is not sufficiently Malayalam`
                    );
                }
            }
        }

        /*
         * Put translations back into the original
         * subtitle objects.
         */

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

        const maxParallel =
            CONFIG.MAX_PARALLEL || 5;

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
                        async (chunk, index) => {

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
                                `Chunk ${chunkNumber} failed: ${lastError.message}`
                            );
                        }
                    )
                );

            translated.forEach(
                (chunk, index) => {
                    results[start + index] = chunk;
                }
            );

            completed += translated.length;

            if (onProgress) {
                onProgress(
                    completed,
                    chunks.length
                );
            }

            /*
             * Small delay between groups.
             */

            if (
                start + maxParallel < chunks.length &&
                CONFIG.BATCH_DELAY > 0
            ) {
                await this.sleep(
                    CONFIG.BATCH_DELAY
                );
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
        // Nothing to reset.
    }
};
