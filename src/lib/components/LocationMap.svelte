<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { get, writable } from 'svelte/store';
    import { browser } from '$app/environment';
    import { page } from '$app/stores';
    import { preferredLocation } from '$lib/stores/preferredLocationStore.js';

    // Props
    export let location: { lat: number; lng: number; zoom: number; bounds?: { north: number; south: number; east: number; west: number }; locationType?: string };
    export let posts: any[] = [];
    export let mapMode: boolean = false;
    export let mapPinLocation: { lat: number; lng: number } | null = null;
    export let mapType: string = 'roadmap';
    export let highlightedPostId: string | null = null;

    // Internal state
    let mapDiv: HTMLDivElement;
    let map: google.maps.Map | undefined;
    let markers: google.maps.Marker[] = [];
    let infoWindow: google.maps.InfoWindow | null = null;
    let google: any;
    let currentMapBounds: { north: number; south: number; east: number; west: number } | null = null;
    let mapPinMarker: google.maps.Marker | null = null;
    const _mapCenterAndZoom = writable({ lat: 0, lng: 0, zoom: 0, initialized: false });
    let lastPostsHash = '';
    let mapPinLocationName: string = 'Loading location...';
    let restrictBounds: boolean = false; // From Gemini: restrict map panning based on locationType

    // Dark mode styles for Google Maps
    const darkMapStyle: any[] = [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        {
            featureType: "administrative.locality",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
        },
        {
            featureType: "poi",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
        },
        {
            featureType: "poi.park",
            elementType: "geometry",
            stylers: [{ color: "#263c3f" }],
        },
        {
            featureType: "poi.park",
            elementType: "labels.text.fill",
            stylers: [{ color: "#6b9a76" }],
        },
        {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#38414e" }],
        },
        {
            featureType: "road",
            elementType: "geometry.stroke",
            stylers: [{ color: "#212a37" }],
        },
        {
            featureType: "road",
            elementType: "labels.text.fill",
            stylers: [{ color: "#9ca5b3" }],
        },
        {
            featureType: "road.highway",
            elementType: "geometry",
            stylers: [{ color: "#746855" }],
        },
        {
            featureType: "road.highway",
            elementType: "geometry.stroke",
            stylers: [{ color: "#1f2835" }],
        },
        {
            featureType: "road.highway",
            elementType: "labels.text.fill",
            stylers: [{ color: "#f3d19c" }],
        },
        {
            featureType: "transit",
            elementType: "geometry",
            stylers: [{ color: "#2f3948" }],
        },
        {
            featureType: "transit.station",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
        },
        {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#17263c" }],
        },
        {
            featureType: "water",
            elementType: "labels.text.fill",
            stylers: [{ color: "#515c6d" }],
        },
        {
            featureType: "water",
            elementType: "labels.text.stroke",
            stylers: [{ color: "#17263c" }],
        },
    ];

    // Event dispatcher
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    // Derive initial state from URL or props
    $: {
        const urlParams = $page.url.searchParams;
        const lat = parseFloat(urlParams.get('lat') || location.lat.toString() || '40.7128');
        const lng = parseFloat(urlParams.get('lng') || location.lng.toString() || '-74.0060');
        const zoom = parseInt(urlParams.get('zoom') || location.zoom.toString() || '10', 10);
        const locationType = urlParams.get('locationType') || location.locationType || 'city';
        mapMode = urlParams.get('mapMode') === 'true' || mapMode;
        highlightedPostId = urlParams.get('highlightedPostId') || highlightedPostId;
        location = { lat, lng, zoom, locationType };
        console.log('LocationMap: Updated from URL/props:', { location, mapMode, highlightedPostId });
    }

    // Update URL on map changes
    function navigateToLocation(newLat: number, newLng: number, newZoom: number, newHighlightedPostId: string | null = null, newMapMode: boolean = mapMode) {
        const url = new URL($page.url);
        url.searchParams.set('lat', newLat.toFixed(6));
        url.searchParams.set('lng', newLng.toFixed(6));
        url.searchParams.set('zoom', newZoom.toString());
        url.searchParams.set('mapMode', newMapMode.toString());
        if (newHighlightedPostId) {
            url.searchParams.set('highlightedPostId', newHighlightedPostId);
        } else {
            url.searchParams.delete('highlightedPostId');
        }
        history.pushState({}, '', url.toString());
    }

    onMount(async () => {
        if (!browser) return;

        await new Promise<void>(resolve => {
            const checkGoogle = setInterval(() => {
                if (window.google && window.google.maps) {
                    clearInterval(checkGoogle);
                    google = window.google;
                    console.log('LocationMap: Google Maps API loaded.');
                    initializeMap();
                    resolve();
                }
            }, 50);
        });
    });

    onDestroy(() => {
        if (infoWindow) infoWindow.close();
        if (map) google.maps.event.clearInstanceListeners(map);
        markers.forEach(marker => {
            google.maps.event.clearInstanceListeners(marker);
            marker.setMap(null);
        });
        if (mapPinMarker) mapPinMarker.setMap(null);
        console.log('LocationMap: Unmounted, cleaned up resources.');
    });

    function initializeMap() {
        if (!google || !mapDiv || map) return;

        const { bounds, effectiveZoom } = calculateDefaultBounds();
        currentMapBounds = bounds;
        restrictBounds = !!location.locationType; // Enable bounds restriction for defined location types

        // Determine initial map type and styles
        let initialMapTypeId = 'roadmap';
        let initialStyles: any[] = [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }
        ];

        if (mapType === 'satellite') {
            initialMapTypeId = 'satellite';
            initialStyles = [];
        } else if (mapType === 'dark') {
            initialMapTypeId = 'roadmap';
            initialStyles = darkMapStyle;
        }

        map = new google.maps.Map(mapDiv, {
            center: { lat: location.lat, lng: location.lng },
            zoom: effectiveZoom,
            mapTypeId: initialMapTypeId,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: false,
            keyboardShortcuts: false,
            gestureHandling: 'greedy',
            minZoom: restrictBounds ? Math.max(effectiveZoom - 2, 3) : 3,
            maxZoom: 21,
            restriction: restrictBounds ? { latLngBounds: bounds, strictBounds: true } : null,
            styles: initialStyles
        });

        _mapCenterAndZoom.set({ lat: location.lat, lng: location.lng, zoom: effectiveZoom, initialized: true });
        infoWindow = new google.maps.InfoWindow();

        map.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (!e.latLng || !map) return;
            const currentZoom = map.getZoom() || 10;
            const latLng = { lat: e.latLng.lat(), lng: e.latLng.lng() };

            if (mapMode && currentZoom >= 15 && currentZoom <= 21) {
                mapPinLocation = latLng;
                navigateToLocation(latLng.lat, latLng.lng, currentZoom, null, true);
                dispatch('mapClick', { latLng, zoom: currentZoom });
            } else if (!mapMode && highlightedPostId) {
                navigateToLocation(location.lat, location.lng, currentZoom, null);
            }
        });

        if (restrictBounds) {
            map.addListener('dragend', () => {
                if (!map || !currentMapBounds) return;
                const center = map.getCenter();
                if (center) {
                    let adjustedLat = center.lat();
                    let adjustedLng = center.lng();
                    if (adjustedLat > currentMapBounds.north) adjustedLat = currentMapBounds.north;
                    if (adjustedLat < currentMapBounds.south) adjustedLat = currentMapBounds.south;
                    if (adjustedLng > currentMapBounds.east) adjustedLng = currentMapBounds.east;
                    if (adjustedLng < currentMapBounds.west) adjustedLng = currentMapBounds.west;
                    if (adjustedLat !== center.lat() || adjustedLng !== center.lng()) {
                        map.panTo({ lat: adjustedLat, lng: adjustedLng });
                    }
                }
            });
        }

        map.addListener('zoom_changed', () => {
            if (!map) return;
            const currentZoom = map.getZoom() || 10;
            if (mapMode && (currentZoom < 15 || currentZoom > 21)) {
                mapPinLocation = null;
                if (mapPinMarker) {
                    mapPinMarker.setMap(null);
                    mapPinMarker = null;
                }
                if (infoWindow) infoWindow.close();
                navigateToLocation(location.lat, location.lng, currentZoom, null, false);
            }
            if (!mapMode && highlightedPostId && currentZoom <= 16) {
                navigateToLocation(location.lat, location.lng, currentZoom, null);
            }
        });

        let idleTimeout: ReturnType<typeof setTimeout>;
        map.addListener('idle', () => {
            if (!map) return;
            clearTimeout(idleTimeout);
            idleTimeout = setTimeout(() => {
                const center = map.getCenter();
                const zoom = map.getZoom();
                if (center && zoom !== undefined) {
                    const currentMapState = get(_mapCenterAndZoom);
                    if (!restrictBounds || (currentMapBounds && center.lat() <= currentMapBounds.north && center.lat() >= currentMapBounds.south && center.lng() <= currentMapBounds.east && center.lng() >= currentMapBounds.west)) {
                        if (!currentMapState.initialized || Math.abs(currentMapState.lat - center.lat()) > 0.0001 || Math.abs(currentMapState.lng - center.lng()) > 0.0001 || currentMapState.zoom !== zoom) {
                            _mapCenterAndZoom.set({ lat: center.lat(), lng: center.lng(), zoom, initialized: true });
                            dispatch('moveend', { center: { lat: center.lat(), lng: center.lng() }, zoom });
                        }
                    }
                }
            }, 500);
        });

        updateMarkers();
    }

    function calculateDefaultBounds() {
        let boundsSize = 1.0;
        let defaultZoom = 10;

        if (location.locationType === 'street') {
            boundsSize = 0.005;
            defaultZoom = 15;
        } else if (location.locationType === 'county') {
            boundsSize = 0.3;
            defaultZoom = 10;
        } else if (location.locationType === 'city') {
            boundsSize = 1.0;
            defaultZoom = 10;
        } else if (location.locationType === 'country') {
            boundsSize = 5.0;
            defaultZoom = 6;
        }

        const effectiveZoom = location.zoom || defaultZoom;
        const bounds = {
            north: location.lat + boundsSize,
            south: location.lat - boundsSize,
            east: location.lng + boundsSize,
            west: location.lng - boundsSize
        };

        return { bounds, effectiveZoom };
    }

    $: if (map && location.lat && location.lng && location.zoom) {
        const currentMapState = get(_mapCenterAndZoom);
        const { bounds, effectiveZoom } = calculateDefaultBounds();
        currentMapBounds = bounds;

        if (!currentMapState.initialized || Math.abs(currentMapState.lat - location.lat) > 0.0001 || Math.abs(currentMapState.lng - location.lng) > 0.0001 || currentMapState.zoom !== effectiveZoom) {
            map.setOptions({ restriction: null });
            map.panTo({ lat: location.lat, lng: location.lng });
            map.setZoom(effectiveZoom);
            _mapCenterAndZoom.set({ lat: location.lat, lng: location.lng, zoom: effectiveZoom, initialized: true });
            if (restrictBounds && currentMapBounds) {
                setTimeout(() => {
                    if (map) {
                        map.setOptions({ restriction: { latLngBounds: currentMapBounds, strictBounds: true }, minZoom: Math.max(effectiveZoom - 2, 3), maxZoom: 21 });
                    }
                }, 100);
            }
        }
    }

    $: if (map && mapType) {
        if (mapType === 'dark') {
            map.setOptions({ 
                mapTypeId: 'roadmap',
                styles: darkMapStyle 
            });
        } else if (mapType === 'satellite') {
            map.setOptions({ 
                mapTypeId: 'satellite',
                styles: [] 
            });
        } else {
            map.setOptions({ 
                mapTypeId: 'roadmap',
                styles: [
                    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
                    { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }
                ]
            });
        }
    }

    $: if (mapPinLocation) {
        reverseGeocodeForPin(mapPinLocation.lat, mapPinLocation.lng);
    } else {
        mapPinLocationName = 'Loading location...';
    }

    // CRITICAL FIX: Update map when location prop changes
    $: if (map && location && (location.lat !== undefined && location.lng !== undefined)) {
        console.log('LocationMap: Location prop changed, updating map to:', location);
        const currentMapState = get(_mapCenterAndZoom);
        if (!currentMapState.initialized || 
            Math.abs(currentMapState.lat - location.lat) > 0.0001 || 
            Math.abs(currentMapState.lng - location.lng) > 0.0001 || 
            currentMapState.zoom !== location.zoom) {
            
            console.log('LocationMap: Panning and zooming to new location');
            map.panTo({ lat: location.lat, lng: location.lng });
            if (location.zoom) {
                map.setZoom(location.zoom);
            }
            _mapCenterAndZoom.set({ 
                lat: location.lat, 
                lng: location.lng, 
                zoom: location.zoom || map.getZoom() || 10, 
                initialized: true 
            });
        }
    }

    async function reverseGeocodeForPin(lat: number, lng: number) {
        try {
            const geocodedResult = await preferredLocation.geocodeLocation(lat, lng);
            mapPinLocationName = geocodedResult?.name || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
            if (mapPinMarker && infoWindow && mapPinLocation) {
                showPinInfoWindow(mapPinLocation);
            }
        } catch (error: any) {
            mapPinLocationName = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
            if (mapPinMarker && infoWindow && mapPinLocation) {
                showPinInfoWindow(mapPinLocation);
            }
        }
    }

    $: if (map && mapMode && infoWindow) {
        if (mapPinLocation && map.getZoom() >= 15 && map.getZoom() <= 21) {
            if (!mapPinMarker) {
                mapPinMarker = new google.maps.Marker({
                    map,
                    position: mapPinLocation,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: '#FF0000',
                        fillOpacity: 1,
                        strokeWeight: 0
                    },
                    draggable: true,
                    title: 'New Post Location'
                });
                mapPinMarker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
                    if (e.latLng && map) {
                        const latLng = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                        mapPinLocation = latLng;
                        navigateToLocation(latLng.lat, latLng.lng, map.getZoom() || 15, null, true);
                        dispatch('mapClick', { latLng, zoom: map.getZoom() || 15 });
                    }
                });
            } else {
                mapPinMarker.setPosition(mapPinLocation);
            }
            showPinInfoWindow(mapPinLocation);
        } else {
            if (mapPinMarker) {
                mapPinMarker.setMap(null);
                mapPinMarker = null;
            }
            if (infoWindow) infoWindow.close();
            mapPinLocation = null;
        }
    } else {
        if (mapPinMarker) {
            mapPinMarker.setMap(null);
            mapPinMarker = null;
        }
        if (infoWindow) infoWindow.close();
        mapPinLocation = null;
    }

    function showPinInfoWindow(pinLocation: { lat: number; lng: number }) {
        if (!map || !infoWindow || !mapPinMarker) return;
        const zoom = map.getZoom() || 15;

        const contentString = `
            <div style="font-family: Arial, sans-serif; padding: 10px; text-align: center;">
                <h4 style="margin: 0 0 5px;">Create Post Here?</h4>
                <p style="margin: 0; font-size: 0.9em;"><strong>Location:</strong> ${mapPinLocationName}</p>
                <button id="create-post-from-pin-btn" style="
                    background-color: #007bff;
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8em;
                    margin-top: 10px;
                ">Create Post</button>
            </div>
        `;
        infoWindow.setContent(contentString);
        infoWindow.open(map, mapPinMarker);

        google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
            const button = document.getElementById('create-post-from-pin-btn');
            if (button) {
                button.addEventListener('click', () => {
                    dispatch('createPostButton', { latLng: pinLocation, zoom });
                });
            }
        });
    }

    $: if (map && posts) {
        const postsHash = JSON.stringify(posts.map(p => p._id || `${p.lat},${p.lng}`));
        if (postsHash !== lastPostsHash) {
            updateMarkers();
            lastPostsHash = postsHash;
        }
    }

    $: if (map && highlightedPostId !== undefined) {
        highlightPostMarker(highlightedPostId);
    }

    // Restore original red dot marker logic
    function getPostMarkerIcon(post: any, isHighlighted: boolean = false) {
    // Determine if featured
        const isFeatured =
        (post.featuredInLocationUntil && post.featuredInLocationUntil > Date.now()) ||
        (post.featuredInSearchUntil && post.featuredInSearchUntil > Date.now());

        if (isFeatured) {
        return {
            path: google.maps.SymbolPath.CIRCLE,
            scale: isHighlighted ? 14 : 10,
            fillColor: isHighlighted ? '#facc15' : '#fde047', // gold/yellow for featured
            fillOpacity: 1,
            strokeWeight: isHighlighted ? 3 : 2,
            strokeColor: '#92400e'
        };
        }

        // Default: red dot
        return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: isHighlighted ? 12 : 7,
        fillColor: isHighlighted ? '#EA4335' : '#FF0000',
        fillOpacity: isHighlighted ? 1 : 0.9,
        strokeWeight: isHighlighted ? 2 : 1,
        strokeColor: '#FFFFFF'
        };
    }

    function updateMarkers() {
        if (!map || !google) return;

        markers.forEach(marker => {
            google.maps.event.clearInstanceListeners(marker);
            marker.setMap(null);
        });
        markers = [];

        console.log(`🔴 LocationMap: Processing ${posts.length} posts for red dot markers`);
        posts.forEach(post => {
            const postLat = post.lat || post.latitude;
            const postLng = post.lng || post.longitude;
            const shouldShowMarker = typeof postLat === 'number' && typeof postLng === 'number' && post.hasExactLocation === true;
            console.log(`🔴 Post ${post.id}: lat=${postLat}, lng=${postLng}, hasExactLocation=${post.hasExactLocation}, showMarker=${shouldShowMarker}`);
            
            // Only show markers for posts with exact locations
            if (shouldShowMarker) {
                const icon = getPostMarkerIcon(post, false);
                const marker = new google.maps.Marker({
                    position: { lat: postLat, lng: postLng },
                    map,
                    title: post.headline || post.title || post.content?.substring(0, 30),
                    icon
                });

                (marker as any).postData = post;
                (marker as any).postId = post._id || post.id || `${postLat},${postLng}`;

                marker.addListener('click', () => {
                    dispatch('postClick', { post });
                    navigateToLocation(postLat, postLng, map.getZoom() || 15, (marker as any).postId);
                });

                markers.push(marker);
            }
        });

        if (highlightedPostId) highlightPostMarker(highlightedPostId);
    }

    function highlightPostMarker(idToHighlight: string | null) {
        if (!map || !google || !infoWindow) return;

        let foundMarker: google.maps.Marker | null = null;
        markers.forEach(marker => {
            marker.setIcon(getPostMarkerIcon((marker as any).postData, false));
            if ((marker as any).postId === idToHighlight) {
                foundMarker = marker;
                marker.setIcon(getPostMarkerIcon((marker as any).postData, true));
            }
        });

        if (foundMarker) {
            const post = (foundMarker as any).postData;
            // Add image if present
            const imageBlock = post.imageUrl
                ? `<img src="${post.imageUrl}" style="max-width: 150px; height: auto; border-radius: 4px; margin-top: 5px;">`
                : post.mediaUrl
                    ? `<img src="${post.mediaUrl}" style="max-width: 150px; height: auto; border-radius: 4px; margin-top: 5px;">`
                    : '';
            const contentString = `
                <div style="font-family: Arial, sans-serif; padding: 5px;">
                    <h4 style="margin: 0 0 5px; font-size: 1.1em;">${post.headline || post.title || 'No Headline'}</h4>
                    <p style="margin: 0 0 5px; font-size: 0.9em;">${post.content || post.details || 'No Content'}</p>
                    ${post.locationName ? `<p style="margin: 0 0 5px; font-size: 0.8em;"><i class="fas fa-map-marker-alt" style="margin-right: 5px;"></i>${post.locationName}</p>` : ''}
                    ${imageBlock}
                    ${post.link ? `<p style="margin-top: 5px;"><a href="${post.link}" target="_blank" style="color: #007bff; text-decoration: none;">Learn More</a></p>` : ''}
                    <button class="see-post-button" data-post-id="${idToHighlight}" style="background-color: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 0.8em; margin-top: 8px;">See Post</button>
                </div>
            `;
            infoWindow.setContent(contentString);
            infoWindow.open(map, foundMarker);
            google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
                const button = document.querySelector(`.see-post-button[data-post-id="${idToHighlight}"]`);
                if (button) {
                    button.addEventListener('click', () => {
                        dispatch('postClick', { post });
                        map.panTo(foundMarker!.getPosition()!);
                    });
                }
            });
            map.panTo(foundMarker.getPosition()!);
        } else if (!idToHighlight) {
            infoWindow.close();
        }
    }
</script>

<div bind:this={mapDiv} class="map-container"></div>

<style>
    .map-container {
        width: 100%;
        height: 100%;
        background-color: #e0e0e0;
    }
</style>