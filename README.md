# A History of Mind

A History of Mind is a reading-first website tracing how humans have thought about mind, soul, consciousness, and personhood across time.

It brings together ancient, medieval, early modern, modern, and contemporary thinkers in a single navigable archive, with essays written for serious readers who want clarity without oversimplification.

## What you’ll find

- Era overviews (e.g., Antiquity, Scholasticism, Early Modern, Analytic, Consciousness Science)
- Individual philosopher pages
- A glossary of key philosophy-of-mind concepts
- A clean, low-distraction reading interface

## Project scope

This is a static site in plain HTML/CSS/JS.
No framework, no build pipeline required for normal editing.

## View locally

```bash
cd "/Users/fabian/Documents/Personal/Philosophy/Digital Minds/history-of-mind"
python3 -m http.server 8000
```

Then open http://localhost:8000

## Structure (high level)

- `index.html` — homepage
- `about.html` — project background and method
- `glossary.html` — term definitions
- `eras/*.html` — era/category overview pages
- `philosophers/*.html` — individual philosopher entries
- `style.css` — shared styling
- `site.js` — interactive behavior

## Contributing

If you want to improve content or layout:
- keep links relative,
- keep the reading experience simple,
- and test homepage + at least one era page + one philosopher page.

---
Created and maintained by Fabián.