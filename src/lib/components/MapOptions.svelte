<script>
    import { createEventDispatcher } from 'svelte';

    export let mapType = 'roadmap';
    const dispatch = createEventDispatcher();
</script>

<div class="map-options">
    <select bind:value={mapType} on:change={() => dispatch('change', mapType)}>
        <option value="roadmap">Map</option>
        <option value="satellite">Satellite</option>
        <option value="dark">Dark Map</option>
    </select>
</div>

<style>
    .map-options {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2;
        pointer-events: auto;
    }

    select {
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 5px;
        background: rgba(255, 255, 255, 0.95);
        font-size: 0.9em;
        cursor: pointer;
    }
</style>