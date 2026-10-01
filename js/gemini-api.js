/* =========================================================
   SHITSUB - Gemini API
   100-subtitle batches + automatic missing-item recovery
   + automatic 429 retry handling
   ========================================================= */

const GeminiAPI = {

    async translateChunk(chunk, apiKey, customPrompt) {

        const input = chunk.map((subtitle, index) => {
            return `${index + 1}. ${subtitle.text}`;
        }).join("\n");

        const prompt = `${customPrompt}

IMPORTANT:
Translate EVERY subtitle below into natural spoken Kerala Malayalam.

STRICT OUTPUT RULES:
- Translate every subtitle.
- Keep the exact same order.
- Do not skip any number.
- Do not merge subtitles.
- Do not summarize.
- Do not add explanations.
- Return ONLY numbered translations.
- Use exactly the same numbering from 1 to ${chunk.length}.
- Use Malayalam for dialogue.
- Do not use Tamil, Telugu, Kannada, Hindi, or Bengali.

FORMAT:
1. Malayalam translation
2. Malayalam translation
3. Malayalam translation

SUBTITLES:
${input}`;

        const result = await this.callGemini(
            prompt,
            apiKey
        );

        const translations =
            this.parseNumberedTranslations(
                result,
                chunk.length
            );

        const missing =
            this.getMissingNumbers(
                translations
            );

        /*
         * Recover missing translations.
         */
        if (missing.length > 0) {

            console.warn(
                `Missing translations: ${missing.join(", ")}`
            );

            const recovered =
                await this.recoverMissing(
                    chunk,
                    missing,
                    apiKey,
                    customPrompt
                );

            for (const number of missing) {
                translations[number - 1] =
                    recovered[number];
            }
        }

        /*
         * Final check.
         */
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

        /*
         * Simple Malayalam check.
         */
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


    /*
     * Send one request to Gemini.
     */
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

            /*
             * Read Google's retryDelay.
             */
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


    /*
     * Parse numbered Gemini output.
     */
    parseNumberedTranslations(
        result,
        count
    ) {

        const translations =
            new Array(count);

        const lines =
            result.split(/\r?\n/);

        let currentNumber = null;

        for (const rawLine of lines) {

            const line =
                rawLine.trim();

            if (!line) {
                continue;
            }

            /*
             * Normal:
             * 1. text
             * 1) text
             * 1: text
             * 1- text
             */
            const match =
                line.match(
                    /^\s*(\d+)\s*[\.\):\-]\s*(.*)$/
                );

            if (match) {

                const number =
                    parseInt(
                        match[1],
                        10
                    );

                const text =
                    match[2].trim();

                if (
                    number >= 1 &&
                    number <= count
                ) {

                    translations[
                        number - 1
                    ] = text;

                    currentNumber =
                        number;

                    continue;
                }
            }

            /*
             * If Gemini wrapped the translation
             * onto another line, attach it to
             * the previous numbered item.
             */
            if (
                currentNumber !== null &&
                currentNumber >= 1 &&
                currentNumber <= count
            ) {

                const index =
                    currentNumber - 1;

                if (translations[index]) {

                    translations[index] +=
                        " " + line;
                }
            }
        }

        return translations;
    },


    /*
     * Find missing subtitle numbers.
     */
    getMissingNumbers(
        translations
    ) {

        const missing = [];

        for (
            let i = 0;
            i < translations.length;
            i++
        ) {

            if (
                !translations[i] ||
                !translations[i].trim()
            ) {
                missing.push(i + 1);
            }
        }

        return missing;
    },


    /*
     * Ask Gemini only for missing subtitles.
     */
    async recoverMissing(
        chunk,
        missing,
        apiKey,
        customPrompt
    ) {

        const input =
            missing.map(number => {

                const subtitle =
                    chunk[number - 1];

                return (
                    `${number}. ` +
                    subtitle.text
                );

            }).join("\n");

        const prompt = `${customPrompt}

IMPORTANT:
Some subtitle translations were missing from a previous response.

Translate ONLY the subtitle numbers listed below.

STRICT RULES:
- Translate every listed subtitle.
- Do not skip any number.
- Keep the exact numbers.
- Return ONLY numbered translations.
- Use natural spoken Kerala Malayalam.
- Do not use Tamil, Telugu, Kannada, Hindi, or Bengali.
- Do not add explanations.

FORMAT:
${missing
    .map(number =>
        `${number}. Malayalam translation`
    )
    .join("\n")}

SUBTITLES:
${input}`;

        /*
         * Retry recovery if necessary.
         */
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
                    {};

                const lines =
                    result.split(/\r?\n/);

                for (const line of lines) {

                    const match =
                        line.match(
                            /^\s*(\d+)\s*[\.\):\-]\s*(.+)$/
                        );

                    if (!match) {
                        continue;
                    }

                    const number =
                        parseInt(
                            match[1],
                            10
                        );

                    const text =
                        match[2].trim();

                    if (
                        missing.includes(number) &&
                        text
                    ) {
                        recovered[number] =
                            text;
                    }
                }

                const stillMissing =
                    missing.filter(
                        number =>
                            !recovered[number]
                    );

                if (
                    stillMissing.length === 0
                ) {
                    return recovered;
                }

                throw new Error(
                    `Recovery still missing: ` +
                    `${stillMissing.join(", ")}`
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

                if (error.retryDelay) {

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
                "Could not recover missing translations"
            );
    },


    /*
     * Main chunk processing with
     * automatic 429 handling.
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

            /*
             * Normal spacing.
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
