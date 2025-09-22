<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { userLocation, preferredLocation } from '$lib/stores/preferredLocationStore.js';
    import { auth } from '$lib/stores/auth.js';
    import { createEventDispatcher } from 'svelte';
    import LocationMap from '$lib/components/LocationMap.svelte';
    import { PUBLIC_MAPS_API_KEY } from '$env/static/public';

    // --- FEATURED BADGE LOGIC ---
    // Accept posts as a prop (you may render some preview posts in this overlay)
    export let posts: any[] = [];

    export let show: boolean = false;

    const dispatch = createEventDispatcher();

    let isLoggedIn: boolean = false;
    let authToken: string | null = null;
    let mapLocation: { name: string; lat: number; lng: number; zoom: number; bounds?: google.maps.LatLngBoundsLiteral; locationType?: string } | null = null;
    let locationName: string = '';
    let errorMessage: string = '';
    let autocomplete: any = null;
    let autocompleteInputDiv: HTMLDivElement;

    let authSubscription: (() => void) | null = null;
    let locationSubscription: (() => void) | null = null;

    // Load Google Maps script
    function loadGoogleMapsScript() {
        if (!PUBLIC_MAPS_API_KEY) {
            console.error('LocationSetupOverlay: Missing Google Maps API key.');
            errorMessage = 'Missing Google Maps API key. Please check your .env file.';
            return;
        }
        if (document.querySelector(`script[src*="maps.googleapis.com"]`)) {
            console.log('LocationSetupOverlay: Google Maps script already present or loading.');
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${PUBLIC_MAPS_API_KEY}&map_ids=580e0a684bb3114dcf05f&libraries=places,marker&v=beta&callback=initMapGlobally&loading=async`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
            console.error('LocationSetupOverlay: Failed to load Google Maps script.');
            errorMessage = 'Failed to load mapping services. Please check your internet connection and API key.';
        };
        document.head.appendChild(script);
        console.log('LocationSetupOverlay: Initiating Google Maps API script load.');
    }

    onMount(() => {
        if (!browser) return;

        // Subscribe to auth store
        authSubscription = auth.subscribe(value => {
            isLoggedIn = value.isLoggedIn;
            authToken = value.token;
            console.log('LocationSetupOverlay: Auth updated, isLoggedIn:', isLoggedIn);
        });

        // Subscribe to userLocation store
        locationSubscription = userLocation.subscribe(value => {
            const preferred = value.preferredLocation;
            if (preferred && typeof preferred.lat === 'number' && typeof preferred.lng === 'number') {
                let zoomLevel = preferred.zoom || 7; // Default
                if (preferred.locationType === 'street') zoomLevel = 14;
                else if (preferred.locationType === 'county') zoomLevel = 8;
                else if (preferred.locationType === 'city') zoomLevel = 11;
                else if (preferred.locationType === 'country') zoomLevel = 4;

                mapLocation = {
                    name: preferred.name || 'Unknown Location',
                    lat: preferred.lat,
                    lng: preferred.lng,
                    zoom: zoomLevel,
                    // Don't include bounds for location setup - we want exact centering
                    locationType: preferred.locationType
                };
                locationName = preferred.name || '';
                console.log('LocationSetupOverlay: Initialized map with preferred location:', mapLocation);
            } else {
                // Fallback to global view
                mapLocation = { name: 'Global', lat: 0, lng: 0, zoom: 4 };
                locationName = '';
                console.log('LocationSetupOverlay: No valid preferred location, using global view:', mapLocation);
            }
        });

        // Load Google Maps script
        loadGoogleMapsScript();

        // Initialize autocomplete when Google Maps is ready
        if (browser) {
            const checkGoogle = setInterval(() => {
                if (window.google && window.google.maps && window.google.maps.places) {
                    clearInterval(checkGoogle);
                    initializeAutocomplete();
                }
            }, 50);
        }
    });

    onDestroy(() => {
        if (authSubscription) authSubscription();
        if (locationSubscription) locationSubscription();
        if (autocomplete) {
            if (autocomplete.parentNode) {
                autocomplete.parentNode.removeChild(autocomplete);
            }
            autocomplete = null;
        }
        console.log('LocationSetupOverlay: Cleaned up resources.');
    });

        // --- Featured Sorting and Badge ---
    $: now = Date.now();
    $: sortedPosts = [...posts].sort((a, b) => {
        const aFeatured = a.featuredInLocationUntil && a.featuredInLocationUntil > now;
        const bFeatured = b.featuredInLocationUntil && b.featuredInLocationUntil > now;
        if (aFeatured && !bFeatured) return -1;
        if (!aFeatured && bFeatured) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    async function initializeAutocomplete() {
        if (!autocompleteInputDiv) {
            console.error('LocationSetupOverlay: Autocomplete input container not found.');
            errorMessage = 'Autocomplete search box not found. This is an application error.';
            return;
        }
        if (autocomplete) {
            console.log('LocationSetupOverlay: Autocomplete already initialized, skipping.');
            return;
        }

        try {
            // Use the modern importLibrary approach for v=beta
            const placesLibrary = await google.maps.importLibrary('places') as any;
            const { PlaceAutocompleteElement } = placesLibrary;
            
            // Create new PlaceAutocompleteElement (modern beta API)
            autocomplete = new PlaceAutocompleteElement();
            
            // Set placeholder and styling
            autocomplete.setAttribute('placeholder', 'Search for a location');
            autocomplete.className = 'autocomplete-input';
            
            // Apply inline styles to match our theme
            autocomplete.style.width = '100%';
            autocomplete.style.padding = '15px';
            autocomplete.style.fontSize = '1em';
            autocomplete.style.border = 'none';
            autocomplete.style.outline = 'none';
            autocomplete.style.background = 'transparent';
            autocomplete.style.boxSizing = 'border-box';
            autocomplete.style.color = '#fff';
            autocomplete.style.fontFamily = 'inherit';
            
            autocompleteInputDiv.appendChild(autocomplete);

            // Use modern gmp-select event (replaces gmp-placeselect)
            autocomplete.addEventListener('gmp-select', async (event: any) => {
                try {
                    console.log('🎯 LocationSetupOverlay: Modern PlaceAutocompleteElement place selected!');
                    errorMessage = '';
                    
                    // Use modern API: event.placePrediction.toPlace()
                    const place = event.placePrediction.toPlace();

                    // Fetch required fields using modern API
                    await place.fetchFields({
                        fields: ['displayName', 'formattedAddress', 'location', 'types']
                    });

                    console.log('🎯 MODERN PLACE DATA RECEIVED:', place);

                    let lat: number | undefined;
                    let lng: number | undefined;

                    if (place.location) {
                        lat = place.location.lat();
                        lng = place.location.lng();
                        console.log('🎯 MODERN COORDINATES EXTRACTED:', { 
                            lat, 
                            lng, 
                            name: place.formattedAddress || place.displayName 
                        });
                    }

                    const types: string[] = place?.types || [];

                    if (lat == null || lng == null) {
                        console.warn('LocationSetupOverlay: No geometry/location for selected place; place:', place);
                        errorMessage = 'Please select a valid location from the suggestions.';
                        return;
                    }

                    const locationType = determineLocationType(types);
                    let zoomLevel = 7;
                    if (locationType === 'street') zoomLevel = 14;
                    else if (locationType === 'county') zoomLevel = 8;
                    else if (locationType === 'city') zoomLevel = 11;
                    else if (locationType === 'country') zoomLevel = 4;

                    mapLocation = {
                        name: place?.formattedAddress || place?.displayName || 'Unknown Location',
                        lat,
                        lng,
                        zoom: zoomLevel,
                        bounds: place?.viewport 
                            ? {
                                north: place.viewport.getNorthEast().lat(),
                                south: place.viewport.getSouthWest().lat(),
                                east: place.viewport.getNorthEast().lng(),
                                west: place.viewport.getSouthWest().lng()
                            }
                            : {
                                north: lat + 0.01,
                                south: lat - 0.01,
                                east: lng + 0.01,
                                west: lng - 0.01
                            },
                        locationType
                    };
                    locationName = mapLocation.name;
                    console.log('LocationSetupOverlay: Autocomplete updated location to:', mapLocation);
                } catch (e: any) {
                    console.error('LocationSetupOverlay: placeselect handler error:', e?.message || e);
                    errorMessage = 'Selection failed. Try another suggestion.';
                }
            });
            console.log('LocationSetupOverlay: Autocomplete initialized.');
        } catch (error: any) {
            console.error('LocationSetupOverlay: Failed to initialize Autocomplete:', error.message);
            errorMessage = 'Autocomplete search failed to load. Please try refreshing.';
        }
    }

    function determineLocationType(types: string[]) {
        if (types.includes('street_address') || types.includes('premise')) return 'street';
        if (types.includes('administrative_area_level_2')) return 'county';
        if (types.includes('locality')) return 'city';
        if (types.includes('country')) return 'country';
        return 'city'; // Default
    }

    async function saveLocation() {
        if (!mapLocation || typeof mapLocation.lat !== 'number' || typeof mapLocation.lng !== 'number') {
            errorMessage = 'No valid location selected. Please search for a location.';
            console.warn('LocationSetupOverlay: Save failed - Invalid location data:', mapLocation);
            return;
        }
        if (!isLoggedIn || !authToken) {
            errorMessage = 'You must be logged in to save your preferred location.';
            console.warn('LocationSetupOverlay: Save failed - User not logged in.');
            return;
        }

        try {
            const locationToSave = {
                name: locationName || mapLocation.name || 'Unknown Location',
                lat: mapLocation.lat,
                lng: mapLocation.lng,
                zoom: mapLocation.zoom || 15,
                bounds: mapLocation.bounds || {
                    north: mapLocation.lat + 0.01,
                    south: mapLocation.lat - 0.01,
                    east: mapLocation.lng + 0.01,
                    west: mapLocation.lng - 0.01
                },
                locationType: mapLocation.locationType
            };
            console.log('🚨 LOCATION SAVE DEBUG:');
            console.log('🔍 locationName variable:', locationName);
            console.log('🔍 mapLocation.name:', mapLocation.name);
            console.log('🔍 mapLocation object:', mapLocation);
            console.log('🔍 Final locationToSave:', locationToSave);

            await preferredLocation.setAndPersist(locationToSave);
            console.log('LocationSetupOverlay: Location saved to Svelte store and localStorage.');
            
            // Debug: Check what's actually in localStorage now
            const savedLocation = localStorage.getItem('preferredLocation');
            console.log('LocationSetupOverlay: localStorage now contains:', savedLocation);

            try {
                const response = await fetch('http://localhost:4000/api/users/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        preferredLocation: locationToSave,
                        location: locationToSave.name
                    })
                });

                if (response.ok) {
                    console.log('LocationSetupOverlay: Location successfully saved to backend.');
                    errorMessage = '';
                    
                    // Force a small delay to ensure all stores are updated before closing
                    setTimeout(() => {
                        console.log('LocationSetupOverlay: Dispatching close after successful save with newLocation:', locationToSave);
                        dispatch('close', { newLocation: locationToSave });
                    }, 250);
                } else {
                    const errorData = await response.json();
                    const msg = errorData.message || response.statusText;
                    console.error('LocationSetupOverlay: Failed to save location to backend:', msg);
                    errorMessage = `Failed to save location to backend: ${msg}`;
                }
            } catch (error: any) {
                console.error('LocationSetupOverlay: Network error saving location to backend:', error.message);
                errorMessage = `Network error: Could not save location to backend. ${error.message}`;
            }
        } catch (error: any) {
            console.error('LocationSetupOverlay: An unexpected error occurred:', error.message);
            errorMessage = `An unexpected error occurred: ${error.message}`;
        }
    }
</script>

{#if show}
    <div class="overlay" on:click={() => dispatch('close')}>
        <div class="location-setup-container" on:click|stopPropagation>
            <header>
                <p>{locationName || 'Searching for location...'}</p>
                <button class="close-button" on:click={() => dispatch('close')} title="Close">×</button>
            </header>
            {#if errorMessage}
                <div class="error-message">{errorMessage}</div>
            {/if}
            <div class="location-input-container">
                <div bind:this={autocompleteInputDiv} class="autocomplete-input-container"></div>
                <button on:click={saveLocation} class="save-button" disabled={!mapLocation || !isLoggedIn}>
                    Set Location
                </button>
            </div>
            <div class="map-container">
                {#if mapLocation}
                    <LocationMap
                        location={mapLocation}
                    />
                {:else}
                    <div class="map-placeholder">Loading map...</div>
                {/if}
            </div>
            <!-- FEATURED POSTS PREVIEW BLOCK -->
            {#if sortedPosts.length > 0}
                <div class="featured-preview-list">
                    <h4>Top Featured Posts Here</h4>
                    {#each sortedPosts as post (post.id)}
                        <div class="feat-preview-row">
                            <div class="feat-title">{post.headline || post.content}</div>
                            {#if post.featuredInLocationUntil && post.featuredInLocationUntil > now}
                                <span class="badge-featured">FEATURED</span>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(3px);
        border-radius: 16px;
    }

    .location-setup-container {
        background: #000;
        border-radius: 16px;
        width: 90%;
        max-width: 600px;
        height: 85%;
        display: flex;
        flex-direction: column;
        overflow: visible;
        box-shadow: 0 4px 30px rgba(0, 234, 255, 0.3);
        border: 2px solid #00eaff;
        margin-top: 15px;
    }

    header {
        text-align: center;
        padding: 12px 0 15px 0;
        background: #111;
        border-bottom: 2px solid #333;
        color: #00eaff;
        border-radius: 16px;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .close-button {
        position: absolute;
        top: 5px;
        right: 15px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #999;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .close-button:hover {
        color: #00eaff;
    }

    header p {
        margin: 0;
        font-size: 1.8em;
        color: #00eaff;
        font-weight: 700;
        font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    }

    .location-input-container {
        padding: 15px 0 0 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 1001;
        background: #000;
        border-bottom: 2px solid #333;
        border-radius: 16px;
        align-items: stretch;  /* Center children horizontally */
        width: 100%;
        overflow: visible;
        position: relative;
        margin-top: -0.5rem;
    }

    .autocomplete-input-container {
        border: 2px solid #333;
        box-shadow: 0 0 0 0 rgba(0, 234, 255, 0);
        width: 100%;
        box-sizing: border-box;
        transition: all 0.3s ease;
        padding: 0;
        background: #111;
        overflow: visible;
        margin-top: -1rem;
        position: relative;
        z-index: 10000;
    }

    .autocomplete-input {
        width: 100%;
        padding: 8px 12px;
        font-size: 0.9em;
        border: none;
        outline: none;
        background: transparent;
        box-sizing: border-box;
        color: #a7ddeb;
    }

    .autocomplete-input::placeholder {
        color: #fdfdfd;
    }

    /* Style Google Maps autocomplete dropdown */
    :global(.pac-container) {
        background: #111 !important;
        border: 2px solid #333 !important;
        border-radius: 16px !important;
        margin-top: 2px !important;
        z-index: 9999 !important;
    }

    :global(.pac-item) {
        background: #111 !important;
        color: #00eaff !important;
        border-bottom: 1px solid #333 !important;
        padding: 10px !important;
    }

    :global(.pac-item:hover) {
        background: #222 !important;
        color: #ffffff !important;
    }

    :global(.pac-item-selected) {
        background: #00eaff !important;
        color: #000 !important;
    }

    :global(.pac-matched) {
        color: #ffffff !important;
        font-weight: bold !important;
    }

    :global(.pac-item-selected .pac-matched) {
        color: #000 !important;
    }

    .save-button {
        width: 100%;
        padding: 8px 16px;
        font-size: 1em;
        border: 2px solid #00eaff;
        cursor: pointer;
        transition: all 0.3s ease;
        background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
        color: #000;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 5px;
        margin-top: -0.8rem;
        margin-bottom: -0.3rem;
        margin-left: 0;
    }

    .save-button:hover:not(:disabled) {
        transform: translateY(2px);
        box-shadow: 0 8px 25px rgba(0, 234, 255, 0.4);
    }

    .save-button:disabled {
        background: #333;
        color: #666;
        cursor: not-allowed;
        border-color: #333;
        transform: none;
        box-shadow: none;
    }

    .map-container {
        flex: 1;
        width: 100%;
        min-height: 250px;
        background-color: #111;
        border-top: 2px solid #333;
    }

    .map-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #00eaff;
        font-size: 1.2em;
        font-weight: 600;
    }

    .featured-preview-list {
        margin: 1.5em 0 0 0;
        padding: 1.2em 1em 0.5em 1em;
        background: #111;
        border-radius: 8px;
        border: 2px solid #333;
        transition: border-color 0.3s ease;
    }

    .featured-preview-list:hover {
        border-color: #00eaff;
    }

    .featured-preview-list h4 {
        font-size: 1.15em;
        color: #00eaff;
        margin-bottom: 0.7em;
        font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
        font-weight: 700;
    }
    .feat-preview-row {
        display: flex;
        align-items: center;
        gap: 0.7em;
        margin-bottom: 0.7em;
        font-size: 1.03em;
        color: #ccc;
    }
    .feat-title {
        flex: 1 1 auto;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 500;
    }
    .badge-featured {
        background: #00eaff;
        color: #000;
        font-weight: 700;
        border-radius: 0.8em;
        padding: 0.14em 0.7em;
        font-size: 0.91em;
        margin-left: 0.5em;
    }

    .error-message {
        background-color: #ff1744;
        color: #fff;
        padding: 15px;
        border-radius: 8px;
        text-align: center;
        margin: 10px 15px;
        border: 2px solid #ff1744;
        font-weight: 600;
    }

    @media (max-width: 768px) {
        .location-setup-container {
            width: 95%;
            height: 90%;
        }
        .location-input-container {
            padding: 20px;
        }
        .save-button {
            font-size: 1em;
            padding: 12px 20px;
        }
    }
</style>