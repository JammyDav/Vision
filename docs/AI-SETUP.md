# Private single-image recognition

Do this **after the headset produces a captured JPEG of the real room**. The proxy is provided and tested with a mocked provider. No live model call or account billing is performed during repository setup.

## Architecture

```text
Quest Browser → GitHub Pages (HTML / JS / CSS)
  reviewed JPEG + separate private proxy token
      → your HTTPS Node proxy → OpenAI Responses API
                                 provider key stays here
```

GitHub Pages serves the frontend. A separately hosted Node.js 24 service runs `server/index.mjs`. No Unity or native camera wrapper is needed if the installed browser exposes usable real camera input. The proxy cannot unlock unavailable cameras.

## Configure the server

1. Create an OpenAI API key in your own API project, and choose an image-capable model available to that project. Set **OPENAI_MODEL** explicitly; it is not user-selectable in the browser. See [official image-input documentation](https://developers.openai.com/api/docs/guides/images-vision) and your account's model access. The initial prompt uses coarse descriptions and `detail: low`.
2. Generate a separate proxy access token of at least 32 random characters. Example:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

3. For local setup copy `.env.example` to `.env`, fill the provider key, model and separate proxy token, and set `ALLOWED_ORIGIN=http://localhost:4173`. `.env` is ignored by Git. Do not paste secrets into terminal commands, screenshots or URLs. In production, use your hosting service's secret manager/environment settings.
4. Run `npm run dev` and `npm run proxy` in separate terminals. For a **desktop** camera test, enter `http://localhost:8787/recognize` and the private proxy token in the app.
5. For the headset, deploy the Node service on a host supporting persistent Node processes and environment secrets, behind HTTPS. Set `ALLOWED_ORIGIN=https://jammydav.github.io` (origin only, no `/Vision/`, no trailing slash). Set `HOST=0.0.0.0` only when required by your host and put its TLS ingress in front. Keep the process port private behind that ingress. Start with `npm run proxy` from the repo root, or `node server/index.mjs` when the host injects environment values.
6. Enter your resulting `https://YOUR-HOST/recognize` URL and private proxy token in the page. Localhost on the headset refers to the headset, not your PC. HTTPS Pages cannot call an ordinary HTTP LAN proxy.

There is intentionally no committed deployment containing credentials, no default public proxy, and no provider secret in Pages or Actions. Deploy the proxy only when the camera gate passes and you are ready for billable calls.

## Security boundaries and limits

- Exact origin allowlist plus authentication on every POST. CORS alone is not authentication; callers outside browsers can forge Origin.
- The private proxy token is a bearer secret, held in the current page and cleared on background/page exit. Do not commit it to frontend configuration or distribute it in a public app. Rotate it in server settings if exposed, and enter the new one manually.
- Only POST `/recognize`, JSON, a single canonical JPEG data URL, image bytes up to 768 KB, dimensions up to 768×768. The parser checks JPEG markers/dimensions, not complete image decoding. No remote image URLs, arbitrary prompts, client model overrides or tools are accepted.
- One provider request at a time, at most six authenticated attempts per minute, and **20 provider attempts per process lifetime** by default. `MAX_REQUESTS` can reduce/increase the process budget. Provider errors consume that budget because some may be billable. Process restart resets limits; scaling to multiple instances multiplies limits. Use one instance for this private trial.
- The process budget is a trial guard, not a durable spending cap. Configure project spend/rate controls and hosting ingress limits separately; add persistent per-user quotas and real login before a multi-user deployment. The shared bearer token design is intended for one trusted tester.
- Request bodies/images and upstream error bodies are not logged or persisted by this server. Configure hosting access logs, traces, TLS, timeouts and body limits accordingly. Response errors are generic.
- `store: false`, bounded output and no tools reduce stored application state and scope; they do not promise zero provider retention. Review [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data) before sending private images. The page names both the proxy and OpenAI in the upload consent.
- Credentials sent to a URL go to that configured proxy. Only enter a proxy URL you own/trust. The frontend requires HTTPS outside localhost and rejects credentials/query strings/fragments in endpoint URLs.

## Validation

Automated tests exercise origin/auth rejection, preflight, payload boundaries, no client-key forwarding, request limits, concurrent requests and safe provider errors, without live API calls. On the headset you still need to verify that the camera frame is real and readable, the proxy is reachable with correct CORS/TLS, and the chosen model returns useful descriptions.
