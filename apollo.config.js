module.exports = {
  client: {
    service: {
      name: import.meta.env.VITE_NAME,
      url: `${import.meta.env.VITE_API_HOST}${import.meta.env.VITE_GRAPHQL_PATH}`,
    },
    // Files processed by the extension
    includes: ['src/**/*.vue', 'src/**/*.js', 'src/**/*.graphql'],
  },
}