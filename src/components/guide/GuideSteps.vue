<script setup>
// A chapter's steps: each one's lead and details. The step its video is playing is marked, and where there is a video,
// a step's button plays it from that step.
defineProps({
  steps: { type: Array, required: true },
  current: { type: String, default: null },
  playable: { type: Boolean, default: false }
})
defineEmits(['select'])
</script>

<template>
  <section class="guide-steps">
    <h2>Steps</h2>
    <ol>
      <li v-for="step in steps" :id="`step-${step.id}`" :key="step.id" :class="{ current: step.id === current }">
        <div class="step-lead">
          <strong>{{ step.lead }}</strong>
          <button v-if="playable" type="button" class="step-play" title="Play this step in the video" @click="$emit('select', step.id)">
            ▶ Play
          </button>
        </div>
        <!-- rendered by renderMarkdown, which escapes everything it is given -->
        <div class="step-details" v-html="step.html"></div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.guide-steps ol {
  padding-left: 22px;
}

.guide-steps li {
  margin: 10px 0;
  padding: 6px 10px;
  border-left: 3px solid transparent;
  border-radius: 4px;
}

.guide-steps li.current {
  border-left-color: var(--brand-accent-dark);
  background: var(--brand-accent-light);
}

.step-lead {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.step-play {
  border: 1px solid #90caf9;
  background: #fff;
  color: var(--brand-accent-darker);
  border-radius: 12px;
  padding: 1px 10px;
  font-size: 0.8rem;
  cursor: pointer;
}

.step-details :deep(p) {
  margin: 4px 0 0;
}
</style>
