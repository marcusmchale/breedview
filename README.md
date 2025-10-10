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
```

## Project setup
npm install

### Compiles and hot-reloads for development
```
npm run serve
```
With this running you should now be able to visit localhost:8080 and see the page loaded

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
