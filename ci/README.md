# CI workflows

These are ready to run, but they live here rather than in `.github/workflows/`
because the token used to create this branch lacks GitHub's `workflow` scope and
the push is rejected outright if it touches that directory.

Activate them with one command:

```bash
mkdir -p .github/workflows && git mv ci/workflows/*.yml .github/workflows/
git commit -m "Enable CI workflows"
```

Push that from an account or token with the `workflow` scope.

| File | What it does |
|---|---|
| `ci.yml` | Typecheck, test, build the corpus, bundle the app. Runs on every push and PR. |
| `deploy-web.yml` | Exports the PWA and publishes it to GitHub Pages on `main`. Enable Pages with source "GitHub Actions" in repository settings first. |

`ci.yml` treats the corpus build as a test: validation is a gate, so a content
defect — a transcription with no stress mark, an unreviewed example sentence, a
one-way synonym — fails the build and therefore fails CI.
