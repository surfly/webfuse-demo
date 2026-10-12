# Webfuse live demo

## The start page moved to demo.webfuse.it

The landing page for a personal demo link is served at `https://demo.webfuse.it/` since 2026-10-12: short links are `https://demo.webfuse.it/<link id>`, full links `https://demo.webfuse.it/?t=<token>`. Its source now lives with the demo's server-side code, not in this repository; edit it there, not here.

The root `index.html` here only forwards links sent before the move: `?c=<link id>` goes to `https://demo.webfuse.it/<link id>`, `?t=<token>` to `https://demo.webfuse.it/?t=<token>`.

## `layer/`: the concept page

`layer/index.html` is the page a demo session opens on: "Keep the website. Add the layer." It shows the Webfuse augmentation layer for voice agents (three layers, the position between a voice that only describes a screen and a caller on their own, the Redmond proof on a credit union's signup, three steps in a call). Victor narrates it at the start of the demo; his card finds its headings, labels and numbers by their visible text, so keep those strings stable.

The demo card marks the page with `data-fde-agent` and sets `data-fde-beat` on `<html>` as it plays: the hero opens black and unfolds with the narration (`greeting`, then `layer-1` to `layer-3`), and later beats replay their section's animation. Opened without the demo, the hero plays by itself after a moment. One self-contained file (logo and icon inline): no external requests.
