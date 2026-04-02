# Beauty Dish

Beauty Dish is a small static web app for previewing a virtual key light for video calls. It renders a full-screen background wash that can run in SDR or HDR, and it lets you steer the light by color temperature and relative brightness from a 2D graph.

The current UI supports two ways to choose the base color:

- Temperature mode: drag inside the graph to pick a color temperature from `3000K` to `8000K` and a relative luminance value.
- Custom color mode: enter any valid `chroma.js` expression in the advanced panel to drive the renderer from an arbitrary color instead of a temperature preset.

The rendering pipeline is shared across the graph preview and the main renderer. SDR output is tone-mapped into sRGB. HDR output preserves chromaticity and only increases luminance while the selected color still fits the available HDR headroom.

## Project Layout

- [`index.html`](./index.html): page structure and control wiring entrypoint
- [`css/style.css`](./css/style.css): app styling
- [`js/index.js`](./js/index.js): app state, events, keyboard shortcuts, and picker theme logic
- [`js/app/renderController.js`](./js/app/renderController.js): renderer selection and mounting
- [`js/app/temperatureBrightnessGraph.js`](./js/app/temperatureBrightnessGraph.js): 2D graph drawing and interaction
- [`js/renderer/`](./js/renderer): SDR and HDR renderer backends plus capability probes
- [`js/utils/colorPipeline.js`](./js/utils/colorPipeline.js): canonical color pipeline

## Running Locally

This repo has no build step. Serve it from the repository root.

### Quick SDR/HDR check on localhost

`localhost` is usually enough to let Chromium expose the APIs this app uses for HDR detection, so the fastest path is:

```sh
cd /Users/cchainsm/Documents/Dev/beauty-dish
python3 -m http.server 8000
```

Then open:

```sh
open http://localhost:8000
```

If your browser and display support it, the app can detect HDR on `localhost`.

### HTTPS for hostname access

If you want to open the app as `https://your-hostname-here:8443` or another local hostname (like your tailscale hostname) and still keep HDR-capable browser APIs available, use HTTPS.

Install the prerequisites once:

```sh
brew install mkcert nss
mkcert -install
npm install -g http-server
```

Then start the bundled helper script:

```sh
cd beauty-dish
chmod +x ./serve-https.sh
./serve-https.sh
```

By default it:

- creates `.certs/dev-cert.pem` and `.certs/dev-key.pem` if they do not exist
- includes `localhost`, `127.0.0.1`, `::1`, and your machine hostname in the certificate
- serves the repo over HTTPS on port `8443`

Open either:

```sh
open https://localhost:8443
open https://your-hostname-here:8443
```

If you want a different port:

```sh
PORT=9443 ./serve-https.sh
```

## How HDR Works Here

The app only uses the HDR output path when both of these conditions pass:

- the browser reports `matchMedia("(dynamic-range: high)")`
- WebGPU can be initialized with a Display-P3 float canvas and extended tone mapping

That capability probe lives in [`js/renderer/capabilities.js`](./js/renderer/capabilities.js). If one of those checks fails, the app falls back to the SDR renderer.

## Manual Checks

There is no automated test suite yet. Useful manual checks:

- Drag the graph and confirm temperature and relative brightness update.
- Double-click the graph and confirm it resets to midpoint temperature and `1.00x`.
- Enter a custom `chroma.js` color and confirm the app switches to custom-color mode.
- In custom-color mode, confirm the graph preview is transparent and the selection ring is hidden.
- Toggle HDR and verify the status text and visible render change on a supported HDR display.
- Recheck webcam preview drag and resize behavior after UI changes.
