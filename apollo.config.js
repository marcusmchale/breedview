module.exports = {
  client: {
    service: {
      name: process.env.VUE_APP_NAME,
      url: process.env.VUE_APP_GRAPHQL_URI,
    },
    // Files processed by the extension
    includes: ['src/**/*.vue', 'src/**/*.js', 'src/**/*.graphql'],
  },
}