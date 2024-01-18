# AI Code Reviews

## Description

Using GPT-4 to do a first pass at a code review, making sure there isn't anything that got forgotten that isn't easily lintable.
Since this repo is otherwise open source, a workflow of "zip all relevant files and let the ai sort it out" is being taken.

## Prompt Format

Use the script `./tools/code-review-zip.sh` to build out a zip file to use with code reviews.
This prompt is intended to work with that zip, in ordero

```text
- please review the document `docs/ai/REVIEWS.md` for a description of concerns and workflows related to this repository
```

## Reviews Document

This contains general instructions, to describe concerns above and beyond a basic code review.
WIP, being updated from a proof of concept version
