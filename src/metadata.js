
const NodeID3 = require('node-id3');
const path = require('path');

/**
 * Updates the ID3 tags of an audio file (MP3 supported).
 * @param {string} filePath - Full path to the audio file.
 * @param {string} trackTitle - Title of the track.
 * @param {string} artistName - Name of the artist.
 * @param {string} albumTitle - Album title.
 * @param {number} trackNumber - Track position number.
 * @param {string} releaseDate - Release date or year.
 */
function updateAudioMetadata(filePath, trackTitle, artistName, albumTitle, trackNumber, releaseDate) {
    const fileExtension = path.extname(filePath).toLowerCase();

    if (fileExtension !== '.mp3') {
        console.log(`[SKIP] Tagging not supported for ${path.basename(filePath)} (${fileExtension}). Only MP3 files are supported.`);
        return;
    }

    const id3Tags = {
        title: trackTitle,
        artist: artistName,
        album: albumTitle,
        trackNumber: String(trackNumber),
        year: releaseDate ? releaseDate.substring(0, 4) : undefined
    };

    const isUpdateSuccessful = NodeID3.update(id3Tags, filePath);
    if (!isUpdateSuccessful) {
        console.log(`[WARN] Failed to write ID3 tags to ${path.basename(filePath)}.`);
    }
}

module.exports = { updateAudioMetadata };