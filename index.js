#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { parseArgs } = require('node:util');
const { fetchAlbumReleases, fetchReleaseTracklist } = require('./src/api');
const { matchTracksToFiles } = require('./src/matcher');
const { updateAudioMetadata, fetchCoverArtBuffer } = require('./src/metadata');
const { isAudioFile, extractArtistName } = require('./src/utils');
const { createCliInterface, promptNumericChoice, promptYesNoConfirmation } = require('./src/prompt');

/**
 * Formats a confidence score for visual output.
 * @param {number} score - Confidence score (0 to 1).
 * @returns {string} Formatted score string.
 */
function formatConfidenceScore(score) {
    const percentage = Math.round(score * 100);
    if (percentage >= 50) return `[${percentage}%]`;
    return `[${percentage}% LOW]`;
}

/**
 * Displays CLI usage instructions.
 */
function displayUsageInstructions() {
    console.log(`
Usage: freedom-tagger <path> [options]

Arguments:
  path                      Path to the folder containing audio files

Options:
  --artist,   -a <name>     Artist or band name (refines API query)
  --album,    -r <name>     Album name (defaults to folder name)
  --output,   -o <dir>      Write renamed files to an alternative output directory
  --format,   -f <pattern>  Filename format pattern (default: "{title}")
                            Tokens: {pos}, {title}
  --custom-cover, -c <path> Add a custom cover
  --auto-pick               Automatically pick the top API album result
  --no-tag                  Rename files without updating ID3 metadata
  --dry                     Preview changes without writing to disk
  --help,     -h            Display usage information
`);
}

/**
 * Main application execution flow.
 */
async function main() {
    if (process.argv.length <= 2) {
        displayUsageInstructions();
        process.exit(0);
    }

    const commandLineOptions = {
        artist: { type: 'string', short: 'a' },
        album: { type: 'string', short: 'r' },
        output: { type: 'string', short: 'o' },
        format: { type: 'string', short: 'f' },
        'custom-cover': { type: 'string', short: 'c' },
        'auto-pick': { type: 'boolean' },
        'no-tag': { type: 'boolean' },
        dry: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' }
    };

    let parsedArguments;
    try {
        const parsed = parseArgs({ options: commandLineOptions, allowPositionals: true });
        parsedArguments = parsed.values;
        if (!parsedArguments.path && parsed.positionals.length > 0) {
            parsedArguments.path = parsed.positionals[0];
        }
    } catch (error) {
        console.error(`[ERROR] Invalid arguments: ${error.message}`);
        process.exit(1);
    }

    if (parsedArguments.help) {
        displayUsageInstructions();
        process.exit(0);
    }

    if (!parsedArguments.path) {
        console.error('[ERROR] Missing required argument: path');
        displayUsageInstructions();
        process.exit(1);
    }

    if (parsedArguments['custom-cover']) {
        const coverPath = parsedArguments['custom-cover'];
        try {
            await fs.stat(coverPath);
            const ext = path.extname(coverPath).toLowerCase();
            if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
                console.error(`[ERROR] Invalid cover file format. Expected an image (.jpg, .png, etc.), got: ${ext}`);
                process.exit(1);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`[ERROR] Custom cover file not found: ${coverPath}`);
            } else {
                console.error(`[ERROR] ${error.message}`);
            }
            process.exit(1);
        }
    }

    const targetFolderPath = path.resolve(parsedArguments.path);
    let artistName = parsedArguments.artist || "";
    const isAutoPickEnabled = parsedArguments['auto-pick'] || false;
    const isTaggingDisabled = parsedArguments['no-tag'] || false;
    const isDryRunEnabled = parsedArguments.dry || false;
    const filenameFormatPattern = parsedArguments.format || "{title}";

    let destinationDirectory = targetFolderPath;
    if (parsedArguments.output) {
        destinationDirectory = path.resolve(parsedArguments.output);
        if (!isDryRunEnabled) {
            await fs.mkdir(destinationDirectory, { recursive: true });
        }
    }

    let directoryFiles;
    try {
        directoryFiles = await fs.readdir(targetFolderPath);
    } catch {
        console.error(`[ERROR] Directory not found: ${targetFolderPath}`);
        process.exit(1);
    }

    const localAudioFiles = directoryFiles.filter(isAudioFile);
    if (localAudioFiles.length === 0) {
        console.log('No audio files found in the specified target folder.');
        return;
    }

    console.log(`[INFO] ${localAudioFiles.length} audio file(s) found.`);

    const albumName = parsedArguments.album || path.basename(targetFolderPath);

    console.log(`\nSearching MusicBrainz for album: '${albumName}'${artistName ? ` | Artist: '${artistName}'` : ''}...`);

    const matchingAlbums = await fetchAlbumReleases(albumName, artistName);
    if (matchingAlbums.length === 0) {
        console.log('[ERROR] No matching releases found on MusicBrainz.');
        return;
    }

    let selectedAlbumRelease;

    if (isAutoPickEnabled) {
        selectedAlbumRelease = matchingAlbums[0];
        console.log(`\nAuto-selected release: ${selectedAlbumRelease.title} (${selectedAlbumRelease.date || 'Unknown date'})`);
    } else {
        console.log('\nPlease select the correct album release:\n');
        matchingAlbums.forEach((album, index) => {
            const releaseDate = album.date || 'Unknown date';
            const countryCode = album.country || '?';
            const trackCount = album['track-count'] || '?';
            const releaseTitle = album.title || 'Unknown title';
            const releaseArtist = extractArtistName(album);
            console.log(`  ${index + 1} - ${releaseTitle} - ${releaseArtist} (${releaseDate}) [${countryCode}] - ${trackCount} tracks`);
        });
        console.log('  0 - Cancel\n');

        const cliInterface = createCliInterface();
        const userChoice = await promptNumericChoice(cliInterface, 'Choice: ', matchingAlbums.length);
        cliInterface.close();

        if (userChoice === 0) {
            console.log('Operation cancelled.');
            return;
        }

        selectedAlbumRelease = matchingAlbums[userChoice - 1];
    }

    console.log('\nFetching release tracklist and cover art from API...');
    const apiTracklist = await fetchReleaseTracklist(selectedAlbumRelease.id);

    let coverArtBuffer = null;
    if (!isTaggingDisabled) {
        if (parsedArguments['custom-cover']) {
            coverArtBuffer = await fs.readFile(path.resolve(parsedArguments['custom-cover']));
        } else {
            coverArtBuffer = await fetchCoverArtBuffer(selectedAlbumRelease.id);
        }
    }

    const { proposedRenames, unmatchedFiles } = matchTracksToFiles(apiTracklist, localAudioFiles, filenameFormatPattern);

    console.log('\n' + '-'.repeat(70));
    console.log('Proposed File Renames:\n');

    if (proposedRenames.length > 0) {
        proposedRenames.forEach(({ oldName, newName, confidence }) => {
            const confidenceFormatted = formatConfidenceScore(confidence);
            console.log(`  ${confidenceFormatted.padEnd(10)} '${oldName}'`);
            console.log(`             --> '${newName}'`);
        });
    } else {
        console.log('  No matching files could be established.');
    }

    if (unmatchedFiles.length > 0) {
        console.log('\nUnmatched Files:');
        unmatchedFiles.forEach(filename => console.log(`  - ${filename}`));
    }

    console.log('-'.repeat(70));

    if (isDryRunEnabled) {
        console.log('\nDry run mode enabled: no changes were written to disk.');
        return;
    }

    if (proposedRenames.length === 0) {
        console.log('\nNo files to process.');
        return;
    }

    const confirmationInterface = createCliInterface();
    const isConfirmed = await promptYesNoConfirmation(confirmationInterface, '\nApply renames' + (isTaggingDisabled ? '' : ' and ID3 tags') + '?');
    confirmationInterface.close();

    if (!isConfirmed) {
        console.log('Operation aborted.');
        return;
    }

    for (const { oldName, newName, position, apiTitle } of proposedRenames) {
        const sourceFilePath = path.join(targetFolderPath, oldName);
        const destinationFilePath = path.join(destinationDirectory, newName);

        if (destinationDirectory === targetFolderPath) {
            await fs.rename(sourceFilePath, destinationFilePath);
        } else {
            await fs.copyFile(sourceFilePath, destinationFilePath);
        }

        const resolvedArtistName = extractArtistName(selectedAlbumRelease);

        if (!isTaggingDisabled) {
            updateAudioMetadata(
                destinationFilePath,
                apiTitle,
                resolvedArtistName,
                selectedAlbumRelease.title,
                position,
                selectedAlbumRelease.date || '',
                coverArtBuffer
            );
        }
    }

    console.log(`\nCompleted successfully. ${proposedRenames.length} file(s) processed.`);
    if (parsedArguments.output) {
        console.log(`Output files written to directory: ${destinationDirectory}`);
    }
}

main().catch(error => {
    console.error(`[ERROR] ${error.message}`);
    process.exit(1);
});