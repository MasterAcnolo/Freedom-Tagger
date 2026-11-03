const path = require('path');

const VALID_AUDIO_EXTENSIONS = [".mp3", ".flac", ".m4a", ".wav", ".ogg"];

/**
 * Removes forbidden characters to make a title safe for file systems.
 * @param {string} rawTitle - The original track title.
 * @returns {string} The sanitized filename-safe string.
 */
function getSafeFilename(rawTitle) {
    return rawTitle.replace(/[\\/:*?"<>|]/g, "");
}

/**
 * Normalizes text by lowercasing and standardizing apostrophes.
 * @param {string} text - The input text.
 * @returns {string} The normalized text.
 */
function normalizeText(text) {
    return text.replace(/['´']/g, "'").toLowerCase();
}

/**
 * Returns a promise that resolves after a given delay.
 * @param {number} ms - Milliseconds to delay.
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Checks if a file path has a valid audio extension.
 * @param {string} filename - The filename to check.
 * @returns {boolean} True if valid audio extension.
 */
function isAudioFile(filename) {
    const fileExtension = path.extname(filename).toLowerCase();
    return VALID_AUDIO_EXTENSIONS.includes(fileExtension);
}

/**
 * Extracts the primary artist name from a MusicBrainz release object.
 * @param {Object} musicBrainzObject - The release object.
 * @returns {string} The artist name.
 */
function extractArtistName(musicBrainzObject) {
    const artistCredit = musicBrainzObject["artist-credit"];
    if (!artistCredit || !artistCredit[0]) return "Unknown Artist";
    return artistCredit[0].name;
}

module.exports = {
    getSafeFilename,
    normalizeText,
    delay,
    isAudioFile,
    extractArtistName,
    VALID_AUDIO_EXTENSIONS
};