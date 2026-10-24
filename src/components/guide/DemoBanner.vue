<script setup>
// Above every page of the demonstration site (built with VITE_DEMO_SITE=true: vite build --mode demo, .env.demo): what
// the site is, and where its guide is
const shown = import.meta.env.VITE_DEMO_SITE === 'true'
</script>

<template>
  <div v-if="shown" class="demo-banner" role="note">
    Demonstration site: the people, teams and data here are fictional and may be reset at any time.
    <router-link to="/guide">User guide</router-link>
  </div>
</template>

<style scoped>
.demo-banner {
  padding: 6px 16px;
  background: #fff3cd;
  color: #664d03;
  border-bottom: 1px solid #ffe69c;
  text-align: center;
  font-size: 0.9rem;
}

.demo-banner a {
  margin-left: 8px;
  color: #664d03;
  font-weight: 600;
}
</style>
