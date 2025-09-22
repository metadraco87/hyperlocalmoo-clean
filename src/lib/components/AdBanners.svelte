<script lang="ts">
    export let side: 'left' | 'right' = 'left';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    
    // Ad tier configuration - made slightly wider (10% increase from 160px to 176px)
    const adTiers = [
        { id: 'tier1', width: 176, height: 600, type: 'tall' },
        { id: 'tier2', width: 176, height: 400, type: 'medium' }
    ];
    
    // Function to load AdSense ads
    function loadAds() {
        if (browser && typeof window.adsbygoogle !== 'undefined') {
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
                (window.adsbygoogle = window.adsbygoogle || []).push({});
                (window.adsbygoogle = window.adsbygoogle || []).push({});
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.error('AdSense error:', e);
            }
        }
    }
    
    onMount(() => {
        // Initialize AdSense after component is mounted
        loadAds();
    });
</script>

<div class="ads-column" class:left={side === 'left'} class:right={side === 'right'}>
    <div class="ads-container">
        {#if side === 'left'}
            <!-- Banner 1 (Left Side) -->
            <div class="google-ad tall-ad" style="width: {adTiers[0].width}px; height: {adTiers[0].height}px;">
                <ins class="adsbygoogle"
                     style="display:block"
                     data-ad-client="ca-pub-3914949226055822"
                     data-ad-slot="3482054516"
                     data-ad-format="auto"
                     data-full-width-responsive="true"></ins>
            </div>
            
            <!-- Banner 2 (Left Side) -->
            <div class="google-ad medium-ad" style="width: {adTiers[1].width}px; height: {adTiers[1].height}px;">
                <ins class="adsbygoogle"
                     style="display:block"
                     data-ad-client="ca-pub-3914949226055822"
                     data-ad-slot="5794702213"
                     data-ad-format="auto"
                     data-full-width-responsive="true"></ins>
            </div>
        {:else}
            <!-- Banner 3 (Right Side) -->
            <div class="google-ad tall-ad" style="width: {adTiers[0].width}px; height: {adTiers[0].height}px;">
                <ins class="adsbygoogle"
                     style="display:block"
                     data-ad-client="ca-pub-3914949226055822"
                     data-ad-slot="4235903283"
                     data-ad-format="auto"
                     data-full-width-responsive="true"></ins>
            </div>
            
            <!-- Banner 4 (Right Side) -->
            <div class="google-ad medium-ad" style="width: {adTiers[1].width}px; height: {adTiers[1].height}px;">
                <ins class="adsbygoogle"
                     style="display:block"
                     data-ad-client="ca-pub-3914949226055822"
                     data-ad-slot="6723736220"
                     data-ad-format="auto"
                     data-full-width-responsive="true"></ins>
            </div>
        {/if}
    </div>
</div>

<style>
    .ads-column {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 176px;
        max-width: 176px;
        background: #f2f2f2;
        position: sticky;
        top: 60px; /* Account for header height */
        height: calc(100vh - 60px);
        overflow: hidden;
    }
    
    .ads-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px 0;
        overflow: hidden; /* Remove scrollability */
    }
    
    .google-ad {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f2f2f2;
        margin: 5px 0;
        padding: 10px;
        box-sizing: border-box;
        transition: background-color 0.2s ease;
    }
    
    .google-ad:hover {
        background: #eaeaea;
    }
    
    .tall-ad {
        min-height: 600px;
    }
    
    .medium-ad {
        min-height: 400px;
    }
    
    /* Responsive adjustments */
    @media (max-width: 1600px) {
        .ads-column {
            min-width: 160px;
            max-width: 160px;
        }
        
        .google-ad {
            width: 160px !important;
        }
        
        .adsbygoogle {
            width: calc(160px - 20px) !important;
        }
    }
</style>
