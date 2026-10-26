# breedview

## Node setup
```
Consider using nvm https://github.com/nvm-sh/ to manage node versions
Install it using the bash script on the page (verify this link by checking the github)
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
Then to ensure the binary is in your path
  . ~/.bashrc
Then install the latest lts of node
  nvm install --lts --latest-npm
  
Now using vite
```

## Project setup
npm install

### Compiles and hot-reloads for development

```
npm run dev
```
With this running you should now be able to visit localhost:8080 and see the page loaded

### Compiles and minifies for production
```
npm run build
```
then copy dist contents to /var/www/breedview

### Branding
A deployment can carry its own brand, its colours, logos, font and footer links, without changing or rebuilding the app:
an optional `branding/branding.json` beside the app (under its base path, e.g. `/demo/branding/` for the demonstration
site), read at start-up (`src/branding`). Without one the app keeps its own, "white-label" look, which
`branding.example/branding.json` spells out. Keep your branding outside the build, so a new build never overwrites it,
and serve it with nginx, e.g.

```
location /branding/ {
    alias /etc/breedview/branding/;
}
```

Every key is optional:

- `colors`: `header` and `headerText` (the navigation bar), `primary` (primary buttons and links), `accent` (what is
  selected, focused or active), `accentLight` (the background of what is selected), `link` (links in text, `primary`
  unless given), `footer` and `footerText`; any CSS colour. The darker shades (`primaryDark`, `accentDark`, `accentDarker`) and `accentLight` are worked out from
  `primary` and `accent` unless given. The colours of what things mean (errors, additions, greys) stay as they are.
- `logos`: `[{ "src": "logo.svg", "alt": "…", "href": "https://…", "height": 40 }]`, shown before BreedView's name.
- `footer`: `{ "text": "…", "links": [{ "label": "…", "href": "https://…" }] }`, beside the user guide, the Terms of
  Use and the privacy notice.
- `font`: `{ "family": "\"Open Sans\", Arial, sans-serif", "stylesheet": "fonts/fonts.css" }`, the stylesheet's
  `@font-face` rules naming font files in the folder.
- `favicon`: `"favicon.ico"`; `stylesheet`: `"brand.css"`, for anything the colours don't reach.

Files (`src`, `favicon`, `stylesheet`) are paths within the branding folder, as the app contacts no third party; links
may go anywhere. What can't be used is left out, with a warning in the browser's console. The API's emails name the
site by breedgraph's `SITE_NAME`, and its Terms of Use and privacy notice are files of their own
(`TERMS_OF_USE_PATH`, `PRIVACY_NOTICE_PATH`).

### Lints and fixes files
```
npm run lint
```

