/* =========================================================
   SHITSUB - SRT Parser
   ========================================================= */

const SRTParser = {
    /**
     * Parse SRT file content into structured subtitle objects
     * @param {string} text - Raw SRT file content
     * @returns {Array} Array of subtitle objects
     */
    parse(text) {
        // Remove BOM if present
        text = text.replace(/^﻿/, "");

        // Normalize line endings
        text = text.replace(/\r\n/g, "\n");
        text = text.replace(/\r/g, "\n");

        // Split into blocks
        const blocks = text
            .split(/\n\s*\n/)
            .map(block => block.trim())
            .filter(Boolean);

        const subtitles = [];

        for (const block of blocks) {
            const lines = block.split("\n");

            if (lines.length < 2) {
                continue;
            }

            const number = lines[0].trim();
            const timestamp = lines[1].trim();

            // Validate subtitle number
            if (!/^\d+$/.test(number)) {
                continue;
            }

            // Validate timestamp
            if (!timestamp.includes("-->")) {
                continue;
            }

            // Extract dialogue (lines 2+), join with ||| for multi-line
            const dialogue = lines.slice(2).join("|||").trim();

            // Check if empty line
            const isEmpty = dialogue === "";

            subtitles.push({
                index: parseInt(number),
                timestamp: timestamp,
                text: dialogue,
                isEmpty: isEmpty
            });
        }

        return subtitles;
    },

    /**
     * Build SRT file content from subtitle objects
     * @param {Array} subtitles - Array of subtitle objects
     * @returns {string} SRT file content
     */
    build(subtitles) {
        return subtitles
            .map(subtitle => {
                let output = `${subtitle.index}\n${subtitle.timestamp}\n`;

                if (subtitle.isEmpty) {
                    output += "\n";
                } else {
                    // Restore multi-line format
                    const lines = subtitle.text.split("|||");
                    output += lines.join("\n") + "\n";
                }

                return output;
            })
            .join("\n");
    },

    /**
     * Protect special characters and formatting tags
     * @param {string} text - Text to protect
     * @returns {string} Protected text
     */
    protectFormatting(text) {
        const protectionMap = {
            '<i>': '___ITALIC_START___',
            '</i>': '___ITALIC_END___',
            '<b>': '___BOLD_START___',
            '</b>': '___BOLD_END___',
            '<u>': '___UNDERLINE_START___',
            '</u>': '___UNDERLINE_END___',
            '<font': '___FONT_START___',
            '</font>': '___FONT_END___'
        };

        let protected = text;
        for (const [tag, placeholder] of Object.entries(protectionMap)) {
            protected = protected.replaceAll(tag, placeholder);
        }

        return protected;
    },

    /**
     * Restore protected formatting tags
     * @param {string} text - Protected text
     * @returns {string} Restored text
     */
    restoreFormatting(text) {
        const reverseMap = {
            '___ITALIC_START___': '<i>',
            '___ITALIC_END___': '</i>',
            '___BOLD_START___': '<b>',
            '___BOLD_END___': '</b>',
            '___UNDERLINE_START___': '<u>',
            '___UNDERLINE_END___': '</u>',
            '___FONT_START___': '<font',
            '___FONT_END___': '</font>'
        };

        let restored = text;
        for (const [placeholder, tag] of Object.entries(reverseMap)) {
            restored = restored.replaceAll(placeholder, tag);
        }

        return restored;
    },

    /**
     * Validate translation matches original structure
     * @param {string} original - Original text
     * @param {string} translated - Translated text
     * @returns {boolean} True if valid
     */
    validate(original, translated) {
        // Check multi-line count matches
        const originalLines = original.split("|||").length;
        const translatedLines = translated.split("|||").length;

        if (originalLines !== translatedLines) {
            console.warn(`Line count mismatch: expected ${originalLines}, got ${translatedLines}`);
            return false;
        }

        return true;
    }
};
