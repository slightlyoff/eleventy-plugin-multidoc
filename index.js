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
 * Strip multi-line comments from a string, defaults to removing 
 * Nunjucks-style comments
 * @param {string} str - Full content
 * @param {string} [start="{#"] - Comment start, defaults to "{#"
 * @param {string} [end="#}"] - Comment end, defaults to "#}"
 * @returns {string}
 */
export function stripComments(str="", start="{#", end="#}") {
  // Slow, but easier than debugging a regex
  if(
    (str.length < start.length) ||
    (!str.includes(start)) || (!str.includes(end))) {
    return str;
  }
  // Don't use a builder arr + join; modern engines 
  // use ropes internally and that'll be faster.
  let ret = "";
  let idx = 0;
  let openedAt = str.indexOf(start, idx);
  while(openedAt >= 0) {
    // Snip from the end of the previous comment to start of the next one
    ret += str.substring(idx, openedAt);
    // Search from comment start for next comment end and bump index pointer to
    // that character
    idx = str.indexOf(end, (idx + start.length)) + end.length;
    // Find the next start
    openedAt = str.indexOf(start, idx);
  }
  ret += str.substring(idx);
  return ret;
}

/**
 * Generate a function to strip multi-line comments from a string. Defaults to
 * removing Nunjucks-style comments
 * @param {string} [start="{#"] - Comment start, defaults to "{#"
 * @param {string} [end="#}"] - Comment end, defaults to "#}"
 * @returns {Function} - A function to be passed to multiDocPlugin's 
 *                       filePreProcess argument.
 */
export function commentRemover(start="{#", end="#}") {
  return function(str) { return stripComments(str, start, end); }
}

/**
 * Split a raw multi-doc file into segments.
 * @param {string} rawContent - Full file content including first front matter.
 * @param {string|RegExp} separator - Delimiter between segments, defaults to `<!-- --- -->`
 * @returns {Array<{data: object, content: string}>}
 */
function splitMultiDoc(rawContent, 
                       separator = "<!-- --- -->", 
                       preProcess=identity) {
  let normalized = preProcess(rawContent.replace(/\r\n/g, "\n"));

  // Build pattern from separator
  let splitPattern = separator instanceof RegExp ? 
                      separator : 
                      new RegExp(`^\\s*${escapeRegex(separator)}\\s*$`, "m");

  // Split content body
  let chunks = rawContent.split(splitPattern);

  let segments = [];
  chunks.forEach((chunk, i) => {
    chunk = chunk.trim();
    if(!chunk) { return; } // skip empty chunks 

    matter.clearCache(); // *sigh*
    let parsed = matter(chunk);
    segments.push({ 
      data: parsed.data, 
      content: parsed.content.trim()
    });
  });
  return segments;
}

/**
 * multiDocPlugin options
 * @typedef {Object} MultiDocOptions
 * @property {string|RegExp} [pattern="**\/*.multidoc.md"]- Glob pattern for matching files
 * @property {string} [separator="<!-- --- -->"] - Document separator
 * @property {boolean} [navigation=true] - Should "prev" and "next" links be auto-generated?
 * @property {Function} [filePreProcess] - Function called to pre-process the text of the whole multi-section file
 * @property {boolean} [flatten=false] - Should all chunks be output to the same folder?
 * @property {Function} [chunkPreProcess] - Called per split chunk; return value of this function is used instead.
 */

/**
 * Eleventy plugin: Multi-Doc
 * @param {Object} eleventyConfig- The Eleventy configuration object
 * @param {MultiDocOptions} [options] - File pattern, frontmatter separator, and link options
 */
export default function() {
  return _mdp.call(this, ...arguments);
}

export let multiDocPlugin = _mdp;

function _mdp(eleventyConfig, options={}) {
  let {
    pattern = "**/*.multidoc.md",
    separator = "<!-- --- -->",
    navigation = true,
    filePreProcess = identity,
    chunkPreProcess = identity,
    flatten = false,
  } = options;

  // Watch source file changes; triggers config reset, and plugin re-executes
  eleventyConfig.addWatchTarget(pattern, { resetConfig: true });

  // Opt matching files out of normal template processing
  eleventyConfig.ignores.add(pattern);

  let inputDir = eleventyConfig.directories?.input || ".";

  // Find and process all matching files
  let files = globSync(pattern, { cwd: inputDir });

  files.forEach((filePath) => {
    let absolutePath = path.join(inputDir, filePath);
    let rawContent = fs.readFileSync(absolutePath, "utf-8");
    let processed = filePreProcess(rawContent);
    let segments = splitMultiDoc(processed, separator, chunkPreProcess);

    if (!segments.length) { return; }

    // Base stem: 
    //  "talks/my-talk.slides.md" to "outdir/my-talk/[1...N]/index.html"

    // TODO: make extension configurable
    let baseStem = filePath.replace(/\.\w+\.md$/, "");

    // TODO: allow zero-indexed for nerds?
    let getPathFor = function(segment, idx=0) {
      let path = segment?.data?.permalink || 
                 segment?.data?.filename ||
                `${baseStem}/${ idx + 1 }${ flatten ? "" : "/index" }`;
      return path;
    }

    // Create a virtual template per segment
    segments.forEach((segment, idx=0) => {
      let virtualBasePath = getPathFor(segment, idx);
      let virtualPath = `${virtualBasePath}.md`; 

      segment.data.multiDoc = {
        idx,
        virtualPath,
        total: segments.length,
        sourceFile: filePath,
      };

      if(!segment.data.permalink) {
        segment.data.permalink = `/${virtualBasePath}.html`;
      }
    });

    // Fixup prev/next links, then add template to build
    segments.forEach((segment, idx) => {
      // Prev
      if(navigation) {
        if(idx > 0) { 
          let prev = segments[idx - 1];
          segment.data.multiDoc.prev = segment.data.prev = prev.data.permalink;
        }
        // Next
        if(idx < segments.length - 1) {
          let next = segments[idx + 1];
          segment.data.multiDoc.next = segment.data.next = next.data.permalink;
        }
      }

      // Add
      eleventyConfig.addTemplate(segment.data?.multiDoc?.virtualPath,
                                 segment.content,
                                 segment.data);
    });
  });
}