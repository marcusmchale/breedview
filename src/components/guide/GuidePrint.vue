<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { chapter as chapterOf, COLLECTIONS } from '@/guide/chapters'
import { MEDIA } from '@/guide/renderGuide'

// A collection of the guide's chapters on one page, to print or save as a PDF (guide/pdf.mjs): each chapter's text and
// steps, with its video's poster and a link to it where the video would be
const route = useRoute()
const name = computed(() => route.params.collection)
const collection = computed(() => COLLECTIONS[name.value] ?? null)
const chapters = computed(() => (collection.value?.chapters ?? []).map(chapterOf).filter(Boolean))
// the address the links name: this site's, or one given to print elsewhere (guide/pdf.mjs --site), if an origin
const ORIGIN = /^https?:\/\/[\w.-]+(:\d+)?$/
const site = ORIGIN.test(route.query.site ?? '') ? route.query.site : window.location.origin
watch(collection, (c) => { document.title = c ? `${c.title} - BreedView` : 'User guide - BreedView' }, { immediate: true })
</script>

<template>
  <div class="guide-print">
    <template v-if="collection">
      <header class="print-cover">
        <h1>{{ collection.title }}</h1>
        <p>From the BreedView user guide, at {{ site }}/guide, where each chapter has a video of its steps.</p>
        <ol>
          <li v-for="chapter in chapters" :key="chapter.slug">{{ chapter.title }}</li>
        </ol>
      </header>
      <article v-for="chapter in chapters" :key="chapter.slug" class="print-chapter">
        <h1>{{ chapter.title }}</h1>
        <template v-for="(block, i) in chapter.blocks" :key="`${chapter.slug}-${i}`">
          <!-- rendered by renderMarkdown, which escapes everything it is given -->
          <div v-if="block.type === 'html'" class="guide-text" v-html="block.html"></div>
          <figure v-else-if="block.type === 'video'" class="print-video">
            <img :src="`${MEDIA}${block.name}.jpg`" :alt="block.alt">
            <figcaption>Video: <a :href="`${site}/guide/${chapter.slug}`">{{ site }}/guide/{{ chapter.slug }}</a></figcaption>
          </figure>
          <section v-else-if="block.type === 'steps'" class="guide-text">
            <h2>Steps</h2>
            <ol>
              <li v-for="step in chapter.steps" :key="step.id">
                <strong>{{ step.lead }}</strong>
                <div v-html="step.html"></div>
              </li>
            </ol>
          </section>
        </template>
      </article>
    </template>
    <p v-else>The guide has no collection "{{ name }}". <router-link to="/guide">See its contents</router-link>.</p>
  </div>
</template>

<style>
@import '@/assets/styles/guide.css';
</style>

<style scoped>
.guide-print {
  max-width: 820px;
  margin: 0 auto;
  font-size: 11pt;
}

.print-cover {
  margin-bottom: 24px;
}

.print-chapter {
  break-before: page;
}

.print-video {
  margin: 12px 0;
  break-inside: avoid;
}

.print-video img {
  width: 100%;
  border: 1px solid #ddd;
}

.print-video figcaption {
  font-size: 0.9em;
  color: #555;
}

.guide-print :deep(.callout),
.guide-print :deep(li) {
  break-inside: avoid;
}

/* a heading stays with what follows it */
.guide-print h2,
.guide-print :deep(h2),
.guide-print :deep(h3) {
  break-after: avoid;
}
</style>
