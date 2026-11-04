const {delay} = require('./utils');

const USER_AGENT = "AlbumSorter/1.0";
const BASE_URL = "https://musicbrainz.org/ws/2";

/**
 * Makes an HTTP request to MusicBrainz with automatic retries on rate limits or server errors.
 * @param {string} endpoint - API endpoint path.
 * @param {Object} queryParameters - Query parameters object.
 * @param {number} [maxRetries=5] - Maximum retry attempts.
 * @returns {Promise<Object|null>} The parsed JSON response.
 */
async function makeApiRequest(endpoint, queryParameters, maxRetries = 5) {
    const requestUrl = new URL(`${BASE_URL}${endpoint}`);
    Object.keys(queryParameters).forEach(key => requestUrl.searchParams.append(key, queryParameters[key]));

    for (let currentAttempt = 0; currentAttempt < maxRetries; currentAttempt++) {
        try {
            const apiResponse = await fetch(requestUrl, {
                headers: {"User-Agent": USER_AGENT, "Accept": "application/json"}
            });

            if (apiResponse.ok) {
                return await apiResponse.json();
            }

            if ([429, 502, 503, 504].includes(apiResponse.status)) {
                const backoffDelay = Math.pow(2, currentAttempt) * 1000;
                console.log(`[WARN] API busy (HTTP ${apiResponse.status}). Retrying in ${backoffDelay / 1000}s... (attempt ${currentAttempt + 1}/${maxRetries})`);
                await delay(backoffDelay);
            } else {
                throw new Error(`HTTP Error: ${apiResponse.status}`);
            }
        } catch (error) {
            if (currentAttempt === maxRetries - 1) throw error;
            await delay(Math.pow(2, currentAttempt) * 1000);
        }
    }
    return null;
}

/**
 * Searches for album releases on MusicBrainz.
 * @param {string} albumName - Album title.
 * @param {string} [artistName=""] - Optional artist name.
 * @param {boolean} isSingle - User flag to specify if it's a single
 * @returns {Promise<Array>} List of matching releases.
 */
async function fetchAlbumReleases(albumName, artistName = "", isSingle = false) {
    let searchQuery = `release:"${albumName}"`;
    if (artistName) {
        searchQuery += ` AND artist:"${artistName}"`;
    }

    if (isSingle) {
        searchQuery += ' AND primarytype:"Single"';
    }

    const responseData = await makeApiRequest("/release", {query: searchQuery, fmt: "json"});
    return responseData && responseData.releases ? responseData.releases.slice(0, 5) : [];
}

/**
 * Fetches the complete tracklist for a given release MBID.
 * @param {string} releaseMbid - MusicBrainz release ID.
 * @returns {Promise<Array>} List of tracks with positions and titles.
 */
async function fetchReleaseTracklist(releaseMbid) {
    const responseData = await makeApiRequest(`/release/${releaseMbid}`, {inc: "recordings", fmt: "json"});
    const formattedTracks = [];

    if (responseData && responseData.media) {
        for (const mediaItem of responseData.media) {
            for (const trackItem of mediaItem.tracks) {
                formattedTracks.push({
                    position: parseInt(trackItem.position, 10),
                    title: trackItem.recording.title
                });
            }
        }
    }
    return formattedTracks;
}

module.exports = {fetchAlbumReleases, fetchReleaseTracklist};