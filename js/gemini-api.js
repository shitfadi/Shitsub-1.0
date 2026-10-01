/* =========================================================
   SHITSUB - Gemini API
   Automatic quota-aware retry system
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

            let errorData = null;

            try {
                errorData = await response.json();
            } catch (e) {
                // Ignore JSON parsing failure
            }

            const error = new Error(
                `Gemini API error ${response.status}: ` +
                JSON.stringify(errorData || {})
            );

            // Save Google's requested retry time
            error.retryDelay =
                errorData?.error?.details
                    ?.find(
                        d =>
                            d["@type"] ===
                            "type.googleapis.com/google.rpc.RetryInfo"
                    )
                    ?.retryDelay || null;

            error.status = response.status;

            throw error;
        }

        const data = await response.json();

        const result =
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!result) {
            throw new Error(
                "Gemini returned an empty response"
            );
        }

        const translations =
            new Array(chunk.length);

        const lines =
            result.split("\n");

        for (const line of lines) {

            const match = line.match(
                /^\s*(\d+)\s*[\.\):\-]\s*(.+)$/
            );

            if (!match) {
                continue;
            }

            const number =
                parseInt(match[1], 10);

            const text =
                match[2].trim();

            if (
                number >= 1 &&
                number <= chunk.length &&
                text
            ) {
                translations[number - 1] = text;
            }
        }

        for (
            let i = 0;
            i < translations.length;
            i++
        ) {

            if (!translations[i]) {
                throw new Error(
                    `Missing translation for subtitle ${i + 1}`
                );
            }
        }

        // Simple Malayalam check
        for (
            let i = 0;
            i < translations.length;
            i++
        ) {

            const text =
                translations[i];

            const malayalamCount =
                (
                    text.match(
                        /[\u0D00-\u0D7F]/g
                    ) || []
                ).length;

            const letterCount =
                (
                    text.match(
                        /[A-Za-z\u0D00-\u0D7F]/g
                    ) || []
                ).length;

            if (letterCount >= 4) {

                const ratio =
                    malayalamCount /
                    letterCount;

                if (ratio < 0.35) {
                    throw new Error(
                        `Translation ${i + 1} ` +
                        `is not sufficiently Malayalam`
                    );
                }
            }
        }

        return chunk.map(
            (subtitle, index) => ({
                ...subtitle,
                text: translations[index]
            })
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

                                    /*
                                     * If Gemini gives us
                                     * retryDelay, use it.
                                     */

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
                                `${lastError?.message || "Unknown error"}`
                            );
                        }
                    )
                );

            translated.forEach(
                (chunk, index) => {
                    results[start + index] =
                        chunk;
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

            /*
             * Normal spacing between requests.
             */

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

        /*
         * Google normally returns:
         * "3s"
         * "54s"
         */

        if (
            typeof value === "string" &&
            value.endsWith("s")
        ) {

            const seconds =
                parseFloat(
                    value.slice(0, -1)
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
