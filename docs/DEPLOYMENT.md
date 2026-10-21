# GitHub Pages deployment

Repository: https://github.com/JammyDav/Vision

## Automatic deployment from main

The active publishing source is **GitHub Actions**. The repository's `gh-pages` branch contains an initial static snapshot and is not the active publishing source; all future work belongs on `main` or feature branches.

1. Push this repository to `main`. The workflow is `.github/workflows/pages.yml`.
2. In GitHub, open **Settings → Pages → Build and deployment → Source → GitHub Actions**. Do this before the first workflow run (or rerun the workflow after enabling it).
3. Open **Actions → Check and deploy Pages**. Run the workflow on main if necessary and wait for both jobs to succeed.
4. Open the URL shown in the `github-pages` deployment. For this repository it is expected to be `https://jammydav.github.io/Vision/`.
5. Open that same URL in the headset's standalone Browser. All asset paths are relative, so `/Vision/` is supported.

If you are starting from the delivered local checkout:

```sh
git status
git remote -v
git push -u origin main
```

Use your normal GitHub authentication; never paste credentials into code, a remote URL, or chat. If direct push is blocked by repository rules, push a feature branch and open a PR. The workflow validates PRs without publishing them.

## What the workflow publishes

Checks run before deployment: syntax/static publication boundaries, automated tests, then copying `public/` into `dist/`. Only `dist/` is uploaded. The backend, tests, docs, `.env` and Git metadata are excluded. No API key is required in GitHub Actions.

The default branch is `main`. If you rename it, update the workflow's push filter. Set branch protections and deployment environment rules as appropriate for your repository. Actions use official major-version tags; pin to reviewed commit hashes if your repository policy requires it.

GitHub Pages supplies HTTPS. It cannot run the AI proxy or keep server secrets. GitHub Pages does not let this static app set arbitrary HTTP response headers. The local preview's Permissions-Policy header is a development safeguard; it is not a Pages header configuration. For this reason, use a top-level browser page and inspect the runtime policy result.

## Updating

Edit the modules in `public/src/`, run the three checks in the README, commit and push. Pushes to main redeploy automatically. Hard refresh on Quest if an old version remains cached. There is no service worker to remove.

To revert a published change, revert its commit on main, run checks and push. This does not change camera permissions already granted in the browser; those are controlled through site/OS settings.
