import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { PUBLIC_MAPS_API_KEY } from '$env/static/public';

// Define NYC as the default/fallback location
const initialFallbackLocation = {
    name: 'New York, NY, USA',
    lat: 40.7128,
    lng: -74.0060,
    zoom: 12,
    bounds: {
        north: 40.917577,
        south: 40.477399,
        east: -73.700272,
        west: -74.25909
    },
    locationType: 'city'
};

const LOCATION_STORAGE_KEY = 'preferredLocation';
const _preferredLocationWritable = writable(null);

function loadLocationFromStorage() {
    if (!browser) {
        console.log('preferredLocationStore: Not in browser, returning null for loadLocationFromStorage.');
        return null;
    }
    const storedLocation = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (storedLocation) {
        try {
            const parsedLocation = JSON.parse(storedLocation);
            if (
                parsedLocation &&
                typeof parsedLocation.lat === 'number' &&
                typeof parsedLocation.lng === 'number' &&
                typeof parsedLocation.name === 'string' &&
                typeof parsedLocation.zoom === 'number' &&
                parsedLocation.bounds &&
                typeof parsedLocation.bounds.north === 'number' &&
                typeof parsedLocation.bounds.south === 'number' &&
                typeof parsedLocation.bounds.east === 'number' &&
                typeof parsedLocation.bounds.west === 'number'
            ) {
                console.log('preferredLocationStore: Loaded valid location from localStorage:', parsedLocation);
                return parsedLocation;
            } else {
                console.warn('preferredLocationStore: Invalid or incomplete stored location, returning null. Stored:', parsedLocation);
                localStorage.removeItem(LOCATION_STORAGE_KEY);
                return null;
            }
        } catch (e) {
            console.error('preferredLocationStore: Error parsing stored location from localStorage:', e);
            localStorage.removeItem(LOCATION_STORAGE_KEY);
            return null;
        }
    }
    console.log('preferredLocationStore: No stored location found in localStorage.');
    return null;
}

function saveToLocalStorage(location) {
    if (browser) {
        try {
            const timestamp = Date.now();
            localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
            localStorage.setItem('preferredLocationTimestamp', timestamp.toString());
            console.log('preferredLocationStore: Saved to localStorage with timestamp:', location, 'timestamp:', timestamp);
            return true;
        } catch (e) {
            console.error('preferredLocationStore: Error saving to localStorage:', e);
            return false;
        }
    }
    return false;
}

export const preferredLocation = {
    subscribe: _preferredLocationWritable.subscribe,

    setAndPersist: (location) => {
        if (!browser) {
            console.warn('preferredLocationStore: Attempted to setAndPersist outside browser.');
            return false;
        }
        if (!location || !location.name || !location.bounds || !location.locationType) {
            console.warn('preferredLocationStore: Invalid location data provided to setAndPersist. Not saving:', location);
            return false;
        }

        // CRITICAL DEBUG: Check what data we're receiving
        console.log('🔍 STORE DEBUG - Input location:', location);
        console.log('🔍 Name check:', typeof location.name === 'string' && location.name);
        console.log('🔍 Lat check:', typeof location.lat === 'number');
        console.log('🔍 Lng check:', typeof location.lng === 'number');
        console.log('🔍 Bounds check:', location.bounds);
        console.log('🔍 Bounds validation:', location.bounds &&
                     typeof location.bounds.north === 'number' &&
                     typeof location.bounds.south === 'number' &&
                     typeof location.bounds.east === 'number' &&
                     typeof location.bounds.west === 'number');
        
        const locationToSave = {
            name: typeof location.name === 'string' && location.name ? location.name : initialFallbackLocation.name,
            lat: typeof location.lat === 'number' ? location.lat : initialFallbackLocation.lat,
            lng: typeof location.lng === 'number' ? location.lng : initialFallbackLocation.lng,
            zoom: typeof location.zoom === 'number' && location.zoom >= 3 && location.zoom <= 20 ? location.zoom : initialFallbackLocation.zoom,
            bounds: (location.bounds &&
                     typeof location.bounds.north === 'number' &&
                     typeof location.bounds.south === 'number' &&
                     typeof location.bounds.east === 'number' &&
                     typeof location.bounds.west === 'number')
                     ? location.bounds
                     : initialFallbackLocation.bounds,
            locationType: typeof location.locationType === 'string' ? location.locationType : initialFallbackLocation.locationType
        };
        
        console.log('🔍 STORE DEBUG - Final locationToSave:', locationToSave);
        console.log('preferredLocationStore: Setting and persisting location with emphasis on locationType:', locationToSave.locationType, locationToSave);
        _preferredLocationWritable.set(locationToSave);
        return saveToLocalStorage(locationToSave);
    },

    setPinLocation: (pinLocation) => {
        if (!browser) {
            console.warn('preferredLocationStore: Attempted to setPinLocation outside browser.');
            return false;
        }
        if (!pinLocation || typeof pinLocation.lat !== 'number' || typeof pinLocation.lng !== 'number') {
            console.warn('preferredLocationStore: Invalid pin location data provided to setPinLocation:', pinLocation);
            return false;
        }
        // Get current location to preserve name, bounds, and locationType
        const currentLocation = loadLocationFromStorage() || initialFallbackLocation;
        const pinLocationToSave = {
            ...currentLocation,
            lat: pinLocation.lat,
            lng: pinLocation.lng,
            zoom: pinLocation.zoom || currentLocation.zoom
        };
        console.log('preferredLocationStore: Setting pin location:', pinLocationToSave);
        _preferredLocationWritable.set(pinLocationToSave);
        return saveToLocalStorage(pinLocationToSave);
    },

    loadLocation: () => {
        const loaded = loadLocationFromStorage();
        if (loaded) {
            _preferredLocationWritable.set(loaded);
            console.log('preferredLocationStore: Loaded location:', loaded);
            return loaded;
        } else {
            _preferredLocationWritable.set(initialFallbackLocation);
            saveToLocalStorage(initialFallbackLocation);
            console.log('preferredLocationStore: No valid stored location, set to fallback and persisted:', initialFallbackLocation);
            return initialFallbackLocation;
        }
    },

    geocodeLocation: async (lat, lng) => {
        if (!browser) {
            console.error('preferredLocationStore: Geocoding not supported outside browser environment.');
            return null;
        }
        if (!PUBLIC_MAPS_API_KEY) {
            console.error('preferredLocationStore: Cannot geocode, PUBLIC_MAPS_API_KEY is not set.');
            return null;
        }
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${PUBLIC_MAPS_API_KEY}`
            );
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            const data = await response.json();
            console.log('preferredLocationStore: Geocode API response:', data);
            if (data.status === 'OK' && data.results && data.results[0]) {
                const result = data.results[0];
                const viewport = result.geometry.viewport;
                const geocodedResult = {
                    lat,
                    lng,
                    name: result.formatted_address,
                    zoom: initialFallbackLocation.zoom,
                    bounds: {
                        north: viewport.northeast.lat,
                        south: viewport.southwest.lat,
                        east: viewport.northeast.lng,
                        west: viewport.southwest.lng
                    },
                    locationType: result.types[0] || initialFallbackLocation.locationType
                };
                console.log('preferredLocationStore: Successfully geocoded:', geocodedResult);
                return geocodedResult;
            } else {
                const errorMessage = data.error_message || `Geocoding failed with status: ${data.status}`;
                console.warn('preferredLocationStore: Geocoding API returned an issue:', errorMessage);
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('preferredLocationStore: Geocoding fetch or API error:', error.message);
            return null;
        }
    },

    clearAndReset: () => {
        if (browser) {
            localStorage.removeItem(LOCATION_STORAGE_KEY);
            console.log('preferredLocationStore: Removed location from localStorage.');
        }
        _preferredLocationWritable.set(initialFallbackLocation);
        console.log('preferredLocationStore: Location store reset to fallback:', initialFallbackLocation);
    }
};

export const userLocation = derived(_preferredLocationWritable, ($preferredLocation) => {
    const isValid = (
        $preferredLocation &&
        typeof $preferredLocation.lat === 'number' &&
        typeof $preferredLocation.lng === 'number' &&
        typeof $preferredLocation.name === 'string' &&
        typeof $preferredLocation.zoom === 'number' &&
        $preferredLocation.bounds &&
        typeof $preferredLocation.bounds.north === 'number' &&
        typeof $preferredLocation.bounds.south === 'number' &&
        typeof $preferredLocation.bounds.east === 'number' &&
        typeof $preferredLocation.bounds.west === 'number'
    );

    const effectiveLocation = isValid ? $preferredLocation : initialFallbackLocation;
    const userLocationStatus = isValid;

    console.log('userLocation (derived): Providing effective location:', effectiveLocation, 'Status:', userLocationStatus ? 'set' : 'unset');
    return {
        preferredLocation: effectiveLocation,
        userLocationStatus: isValid
    };
});

preferredLocation.loadLocation();