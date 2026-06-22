import test from "ava";
import fs from "node:fs";
import Eleventy, { RenderPlugin } from "@11ty/eleventy";
import { multiDocPlugin, commentRemover } from "../index.js";

let basicConfig = {
  config: async function(config) {
    await config.addPlugin(multiDocPlugin);
  }
};

test("Basic splitting", async (t) => {
  let mdDir = "test/stubs/markdown";
  let elev = new Eleventy(mdDir, "_site", basicConfig);
  let results = await elev.toJSON();
  t.is(results.length, 2, "returned documents");

  let first = results[0];
  t.is(first.inputPath,  `./${mdDir}/test/1/index.md`);
  t.is(first.outputPath, `./_site/test/1/index.html`);
  t.is(first.rawInput,    `<!-- Test -->`);
  t.is(first.content,     `<!-- Test -->`);

  let second = results[1];
  t.is(second.inputPath,  `./${mdDir}/test/2/index.md`);
  t.is(second.outputPath, `./_site/test/2/index.html`);
  t.is(second.rawInput,   `# ...`);
  t.is(second.content,    `<h1>...</h1>\n`);
});

test("Flatten", async (t) => {
  let mdDir = "test/stubs/markdown";
	let elev = new Eleventy(mdDir, "_site", {
    config: async function(config) {
      await config.addPlugin(multiDocPlugin, { flatten: true });
    }
  });
  let results = await elev.toJSON();
  t.is(results.length, 2, "returned documents");

  let first = results[0];
  t.is(first.inputPath,    `./${mdDir}/test/1.md`);
  t.is(first.outputPath,   `./_site/test/1.html`);

  let second = results[1];
  t.is(second.inputPath,   `./${mdDir}/test/2.md`);
  t.is(second.outputPath,  `./_site/test/2.html`);
});

let basicNJKTests = async (t, njkDir, results) => {
  t.is(results.length, 2, "returned documents");

  let first = results[0];
  t.is(first.inputPath, `./${njkDir}/test/1/index.md`);
  t.is(first.rawInput,  
       `# {{ title }}\n## {{ subtitle }}`);
  t.is(first.content,   
       `<h1>OH HAI</h1>\n<h2>why, hullo there!</h2>\n`);

  let second = results[1];
  t.is(second.rawInput, `# {{ title }}`);
  t.is(second.content,  `<h1>second doc</h1>\n`);
};

test("Frontmatter", async (t) => {
  let njkDir = "test/stubs/nunjucks";
	let elev = new Eleventy(njkDir, "_site", 
    { 
      markdownTemplateEngine: ["nkj"],
      ...basicConfig
    }
  );
	let results = await elev.toJSON();
  await basicNJKTests(t, njkDir, results);
});

test("Strip NJK comments", async(t) => {
  let njkDir = "test/stubs/nunjucks-comments";
	let elev = new Eleventy(njkDir, "_site", {
    config: async function(config) {
      await config.addPlugin(multiDocPlugin, {
        filePreProcess: commentRemover()
      });
    }
  });
  let results = await elev.toJSON();
  await basicNJKTests(t, njkDir, results);
});

test("Strip custom comments", async(t) => {
  let njkDir = "test/stubs/custom-comments";
	let elev = new Eleventy(njkDir, "_site", {
    config: async function(config) {
      await config.addPlugin(multiDocPlugin, {
        filePreProcess: commentRemover("{{--", "--}}")
      });
    }
  });
  let results = await elev.toJSON();
  await basicNJKTests(t, njkDir, results);
});

test("Custom separators", async(t) => {
  let dir = "test/stubs/custom-separator";
	let elev = new Eleventy(dir, "_site", {
    config: async function(config) {
      await config.addPlugin(multiDocPlugin, {
        separator: /^-{3,}\s*$/m,
      });
    }
  });
  let results = await elev.toJSON();
  t.is(results.length, 3, "returned documents");

  let first = results[0];
  t.is(first.rawInput,    `<!-- Test -->`);
  t.is(first.content,     `<!-- Test -->`);

  let second = results[1];
  t.is(second.rawInput,   `# ...`);
  t.is(second.content,    `<h1>...</h1>\n`);

  let third = results[2];
  t.is(third.rawInput,    `Howdy`);
  t.is(third.content,     `<p>Howdy</p>\n`);
});

test("Custom file names", async(t) => {
  let dir = "test/stubs/custom-file-names";
	let elev = new Eleventy(dir, "_site", basicConfig);
  let results = await elev.toJSON();

  t.is(results.length, 2, "returned documents");

  let first = results[0];
  t.is(first.url,         `/foo/bar/baz.html`);
  t.is(first.inputPath ,  `./${dir}/foo/bar/baz.md`);
  t.is(first.outputPath,  `./_site/foo/bar/baz.html`);

  let second = results[1];
  console.dir(second);
  t.is(second.url,         `/foo_bar.html`);
  t.is(second.inputPath,   `./${dir}/foo_bar.md`);
  t.is(second.outputPath,  './_site/foo_bar.html');
});