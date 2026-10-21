# GitHub Pages deployment

Repository: https://github.com/JammyDav/Vision

## Initial release: branch publishing

During setup, GitHub accepted the workflow file but did not register it or create any runs; manual workflow dispatch returned 404 even with repository Actions enabled. The initial diagnostic release therefore uses GitHub Pages' supported **gh-pages branch, root folder** publishing mode. Only the `public/` subtree is pushed to that branch. The source remains on `main`, and `.nojekyll` disables Jekyll processing.

After committing source changes on main, publish with:

```sh
npm run publish:pages
```

This runs the checks/tests/build, then uses `git subtree push --prefix public origin gh-pages` to update the static publishing branch without force-pushing. GitHub builds the branch automatically. In Settings → Pages, keep Source = Deploy from a branch, branch = gh-pages, folder = / (root) while using this method. Do not mix both deployment modes.

The command publishes committed files in `public/`; commit changes first. The build validates the artifact boundary, while the subtree publishes the same public source directly. Server code and secrets cannot enter this branch through the subtree command.

## Actions workflow: prepared for migration

Once GitHub registers the workflow, the checked-in workflow can replace branch publishing. Change Settings → Pages → Source to GitHub Actions, then follow the steps below. Future pushes to main will deploy automatically after checks. Until that migration, continue using `npm run publish:pages`.

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

Edit the modules in `public/src/`, run the three checks in the README, commit and push. In branch mode run `npm run publish:pages` after committing; in Actions mode pushes to main redeploy automatically. Hard refresh on Quest if an old version remains cached. There is no service worker to remove.

To revert a published change, revert its commit on main, run checks, push and republish using the active mode. This does not change camera permissions already granted in the browser; those are controlled through site/OS settings.
