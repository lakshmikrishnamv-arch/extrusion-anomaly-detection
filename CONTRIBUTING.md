# Contributing to Extrusion Anomaly Detection

Thank you for your interest in contributing to this project. All contributions —
whether they are bug fixes, new features, documentation improvements, or research
extensions — are warmly welcomed.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How to Contribute](#how-to-contribute)
3. [Development Setup](#development-setup)
4. [Submitting a Pull Request](#submitting-a-pull-request)
5. [Reporting Bugs](#reporting-bugs)
6. [Suggesting Features or Research Directions](#suggesting-features-or-research-directions)
7. [Style Guidelines](#style-guidelines)
8. [Recognition](#recognition)

---

## Code of Conduct

This project follows a simple principle: **be respectful, be constructive, be honest**.
We welcome contributors from industry, academia, and independent research backgrounds.
Discussions about methodology, statistical validity, and implementation choices are
encouraged — disagreement is fine; disrespect is not.

---

## How to Contribute

There are several meaningful ways to contribute:

**Research contributions:**
- Validate fault signatures against real plant data and submit updated signature vectors
- Implement and benchmark alternative fault isolation methods (SHAP, causal graphs)
- Contribute case studies comparing this prototype against other MSPC implementations

**Code contributions:**
- Implement features listed in the [Roadmap](./README.md#14-roadmap)
- Fix bugs or improve robustness
- Improve test coverage
- Add support for additional process types (wire drawing, stranding, compounding)

**Documentation contributions:**
- Improve clarity of methodology explanations
- Translate documentation into other languages
- Add screenshots, GIFs, or video walkthroughs
- Add worked examples with real or publicly available datasets

---

## Development Setup

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/extrusion-anomaly-detection.git
cd extrusion-anomaly-detection

# 2. Create a React project and install dependencies
npx create-react-app demo
cd demo
npm install recharts

# 3. Copy the main component
cp ../src/extrusion-anomaly-v2.jsx src/App.jsx

# 4. Start the development server
npm start

# 5. Create a feature branch for your work
git checkout -b feature/your-feature-name
```

---

## Submitting a Pull Request

1. Fork the repository and create your branch from `main`
2. Make your changes, following the Style Guidelines below
3. Test your changes — confirm the demo loads and fault injection works correctly
4. Update `README.md` if your change adds or modifies any documented behavior
5. Update the comment block in `extrusion-anomaly-v2.jsx` if you change the methodology
6. Open a Pull Request with:
   - A clear title summarizing the change
   - A description of what was changed and why
   - Any relevant references if the change is methodology-related

---

## Reporting Bugs

Please use GitHub Issues and include:

- A clear description of the unexpected behavior
- Steps to reproduce the issue
- Browser and operating system version
- Console error output if applicable

---

## Suggesting Features or Research Directions

GitHub Issues are also the right place for feature suggestions and research
direction proposals. Please prefix the issue title with **[FEATURE]** or
**[RESEARCH]** and provide:

- A clear description of the proposed addition
- The industrial or research motivation
- Any relevant references or prior art

---

## Style Guidelines

**Code style:**
- Use functional React components with hooks (no class components)
- Keep all styling inline (no external CSS files) to preserve single-file deployability
- Use descriptive variable names — `computeContributions` not `cc`
- Add a brief comment above each major function explaining its purpose and the
  underlying method or reference it implements
- All mathematical formulas implemented in code should be documented with their
  source reference in an adjacent comment

**Documentation style:**
- Use plain English; avoid jargon where a plain term serves equally well
- Every methodology section must cite at least one peer-reviewed reference
- Spell out acronyms on first use in every major section

**Commit message format:**
```
type: short description (under 72 characters)

Longer explanation if needed. Reference relevant issues with #issue-number.
```
Types: `feat`, `fix`, `docs`, `refactor`, `test`, `style`, `chore`

---

## Recognition

All contributors will be acknowledged in the README and in the repository's
contributor list. Research contributions that substantially extend the methodology
will be acknowledged in any future academic publication arising from this work,
subject to standard authorship criteria.

---

*Thank you for contributing to open industrial AI research.*
