<script setup>
// The guide site's shell: its name, where to try BreedGraph, the projects' repositories, and the guide's pages
const DEMO = import.meta.env.VITE_GUIDE_DEMO_URL || null
const REPOSITORIES = [
  ['BreedView', 'https://github.com/marcusmchale/breedview'],
  ['BreedGraph', 'https://github.com/marcusmchale/breedgraph']
]
</script>

<template>
  <div id="guide-site">
    <nav class="navbar">
      <div class="nav-container">
        <div class="nav-brand">
          <router-link to="/guide" class="brand-link">
            BreedView
            <span class="brand-note">the user guide</span>
          </router-link>
        </div>
        <div class="nav-menu">
          <a v-if="DEMO" :href="DEMO" class="nav-link">Try the demonstration site</a>
          <a v-for="[name, href] in REPOSITORIES" :key="name" :href="href" class="nav-link">{{ name }} on GitHub</a>
        </div>
      </div>
    </nav>

    <main class="main-content">
      <router-view />
    </main>

    <footer class="app-footer">
      <p class="footer-projects">
        <a href="https://github.com/marcusmchale/breedview">BreedView</a>, an app for
        <a href="https://github.com/marcusmchale/breedgraph">BreedGraph</a>. The guide's people, places and trials are
        fictional.
      </p>
    </footer>
  </div>
</template>

<style>
@import '../assets/styles/navigation.css';

#guide-site {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

#guide-site .main-content {
  flex: 1;
  padding: 2rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

#guide-site .app-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid #eee;
  text-align: center;
  font-size: 0.85rem;
  color: var(--brand-footer-text);
}

#guide-site .app-footer a {
  color: var(--brand-footer-text);
}
</style>
