<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { chapter as chapterOf, contents, readingOrder } from '@/guide/chapters'
import GuideVideo from './GuideVideo.vue'
import GuideSteps from './GuideSteps.vue'

// The user guide: its contents at /guide, and a chapter at /guide/<slug> with its video and steps. Open to everyone,
// before the Terms of Use too, as it shows no data.
const route = useRoute()
const slug = computed(() => route.params.chapter || null)
const page = computed(() => (slug.value ? chapterOf(slug.value) : null))
const parts = computed(contents)

const order = computed(readingOrder)
const position = computed(() => order.value.findIndex((chapter) => chapter.slug === slug.value))
const previous = computed(() => (position.value > 0 ? order.value[position.value - 1] : null))
const next = computed(() => (position.value >= 0 ? order.value[position.value + 1] ?? null : null))

const player = ref(null)
const currentStep = ref(null)
const hasVideo = computed(() => !!page.value?.blocks.some((block) => block.type === 'video'))
watch(slug, () => { currentStep.value = null })
watch(page, (chapter) => {
  document.title = chapter ? `${chapter.title} - BreedView user guide` : 'User guide - BreedView'
}, { immediate: true })
</script>

<template>
  <div class="page-container guide-page">
    <nav class="guide-breadcrumbs">
      <router-link to="/guide">User guide</router-link>
      <template v-if="page"> › {{ page.title }}</template>
    </nav>

    <template v-if="!slug">
      <h1>User guide</h1>
      <p class="guide-intro">
        How to use BreedGraph through BreedView, a chapter at a time, each with a short video of the steps. The videos
        use the demonstration database: fictional winter wheat trials in Ireland, whose people and places are invented.
      </p>
      <section v-for="part in parts" :key="part.title" class="guide-part">
        <h2>{{ part.title }}</h2>
        <ul class="chapter-list">
          <li v-for="chapter in part.chapters" :key="chapter.slug">
            <router-link :to="`/guide/${chapter.slug}`">{{ chapter.title }}</router-link>
            <!-- rendered by renderMarkdown, which escapes everything it is given -->
            <p v-html="chapter.summary"></p>
          </li>
        </ul>
      </section>
    </template>

    <template v-else-if="page">
      <h1>{{ page.title }}</h1>
      <template v-for="(block, i) in page.blocks" :key="`${slug}-${i}`">
        <!-- rendered by renderMarkdown, which escapes everything it is given -->
        <div v-if="block.type === 'html'" class="guide-text" v-html="block.html"></div>
        <GuideVideo
          v-else-if="block.type === 'video'"
          :ref="(component) => { player = component }"
          :name="block.name"
          :alt="block.alt"
          :steps="page.steps"
          @step="currentStep = $event"
        />
        <GuideSteps
          v-else-if="block.type === 'steps'"
          :steps="page.steps"
          :current="currentStep"
          :playable="hasVideo"
          @select="(id) => player?.seek(id)"
        />
      </template>
      <nav class="chapter-nav">
        <router-link v-if="previous" :to="`/guide/${previous.slug}`">← {{ previous.title }}</router-link>
        <span v-else></span>
        <router-link v-if="next" :to="`/guide/${next.slug}`">{{ next.title }} →</router-link>
      </nav>
    </template>

    <p v-else>
      The guide has no chapter "{{ slug }}". <router-link to="/guide">See its contents</router-link>.
    </p>
  </div>
</template>

<style>
@import '@/assets/styles/guide.css';
</style>

<style scoped>
.guide-page {
  max-width: 860px;
  margin: 0 auto;
}

.guide-breadcrumbs {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 12px;
}

.guide-intro {
  color: #444;
  line-height: 1.6;
}

.chapter-list {
  list-style: none;
  padding: 0;
}

.chapter-list li {
  margin: 10px 0 16px;
}

.chapter-list a {
  font-weight: 600;
  font-size: 1.05rem;
}

.chapter-list p {
  margin: 4px 0 0;
  color: #555;
}

.chapter-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 32px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}
</style>
