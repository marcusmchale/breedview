<!-- How a team is credited (Team.attribution), for the team forms: public, and inherited by the teams below it -->
<script setup>
defineProps({
  // the attribution the team takes when it sets none: its parent's own or inherited one
  inherited: { type: String, default: null },
  disabled: { type: Boolean, default: false }
})
const attribution = defineModel({ type: String, default: '' })
</script>

<template>
  <div class="form-group attribution-field">
    <label>Attribution (optional):</label>
    <input
      v-model="attribution"
      type="text"
      :placeholder="inherited ? `${inherited} (from the team above)` : 'e.g. Wheat Breeding Group, Example Institute'"
      :disabled="disabled"
    />
    <p class="hint">
      How to credit your team, shown with what it releases, to anyone. Teams below it use it unless they set their own.
      It is public: don't name people without their agreement.
    </p>
  </div>
</template>

<style scoped>
.hint {
  margin: 4px 0 0;
  font-size: 0.85em;
  color: #6c757d;
}
</style>
