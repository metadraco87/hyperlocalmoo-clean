<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let selectedMood: number;
  export let bigEmojis = false;
  export let readonly = false;
  // FIX: The `initialMood` prop and `onMount` hook have been removed
  // to avoid a conflict with `bind:value` and allow the mood to update.

  // Mood bar gradient and emoji definitions from original design
  const moodEmojis = [
    '💢', // 0 - Violent
    '😡', // 1 - Furious
    '😠', // 2 - Angry
    '😤', // 3 - Annoyed
    '😢', // 4 - Crying
    '☹️', // 5 - Sad
    '😐', // 6 - Neutral
    '🙂', // 7 - Smile
    '�', // 8 - Cool
    '😄', // 9 - Happy
    '😂', // 10 - Laugh Cry
    '😍', // 11 - Heart Eyes
    '🤩', // 12 - Star Eyes
  ];

  // The emoji is a reactive derivation of the selectedMood.
  $: currentEmoji = moodEmojis[Math.round(selectedMood)] || '😐';

  // Position the emoji over the slider thumb.
  $: emojiPosition = `calc(${(selectedMood / (moodEmojis.length - 1)) * 100}% - 1.25rem)`;

  function handleMoodChange(event: Event) {
    // This is the fix. We are now dispatching 'newMood' to match the parent component's expectation.
    // We can also extract the value from the event target to be more explicit.
    const newMood = Number((event.target as HTMLInputElement).value);
    dispatch('moodChange', { newMood });
  }
</script>

<div class="mood-bar-container" class:readonly>
  <div class="emoji-wrapper">
    <span
      class="floating-emoji"
      style="left: {emojiPosition}; font-size: {bigEmojis ? '3.5rem' : '2rem'};"
    >
      {currentEmoji}
    </span>
  </div>
  <input
    type="range"
    min="0"
    max={moodEmojis.length - 1}
    step="1"
    bind:value={selectedMood}
    on:change={handleMoodChange}
    disabled={readonly}
    class="gradient-slider"
  />
</div>

<style>
  .mood-bar-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 420px;
    margin: 1.5rem auto;
  }

  .emoji-wrapper {
    position: relative;
    width: 100%;
    height: 3.5rem; /* Space for the emoji to float */
  }

  .floating-emoji {
    position: absolute;
    bottom: -0.5rem; /* Adjust based on emoji size */
    transform: translateX(-50%);
    transition: left 0.18s cubic-bezier(.45,1.5,.8,1.01), font-size 0.13s;
    pointer-events: none;
    /* iOS emoji look enhancement */
    text-shadow: 0 2px 8px #fff, 0 1px 0 #fff;
    filter: drop-shadow(0 3px 18px #fff);
  }

  input.gradient-slider {
    -webkit-appearance: none;
    width: 100%;
    height: 18px;
    background: linear-gradient(
      to right,
      #7c3aed 0%,
      #fbbf24 25%,
      #fde047 50%,
      #a3e635 75%,
      #38bdf8 100%
    ); /* Restored original mood gradient */
    border-radius: 12px;
    outline: none;
    margin: 0.5rem 0;
    box-shadow: 0 2px 12px #8882;
  }

  input.gradient-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 32px;
    height: 32px;
    background: #fff;
    border: 2px solid #7c3aed;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    transition: border-color 0.2s;
  }

  input.gradient-slider:focus::-webkit-slider-thumb {
    border-color: #fbbf24;
  }

  input.gradient-slider::-moz-range-thumb {
    width: 32px;
    height: 32px;
    background: #fff;
    border: 2px solid #7c3aed;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    transition: border-color 0.2s;
  }

  input.gradient-slider:focus::-moz-range-thumb {
    border-color: #fbbf24;
  }

  input.gradient-slider::-ms-thumb {
    width: 32px;
    height: 32px;
    background: #fff;
    border: 2px solid #7c3aed;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    transition: border-color 0.2s;
  }

  input.gradient-slider::-ms-fill-lower {
    background: transparent;
  }
  input.gradient-slider::-ms-fill-upper {
    background: transparent;
  }

  .mood-bar-container.readonly input.gradient-slider {
    cursor: default;
    background: #e5e7eb;
  }

  .mood-bar-container.readonly input.gradient-slider::-webkit-slider-thumb,
  .mood-bar-container.readonly input.gradient-slider::-moz-range-thumb,
  .mood-bar-container.readonly input.gradient-slider::-ms-thumb {
    cursor: default;
    background: #9ca3af;
    border-color: #9ca3af;
  }
</style>