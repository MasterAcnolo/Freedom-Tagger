const path = require('path');
const stringSimilarity = require('string-similarity');
const { getSafeFilename, normalizeText } = require('./utils');

/**
 * Matches official API track titles to local files using strict and deductive passes.
 * @param {Array} apiTracks - List of official tracks from API.
 * @param {Array<string>} localFiles - List of local filenames.
 * @param {string} filenameFormat - Naming pattern template.
 * @returns {Object} Proposed renames and unmatched files.
 */
function matchTracksToFiles(apiTracks, localFiles, filenameFormat) {
    const proposedRenames = [];
    let unmatchedFilesList = [...localFiles];
    const matchedApiPositions = new Set();

    // Sort by longest title first to prevent short titles from stealing matches
    const sortedApiTracks = [...apiTracks].sort((a, b) => b.title.length - a.title.length);

    // PASS 1: Strict Matching
    for (const { position, title } of sortedApiTracks) {
        if (unmatchedFilesList.length === 0) break;

        const normalizedApiTitle = normalizeText(title);
        let matchedFile = null;
        let matchConfidence = 0;

        // Substring match check
        for (const filename of unmatchedFilesList) {
            if (normalizeText(filename).includes(normalizedApiTitle)) {
                matchedFile = filename;
                matchConfidence = 1.0;
                break;
            }
        }

        // Fuzzy match check (threshold: 50%)
        if (!matchedFile) {
            const cleanLocalNames = unmatchedFilesList.map(file => normalizeText(path.parse(file).name));
            const similarityResult = stringSimilarity.findBestMatch(normalizedApiTitle, cleanLocalNames);

            if (similarityResult.bestMatch.rating >= 0.5) {
                matchedFile = unmatchedFilesList[similarityResult.bestMatchIndex];
                matchConfidence = similarityResult.bestMatch.rating;
            }
        }

        if (matchedFile) {
            unmatchedFilesList = unmatchedFilesList.filter(file => file !== matchedFile);
            matchedApiPositions.add(position);

            const fileExtension = path.extname(matchedFile);
            const newFilename = buildTargetFilename(filenameFormat, position, title, fileExtension);

            proposedRenames.push({
                oldName: matchedFile,
                newName: newFilename,
                position,
                apiTitle: title,
                confidence: matchConfidence
            });
        }
    }

    // PASS 2: Deductive Process of Elimination
    if (unmatchedFilesList.length > 0) {
        let remainingApiTracks = apiTracks.filter(track => !matchedApiPositions.has(track.position));

        for (const filename of [...unmatchedFilesList]) {
            if (remainingApiTracks.length === 0) break;

            const normalizedFilename = normalizeText(filename);
            const remainingApiTitles = remainingApiTracks.map(track => normalizeText(track.title));

            const similarityResult = stringSimilarity.findBestMatch(normalizedFilename, remainingApiTitles);
            let matchedApiTrack = null;
            let matchConfidence = 0;

            if (similarityResult.bestMatch.rating >= 0.1) {
                matchedApiTrack = remainingApiTracks[similarityResult.bestMatchIndex];
                matchConfidence = similarityResult.bestMatch.rating;
            } else {
                const fallbackIndex = remainingApiTitles.findIndex(apiName => normalizedFilename.includes(apiName));
                if (fallbackIndex !== -1) {
                    matchedApiTrack = remainingApiTracks[fallbackIndex];
                    matchConfidence = 0.1;
                }
            }

            if (matchedApiTrack) {
                unmatchedFilesList = unmatchedFilesList.filter(file => file !== filename);
                remainingApiTracks = remainingApiTracks.filter(track => track.position !== matchedApiTrack.position);

                const fileExtension = path.extname(filename);
                const newFilename = buildTargetFilename(filenameFormat, matchedApiTrack.position, matchedApiTrack.title, fileExtension);

                proposedRenames.push({
                    oldName: filename,
                    newName: newFilename,
                    position: matchedApiTrack.position,
                    apiTitle: matchedApiTrack.title,
                    confidence: matchConfidence
                });
            }
        }
    }

    proposedRenames.sort((a, b) => a.position - b.position);
    return { proposedRenames, unmatchedFiles: unmatchedFilesList };
}

/**
 * Builds the output filename from a format pattern.
 * @param {string} formatPattern - Template pattern (e.g., "{pos} - {title}").
 * @param {number} trackPosition - Track index number.
 * @param {string} trackTitle - Track title.
 * @param {string} fileExtension - Audio file extension.
 * @returns {string} Formatted filename.
 */
function buildTargetFilename(formatPattern, trackPosition, trackTitle, fileExtension) {
    const safeTitle = getSafeFilename(trackTitle);
    const paddedPosition = String(trackPosition).padStart(2, '0');

    const processedName = formatPattern
        .replace('{pos}', paddedPosition)
        .replace('{title}', safeTitle);

    return `${processedName}${fileExtension}`;
}

module.exports = { matchTracksToFiles, buildTargetFilename };