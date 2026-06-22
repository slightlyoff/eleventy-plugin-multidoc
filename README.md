# @slightlyoff/eleventy-plugin-multidoc

A small [11ty](https://www.11ty.dev/) plugin for generating multiple output
documents from a single markdown file.

## Usage

First, install the plugin in your project:

```sh
> npm i -s @slightlyoff/eleventy-plugin-multidoc
```

Then import the plugin in your `.eleventy.js` (or whatever name you use for
your 11ty entrypoint file):

```js
// NOTE: only tested in modern ESM-based projects
import multiDocPlugin from "@slightlyoff/eleventy-plugin-multidoc";
export default async function(config) {
  await config.addPlugin(multiDocPlugin);
  // ...
}
```

This allows you to write Markdown files whose name end in `.multidoc.md` that
are split by the string `<!-- --- -->`; e.g. if we had a file located at
`./yoursite/postname.multidoc.md`, and it contains:

```md
# The First Chunk

 - Each will be output to `<output-dir>/postname/<number>/index.html` 
 - The output directory is configured by 11ty
 - The base directory name is the left-most component of the `*.multidoc.md` file name
 - Each internal directory is created in 1-based increments.

This chunk will land in: `<output-dir>/postname/1/index.html`

<!-- --- -->
# A Second Chunk

Output to: `<output-dir>/postname/2/index.html`

<!-- --- -->
---
title: "You can set 11ty through frontmatter sections"
subtitle: "These are also available as page data for processing"
---
# A Third Chunk

Output to: `<output-dir>/postname/3/index.html`
```

## Controlling Output File Structure

The default output structure may not be convenient, and so an option is
provided to alternatively output numbered files, and to rename files using
frontmatter.

To output all chunks into a single directory, pass the `flatten` parameter to
the plugin's configuration option, passed as the second parameter when
registering:

```js
// .eleventy.js
import multiDocPlugin from "@slightlyoff/eleventy-plugin-multidoc";
// ... 
export default async function(config) {
  await config.addPlugin(multiDocPlugin, {
    flatten: true,
  });
  // ...
}
```

Using the above example, the output structure would go from:

```
<output-dir>
└── postname
    ├── 1
    │   └── index.html
    ├── 2
    │   └── index.html
    └── 3
        └── index.html

```

to:

```
<output-dir>
└── postname
    ├── 1.html
    ├── 2.html
    └── 3.html
```

Control of filenames can be configured through frontmatter and combined with
`flatten: true` using either the usual `permalink` attribute, or a separate `filename` property:

```md
---
title: "Universal Declaration of Human Rights"
filename: "preamble-1"
---
# Preamble

> Whereas recognition of the inherent dignity and of the equal and inalienable
rights of all members of the human family is the foundation of freedom, justice
and peace in the world,

<!-- --- -->

> Whereas disregard and contempt for human rights have resulted in barbarous
> acts which have outraged the conscience of mankind, and the advent of a world
> in which human beings shall enjoy freedom of speech and belief and freedom
> from fear and want has been proclaimed as the highest aspiration of the
> common people,

<!-- --- -->
---
filename: "postname/preamble-3.html"
# If a filename ends in `.html` that is used verbatim.
---

> Whereas it is essential, if man is not to be compelled to have recourse, as a
> last resort, to rebellion against tyranny and oppression, that human rights
> should be protected by the rule of law,

<!-- ... -->
```

Which will produce the following files:

```
<output-dir>
├── 2
│   └── index.html
├── postname
│   └── preamble-3.html
└── preamble-1.html
```

## Advanced Configuration

### Stripping Comments

The plugin supports custom file boundary delimiters, as well as pre-processing
functions for both the overall source file, as well as individual chunks, to
ensure that unwanted content isn't processed across file boundaries. A classic
example of this are comments that might span multiple chunks, e.g. if you're
using nunjucks in markdown templates.

Here's an example that strips Nunjucks comments before each file is chunked and
transformed using the provided function for stripping comments:

```js
// Your project's .eleventy.js
import { multiDocPlugin, commentRemover } from 
    "@slightlyoff/eleventy-plugin-multidoc";

export default async function(config) {
  // ...

  await config.addPlugin(multiDocPlugin, {
    pattern: "**/*.slides.md",
    filePreProcess: commentRemover(),
  });

  // ...

  return {
    markdownTemplateEngine: "njk",
    templateFormats: [ "md", "njk" ],
    dir: {
      input: "./yoursite",
      includes: "../_includes",
      layouts: "../_layouts",
      data: "../_data",
      output: "../out"
    }
  }
}
```

### Custom file separators

The default separator (`<!-- --- -->`) can be overridden using the `separator` parameter. Here, for example, we set it to `=====`, which must be the entire content of a line:

```js
// .eleventy.js
import multiDocPlugin from "@slightlyoff/eleventy-plugin-multidoc";
// ... 
export default async function(config) {
  await config.addPlugin(multiDocPlugin, { separator: "=====" });
  // ...
}
```

[Pandoc,](https://pandoc.org/MANUAL.html#structuring-the-slide-show) uses any Markdown horizontal rule as a document delimiter, which can be re-created using a regular expression:

```js
// .eleventy.js
import multiDocPlugin from "@slightlyoff/eleventy-plugin-multidoc";
// ... 
export default async function(config) {
  await config.addPlugin(multiDocPlugin, {
    // Match 3 or more dashes starting a line, followed by 
    // any number of additional dashes, then any number of 
    // spaces or tabs to the end of a line:
    separator: /^-{3,}\s*$/m,
  });
  // ...
}
```
