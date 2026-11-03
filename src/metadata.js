
const NodeID3 = require('node-id3');
const path = require('path');

/**
 * Fetches the cover art buffer from the Cover Art Archive using the release MBID.
 * @param {string} releaseMbid - MusicBrainz release ID.
 * @returns {Promise<Buffer|null>} The image buffer or null if unavailable.
 */
async function fetchCoverArtBuffer(releaseMbid) {
    if (!releaseMbid) return null;
    
    try {
        const coverArtUrl = `https://coverartarchive.org/release/${releaseMbid}/front`;
        const response = await fetch(coverArtUrl);
        
        if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
    } catch (error) {
        console.log(`[WARN] Could not fetch cover art: ${error.message}`);
    }
    return null;
}

/**
 * Updates the ID3 tags of an audio file (MP3 supported), including the cover art.
 * @param {string} filePath - Full path to the audio file.
 * @param {string} trackTitle - Title of the track.
 * @param {string} artistName - Name of the artist.
 * @param {string} albumTitle - Album title.
 * @param {number} trackNumber - Track position number.
 * @param {string} releaseDate - Release date or year.
 * @param {Buffer} [coverArtBuffer] - Optional image buffer for album art.
 */
function updateAudioMetadata(filePath, trackTitle, artistName, albumTitle, trackNumber, releaseDate, coverArtBuffer = null) {
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

    // Attach cover art if available (APIC frame)
    if (coverArtBuffer) {
        id3Tags.image = {
            mime: 'image/jpeg',
            type: {
                id: 3, // 3 is for 'Front Cover'
                name: 'front cover'
            },
            description: 'Cover',
            imageBuffer: coverArtBuffer
        };
    }

    const isUpdateSuccessful = NodeID3.update(id3Tags, filePath);
    if (!isUpdateSuccessful) {
        console.log(`[WARN] Failed to write ID3 tags to ${path.basename(filePath)}.`);
    }
}

module.exports = { updateAudioMetadata, fetchCoverArtBuffer };