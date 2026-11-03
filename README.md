# Freedom-Tagger

A CLI tool that renames and tags a local music folder using the [MusicBrainz](https://musicbrainz.org/) API — featuring fuzzy matching, confidence scoring, interactive album selection, and automatic cover art embedding.

> [!NOTE]
> - This project does not download any content. If you are looking for a downloader, use [yt-dlp](https://github.com/yt-dlp/yt-dlp) (CLI) or [Freedom Loader](https://github.com/MasterAcnolo/Freedom-Loader) (GUI).
> - This tool is designed for folders containing a single, sorted album (not massive directories with 25+ mixed albums). It adds index prefixes to your audio tracks so any music player can play them in the correct order.

```text
  [98%]      'bad omens mercy.mp3'
             --> 'Mercy.mp3'
  [76%]      'track02.mp3'
             --> '02 - Aerodynamic.mp3'
  [14% LOW]  'audio_rip_03.flac'
             --> '03 - Digital Love.flac'

Apply renames, tags, and cover art? (y/n):
```

---

## Installation

```bash
git clone https://github.com/MasterAcnolo/Freedom-Tagger
cd Freedom-Tagger
npm install

# Use it locally
node index.js <path> [options]

# Or link it globally to use freedom-tagger anywhere
npm link
```

---

## Usage

```bash
freedom-tagger <path> [options]
# Or: node index.js <path> [options]
```

| Argument | Short | Type | Description |
|---|---|---|---|
| `path` | - | positional | **Required.** Path to the folder containing audio files. |
| `--artist` | `-a` | string | Artist or band name. Strongly recommended to narrow down the search. |
| `--album` | `-r` | string | Album name. Defaults to the folder name if omitted. |
| `--output` | `-o` | string | Write renamed files to a separate directory. Originals remain untouched. |
| `--format` | `-f` | string | Filename pattern. Default: `{title}`. Tokens: `{pos}`, `{title}`. |
| `--custom-cover` | `-c` | string | Custom album cover |
| `--auto-pick` | - | boolean | Skip interactive selection; auto-select the top API result. |
| `--no-tag` | - | boolean | Rename files without updating ID3 metadata and cover art. |
| `--dry` | - | boolean | Preview proposed renames without writing anything to disk. |
| `--help` | `-h` | boolean | Print usage instructions and exit. |

### Examples

```bash
# Standard rename, ID3 tagging, and cover art embedding
freedom-tagger ~/Music/Discovery --artist "Linkin Park"

# Preview changes without modifying files
freedom-tagger ~/Music/Discovery --artist "Linkin Park" --dry

# Rename only, skipping metadata tags and cover art
freedom-tagger ~/Music/Discovery --artist "Linkin Park" --no-tag

# Keep original files safe and export cleaned files to a separate folder
freedom-tagger ~/Music/Discovery --artist "Linkin Park" --output ~/Music/Discovery-clean

# Custom filename format (including the artist name in the filename)
freedom-tagger ~/Music/Discovery --artist "Linkin Park" --format "{pos} - Linkin Park - {title}"
# Results in: 01 - Linkin Park - Somewhere I Belong.mp3

# Skip interactive prompts and auto-pick the best matching release
freedom-tagger ~/Music/Discovery --artist "Linkin Park" --auto-pick

# Useful when your folder name doesn't match the actual album title
freedom-tagger ~/Music/rip_2003 --artist "Linkin Park" --album "Meteora"
```

---

## How it works

The tool operates in four streamlined steps:

1. **Search** — queries MusicBrainz for the release matching your album and artist name.
2. **Select** — displays the top 5 results and prompts you to pick the correct edition (or auto-selects via `--auto-pick`, i don't recommend that method).
3. **Match** — fuzzy-matches official API track titles against your local filenames using a robust 2-pass algorithm.
4. **Apply** — renames your files, writes ID3 tags, and embeds the official cover art downloaded from the Cover Art Archive.

### Matching algorithm

Matching runs in two passes using the [Dice coefficient](https://en.wikipedia.org/wiki/S%C3%B8rensen%E2%80%93Dice_coefficient) (via `string-similarity`).

> Before both passes, API tracks are **sorted by title length (longest first)** to prevent short titles like *"Love"* from incorrectly stealing matches meant for longer tracks like *"Digital Love"*.

- **Pass 1 - Strict** (Threshold: 50%): Tries an exact substring match first, followed by a fuzzy match. High-confidence matches get a score between `0.5` and `1.0`.
- **Pass 2 - Deduction** (Threshold: 10%): Sweeps the remaining unmatched files with a looser threshold using process-of-elimination. These matches are marked as `LOW` confidence in the output for manual review.

All string comparisons pass through `normalizeText()` first, lowercasing text and unifying apostrophe variants (`'`, `´`, `'`) to prevent false mismatches due to punctuation differences.

### Confidence scores

| Score         | Meaning                                                                |
|---------------|------------------------------------------------------------------------|
| `[90%+]`      | Substring or near-exact fuzzy match. Highly reliable.                  |
| `[50–89%]`    | Good fuzzy match. Title might have slight abbreviations or variations. |
| `[< 50%] LOW` | Pass 2 deduction. Review carefully before confirming.                  |

### Format tokens

| Token     | Resolves to                                     | Example    |
|-----------|-------------------------------------------------|------------|
| `{pos}`   | Track position, zero-padded to 2 digits         | `01`, `12` |
| `{title}` | Official sanitized track title from MusicBrainz | `Impose`   |

*Note: The original file extension is always preserved and appended automatically.*

---

## Known limitations

- **Album Name Collision**: If an individual track shares the exact same name as the album itself, it can occasionally skew search results. Use the `--album` flag with precise casing to narrow down the query.
- **MP3-Only Tagging & Cover Art**: `node-id3` natively supports `.mp3` files. FLAC, M4A, OGG, and WAV files will be successfully renamed, but ID3 tags and cover art embedding will be skipped for non-MP3 formats.
- **Top 5 Results Only**: If the correct release isn't in the top 5 MusicBrainz results, refine your query using both `--artist` and `--album`.
- **Multi-disc Albums**: Track positions are indexed globally across all discs, which can occasionally result in duplicate position numbers on multi-disc releases.
- **Exotic Artist Names**: For artists with non-ASCII characters or complex scripts, search results might require an explicit `--artist` flag for precision.