import assert from "node:assert/strict";
import test from "node:test";
import { countWords, wordLimitError } from "../src/components/datatable/util/word-count.ts";

test("500 words are accepted even when longer than 1000 characters", () => {
  const value = Array(500).fill("programming").join(" ");
  assert.ok(value.length > 1000);
  assert.equal(countWords(value), 500);
  assert.equal(wordLimitError(value, 500, "Description"), undefined);
});

test("501 words return a field error, removing the extra word clears it", () => {
  const words = Array(501).fill("môn");
  assert.equal(wordLimitError(words.join(" "), 500, "Description"), "Description must not exceed 500 words");
  assert.equal(wordLimitError(words.slice(0, 500).join(" "), 500, "Description"), undefined);
});

test("Vietnamese words and Unicode whitespace follow the backend convention", () => {
  assert.equal(countWords(" \t\n\uFEFFJava\u00A0cơ\u202Fbản\nOOP\tSQL "), 5);
  assert.equal(countWords("Spring-Boot Java/OOP"), 2);
});

test("empty optional descriptions do not consume words", () => {
  for (const value of [undefined, null, "", " \n\t\u00A0\uFEFF"]) assert.equal(countWords(value), 0);
});

test("fields without a word limit keep their existing behavior", () => {
  assert.equal(wordLimitError(Array(501).fill("word").join(" "), undefined, "Other description"), undefined);
});
