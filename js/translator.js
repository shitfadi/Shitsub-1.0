/* =========================================================
   SHITSUB - Translator Module
   ========================================================= */

const Translator = {
    parsedSubtitles: [],
    translatedSubtitles: [],
    isTranslating: false,

    /**
     * Translate SRT file
     * @param {File} file - SRT file object
     * @param {string} apiKey - Gemini API key
     * @param {string} customPrompt - Custom translation prompt
     * @param {Function} onProgress - Progress callback (current, total, message)
     * @returns {Promise<Object>} Result with outputText and outputName
     */
    async translateFile(file, apiKey, customPrompt, onProgress) {
        this.isTranslating = true;

        try {
            // Read file
            onProgress(0, 100, "Reading file...");
            const text = await file.text();

            // Parse SRT
            onProgress(5, 100, "Parsing subtitles...");
            this.parsedSubtitles = SRTParser.parse(text);

            if (this.parsedSubtitles.length === 0) {
                throw new Error("No valid SRT subtitles found in file");
            }

            const totalSubtitles = this.parsedSubtitles.length;
            onProgress(10, 100, `Found ${totalSubtitles} subtitles`);

            // Split into chunks
            const chunks = this.createChunks(this.parsedSubtitles, CONFIG.CHUNK_SIZE);
            const totalChunks = chunks.length;

            onProgress(15, 100, `Prepared ${totalChunks} chunks for translation`);

            // Save progress for resume
            this.saveProgress({
                fileName: file.name,
                totalSubtitles: totalSubtitles,
                totalChunks: totalChunks,
                completed: 0
            });

            // Translate with throttling
            const translatedChunks = await GeminiAPI.translateWithThrottling(
                chunks,
                apiKey,
                customPrompt,
                (completed, total) => {
                    const percent = 15 + Math.round((completed / total) * 80);
                    onProgress(
                        percent,
                        100,
                        `Translating subtitles... (${completed}/${total} chunks)`
                    );

                    // Update progress
                    this.saveProgress({
                        fileName: file.name,
                        totalSubtitles: totalSubtitles,
                        totalChunks: totalChunks,
                        completed: completed
                    });
                }
            );

            // Flatten chunks back to subtitles
            this.translatedSubtitles = translatedChunks.flat();

            onProgress(95, 100, "Building SRT file...");

            // Build output
            const outputText = SRTParser.build(this.translatedSubtitles);
            const originalName = file.name.replace(/\.srt$/i, "");
            const outputName = `${originalName}_Malayalam.srt`;

            onProgress(100, 100, "Translation complete!");

            // Clear progress
            this.clearProgress();

            return {
                outputText,
                outputName,
                totalSubtitles
            };

        } finally {
            this.isTranslating = false;
            GeminiAPI.reset();
        }
    },

    /**
     * Create chunks from subtitles array
     * @param {Array} subtitles - Array of subtitle objects
     * @param {number} chunkSize - Size of each chunk
     * @returns {Array} Array of chunks
     */
    createChunks(subtitles, chunkSize) {
        const chunks = [];
        for (let i = 0; i < subtitles.length; i += chunkSize) {
            chunks.push(subtitles.slice(i, i + chunkSize));
        }
        return chunks;
    },

    /**
     * Save translation progress to localStorage
     * @param {Object} progress - Progress data
     */
    saveProgress(progress) {
        try {
            localStorage.setItem(
                CONFIG.STORAGE_KEYS.PROGRESS,
                JSON.stringify({
                    ...progress,
                    timestamp: Date.now()
                })
            );
        } catch (error) {
            console.warn("Could not save progress:", error);
        }
    },

    /**
     * Load saved progress from localStorage
     * @returns {Object|null} Saved progress or null
     */
    loadProgress() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.PROGRESS);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.warn("Could not load progress:", error);
        }
        return null;
    },

    /**
     * Clear saved progress
     */
    clearProgress() {
        try {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.PROGRESS);
        } catch (error) {
            console.warn("Could not clear progress:", error);
        }
    }
};
