# breedview

BreedView is the web front end of [BreedGraph](https://github.com/marcusmchale/breedgraph). Its user guide, a chapter at
a time with a video of each, is at https://marcusmchale.github.io/breedview/guide/ (guide/README.md).

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
an optional `branding/` folder beside it (under its base path, e.g. `/demo/branding/` for the demonstration site), whose
`branding.json` BreedView reads at start-up (`src/branding`). Without one, as on the demonstration site, the app keeps
its own, "white-label" look, which `branding.example/branding.json` spells out.

`branding.json`'s keys, every one optional:

- `colors`: `header` and `headerText` (the navigation bar), `primary` (primary buttons and links), `accent` (what is
  selected, focused or active), `accentLight` (the background of what is selected), `link` (links in text, `primary`
  unless given), `footer` and `footerText`; any CSS colour. The darker shades (`primaryDark`, `accentDark`,
  `accentDarker`) and `accentLight` are worked out from `primary` and `accent` unless given. The colours of what things
  mean (errors, additions, greys) stay as they are.
- `logos`: `[{ "src": "logo.svg", "alt": "…", "href": "https://…", "height": 40 }]`, shown before BreedView's name.
- `footer`: `{ "text": "…", "links": [{ "label": "…", "href": "https://…" }] }`, beside the user guide, the Terms of
  Use and the privacy notice.
- `font`: `{ "family": "\"Open Sans\", Arial, sans-serif", "stylesheet": "fonts/fonts.css" }`, the stylesheet's
  `@font-face` rules naming font files in the folder.
- `favicon`: `"favicon.ico"`; `stylesheet`: `"brand.css"`, for anything the colours don't reach (fonts too, then).

Files (`src`, `favicon`, `stylesheet`) are paths within the branding folder, as the app contacts no third party; links
may go anywhere. What can't be used is left out, with a warning in the browser's console. Use each logo in the version
made for the background it sits on (a negative one on a dark header): never recolour one.

**Keeping it.** Keep a deployment's branding beside the code but out of it, in `private.branding/`, which git ignores,
with a README of where its files came from.

**Deploying it.** On the server, keep it outside the web root, so that a new build never overwrites it:

```
scp -r private.branding user@server:~/breedview-branding
# then on the server
sudo mkdir -p /etc/breedview
sudo rm -rf /etc/breedview/branding
sudo cp -r ~/breedview-branding /etc/breedview/branding
sudo chmod -R a+rX /etc/breedview/branding
```

and serve it at `/branding/`, in the site's nginx server block (breedgraph README.md, Nginx). `^~` keeps nginx's
regular-expression locations, such as one caching `.css` or `.svg` files from the web root, from taking its files, and
`no-cache` has browsers check for a newer brand at each visit:

```
location ^~ /branding/ {
    alias /etc/breedview/branding/;
    add_header Cache-Control "no-cache";
}
```

then `sudo nginx -t` and `sudo systemctl reload nginx`. To change the brand, change the folder's files: no rebuild or
restart is needed. Check that `https://<the host>/branding/branding.json` is served as JSON, that the header and footer
show the brand, and that the browser's console has no `branding.json:` warnings. The API's emails name the site by
breedgraph's `SITE_NAME`, and its Terms of Use and privacy notice are files of their own (`TERMS_OF_USE_PATH`,
`PRIVACY_NOTICE_PATH`): branding doesn't change them.

### Lints and fixes files
```
npm run lint
```

