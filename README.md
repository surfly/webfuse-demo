# Webfuse live demo: start page

The landing page for a personal Webfuse demo link of the form `https://<host>/?t=<token>`.

What it does:

1. It reads the token from the link and shows who the demo is for and which website it runs on. The token is only decoded for display here; the page never verifies it and holds no keys.
2. When the visitor clicks **Start the demo**, the page sends the token to the start endpoint (`API_URL` in `config.js`). The endpoint verifies the token, checks its expiry and start limit, and answers with a link to a live Webfuse session.
3. The browser then opens that session, where Victor, an AI agent, walks the visitor through Webfuse on their own website.

Expired, used up or invalid links show a clear message with a "Request a new link" email button. When the endpoint is busy or unreachable, the page offers a retry.

Static HTML, CSS and JavaScript: no build step, no third-party scripts, no tracking. Deployment settings (endpoint, allowed session origin, contact address) live in `config.js`.

## `layer/`: the concept page

`layer/index.html` is the page a demo session opens on: "Keep the website. Add the layer." It shows the Webfuse augmentation layer for voice agents (three layers, the position between a voice that only describes a screen and a caller on their own, the Redmond proof on a credit union's signup, three steps in a call). Victor narrates it at the start of the demo; his card finds its headings, labels and numbers by their visible text, so keep those strings stable.

The demo card marks the page with `data-fde-agent` and sets `data-fde-beat` on `<html>` as it plays: the hero opens black and unfolds with the narration (`greeting`, then `layer-1` to `layer-3`), and later beats replay their section's animation. Opened without the demo, the hero plays by itself after a moment. One self-contained file (logo and icon inline): no external requests.
