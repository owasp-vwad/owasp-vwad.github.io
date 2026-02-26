# GitHub Actions Workflows

Workflows in this directory:

- **Validate JSON** (`validate.yml`) – On PRs that change `data/collection.json`, runs schema, ordering, and .editorconfig checks. **Comment** (`comment.yml`) posts failure details on the PR when validation fails.
- **Update GitHub Statistics** (`update-stats.yml`) – Weekly; updates stars and last-contribution dates in `collection.json`, and `data/archived_repos.json` when it detects archived repos (may create an issue).
- **Update GitHub Contributors** (`update-contributors.yml`) – Weekly; writes `data/contributors.json` and commits when changed.
- **Link Checker** (`link-checker.yml`) – Manual; validates app and reference URLs in `collection.json`.
- **Repository Scout** (`repo-scout.yml`) – Weekly; runs `scout.py` to discover new vulnerable-app repos and opens an issue with findings.
- **Trigger Rebuild** (`rebuild.yml`) – Daily; triggers a GitHub Pages build via the API.

See [scripts/README.md](scripts/README.md) for script details.
