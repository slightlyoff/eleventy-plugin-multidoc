// eleventy-plugin-multidoc.js
import * as fs from "node:fs";
import * as path from "node:path";
import { default as matter } from "gray-matter";
import { globSync } from "tinyglobby";

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function identity(i) { return i; }

/**
 * Split a raw multi-doc file into segments.
 * @param {string} rawContent - Full file content including first front matter.
 * @param {string|RegExp} separator - Delimiter between segments.
 * @returns {Array<{data: object, content: string}>}
 */
function splitMultiDoc(rawContent, separator = "---", preProcess=identity) {
  let normalized = preProcess(rawContent.replace(/\r\n/g, "\n"));

  // Parse the first front matter block (standard gray-matter behavior)
  let firstParse = matter(normalized);
  let firstData = firstParse.data;
  let body = firstParse.content;

  // Build pattern from separator
  let splitPattern = separator instanceof RegExp ? separator
                      : new RegExp(`^\\s*${escapeRegex(separator)}\\s*$`, "m");

  // Split content body
  let chunks = body.split(splitPattern);

  let segments = [{
    data: firstData,
    content: chunks[0]
  }];

  for (let i = 1; i < chunks.length; i++) {
    let chunk = chunks[i].trim();
    if(!chunk) { continue; } // skip empty chunks 

    // Subsequent chunks: check for their own front matter
    if(chunk.startsWith("---\n")) {
      let parsed = matter(chunk);
      segments.push({ data: parsed.data, content: parsed.content.trim() });
    } else {
      segments.push({ data: {}, content: chunk });
    }
  }

  return segments;
}

/**
 * multiDocPlugin options
 * @typedef {Object} MultiDocOptions
 * @property {string} [pattern="**\/*.multidoc.md"]- Glob pattern for matching files
 * @property {string} [separator="---"] - Frontmatter separator
 * @property {boolean} [navigation=true] - Should "prev" and "next" links be auto-generated?
 * @property {Function} [filePreProcess] - Function called to pre-process the text of the whole multi-section file
 * @property {Function} [chunkPreProcess] - Called per split chunk
 */

// let oldConfig = null;

/**
 * Eleventy plugin: Multi-Doc
 * @param {Object} eleventyConfig- The Eleventy configuration object
 * @param {MultiDocOptions} [options] - File pattern, frontmatter separator, and link options
 */
export default function multiDocPlugin(eleventyConfig, options={}) {
  let {
    pattern = "**/*.multidoc.md",
    separator = "---",
    navigation = true,
    filePreProcess = identity,
    chunkPreProcess = identity,
  } = options;

  // Watch source file changes; triggers config reset, and plugin re-executes
  eleventyConfig.addWatchTarget(pattern, { resetConfig: true });

  // Opt matching files out of normal template processing
  eleventyConfig.ignores.add(pattern);

  let inputDir = eleventyConfig.directories?.input || ".";

  // Find and process all matching files
  let files = globSync(pattern, { cwd: inputDir });

  for (let filePath of files) {
    let absolutePath = path.join(inputDir, filePath);
    let rawContent = fs.readFileSync(absolutePath, "utf-8");
    let processed = filePreProcess(rawContent);
    let segments = splitMultiDoc(processed, separator, chunkPreProcess);

    if (!segments.length) { continue; }

    // Base stem: "talks/my-talk.slides.md" to "outdir/my-talk/[1...N]/index.html"
    // TODO: make extension configurable
    let baseStem = filePath.replace(/\.\w+\.md$/, "");

    // Create a virtual template per segment
    segments.forEach((segment, index) => {
      // TODO: really hate this as an output structure
      let virtualPath = `${baseStem}/${index + 1}.md`;
      let segmentData = { ...segment.data };
      let prev = segmentData.prev || (
        index > 0 ? `/${baseStem}/${index}/` : null
      );
      let next = segmentData.next || (
        index < segments.length - 1 ? `/${baseStem}/${index + 2}/` : null
      );

      if (navigation) {
        segmentData.multiDoc = {
          index,
          total: segments.length,
          sourceFile: filePath,
          // TODO: make "prev" and "next" configurable via frontmatter
          prev: index > 0 ? `/${baseStem}/${index}/` : null,
          next: index < segments.length - 1 ? `/${baseStem}/${index + 2}/` : null,
        };
        segmentData.prev = segmentData.prev || segmentData.multiDoc.prev;
        segmentData.next = segmentData.next || segmentData.multiDoc.next;
      }

      if (!segmentData.permalink) {
        segmentData.permalink = `/${baseStem}/${index + 1}/`;
      }

      eleventyConfig.addTemplate(virtualPath, segment.content, segmentData);
    });
  }
}

// module.exports = multiDocPlugin;
// module.exports.splitMultiDoc = splitMultiDoc;
