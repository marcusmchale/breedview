<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { MEDIA } from '@/guide/renderGuide'

// A chapter's video (public/guide-media/<name>.mp4, recorded by guide/record.mjs) with its steps as a hidden WebVTT
// track, each cue's id its step's: the bar under the video shows the lead of the step playing, and seek(id) plays a
// step from its start. Where the video is not there, as in a checkout without the guide's media, it says so.
const props = defineProps({
  name: { type: String, required: true },
  alt: { type: String, default: '' },
  steps: { type: Array, default: () => [] }
})
const emit = defineEmits(['step'])

const video = ref(null)
const current = ref(null)
const missing = ref(false)
const leads = computed(() => Object.fromEntries(props.steps.map((step) => [step.id, step.lead])))
const caption = computed(() => (current.value ? leads.value[current.value] : props.alt))

let track = null
const onCueChange = () => {
  const cue = track?.activeCues?.[0]
  if (cue?.id && cue.id !== current.value) {
    current.value = cue.id
    emit('step', cue.id)
  }
}
// the captions are the bar's: the track is hidden, which still loads its cues and tells of each
const attachTrack = () => {
  if (track || !video.value?.textTracks?.length) return
  track = video.value.textTracks[0]
  track.mode = 'hidden'
  track.addEventListener('cuechange', onCueChange)
}
onBeforeUnmount(() => track?.removeEventListener('cuechange', onCueChange))

const seek = (id) => {
  const cue = [...(track?.cues ?? [])].find((c) => c.id === id)
  if (!cue || !video.value) return
  // the steps are below the video: bring it into view
  video.value.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  video.value.currentTime = cue.startTime + 0.01
  video.value.play().catch(() => {})
}
defineExpose({ seek })
</script>

<template>
  <figure class="guide-video">
    <div v-if="missing" class="missing">The video of this chapter is not available here yet.</div>
    <template v-else>
      <video
        ref="video"
        controls
        preload="metadata"
        playsinline
        :poster="`${MEDIA}${name}.jpg`"
        :aria-label="alt"
        @loadedmetadata="attachTrack"
      >
        <source :src="`${MEDIA}${name}.mp4`" type="video/mp4" @error="missing = true">
        <track kind="captions" srclang="en" label="Steps" :src="`${MEDIA}${name}.vtt`" @load="attachTrack">
      </video>
      <figcaption class="caption-bar" aria-live="polite">{{ caption }}</figcaption>
    </template>
  </figure>
</template>

<style scoped>
.guide-video {
  margin: 20px 0;
}

video {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: #111;
  border-radius: 6px 6px 0 0;
}

.caption-bar {
  min-height: 2.6em;
  padding: 10px 14px;
  background: #263238;
  color: #fff;
  font-size: 1.05rem;
  border-radius: 0 0 6px 6px;
}

.missing {
  padding: 40px;
  text-align: center;
  color: #666;
  background: #f5f5f5;
  border-radius: 6px;
}
</style>
