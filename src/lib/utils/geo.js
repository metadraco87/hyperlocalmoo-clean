/**
 * Calculates a bounding box (LatLngBoundsLiteral) around a given center point with a specified radius in kilometers.
 * This is an approximation and works well for small distances.
 *
 * @param {object} center - The center point {lat: number, lng: number}.
 * @param {number} radiusKm - The radius in kilometers.
 * @returns {object} LatLngBoundsLiteral {north: number, south: number, east: number, west: number}
 */
export function calculateBoundsFromRadius(center, radiusKm) {
    const R = 6371; // Earth's radius in kilometers

    // Convert radius from km to degrees latitude
    const latChange = radiusKm / R * (180 / Math.PI);

    // Convert radius from km to degrees longitude
    // Cosine of latitude is used because longitude lines converge at poles
    const lngChange = radiusKm / (R * Math.cos(center.lat * Math.PI / 180)) * (180 / Math.PI);

    const north = center.lat + latChange;
    const south = center.lat - latChange;
    const east = center.lng + lngChange;
    const west = center.lng - lngChange;

    return { north, south, east, west };
}

/**
 * Parses a Google Places PlaceResult object to extract relevant address components.
 * @param {google.maps.places.PlaceResult} place - The place object from Google Places Autocomplete.
 * @returns {object} An object containing parsed address components (country, city, neighborhood, street, etc.)
 */
export function parseAddressComponents(place) {
    const components = {};
    if (!place || !place.address_components) {
        return components;
    }

    place.address_components.forEach(component => {
        const types = component.types;
        if (types.includes('country')) {
            components.country = component.long_name;
        } else if (types.includes('administrative_area_level_1')) { // State/Province
            components.provinceCity = component.long_name;
        } else if (types.includes('locality')) { // City
            components.city = component.long_name;
        } else if (types.includes('sublocality_level_1') || types.includes('neighborhood')) { // Neighborhood
            components.neighborhood = component.long_name;
        } else if (types.includes('route')) { // Street
            components.street = component.long_name;
        } else if (types.includes('postal_code')) {
            components.postalCode = component.long_name;
        }
        // You can add more types as needed
    });

    // Also include formatted address and name if available
    if (place.formatted_address) {
        components.formattedAddress = place.formatted_address;
    }
    if (place.name) {
        components.name = place.name;
    }

    return components;
}

/**
 * Determines the appropriate zoom level based on Google Place types.
 * @param {string[]} types - The types array from a Google Places PlaceResult.
 * @returns {number} Recommended zoom level.
 */
export function getZoomLevelForPlace(types) {
    if (types.includes('street_address') || types.includes('route')) {
        return 16; // Very close for a street
    } else if (types.includes('neighborhood') || types.includes('sublocality')) {
        return 14; // Neighborhood level
    } else if (types.includes('locality') || types.includes('administrative_area_level_2')) { // City or county
        return 12; // City level
    } else if (types.includes('administrative_area_level_1')) { // State/Province
        return 9;
    } else if (types.includes('country')) {
        return 5;
    }
    return 10; // Default zoom
}

/**
 * Determines the appropriate restriction allowance (in km) based on Google Place types.
 * @param {string[]} types - The types array from a Google Places PlaceResult.
 * @returns {number} Recommended allowance radius in kilometers.
 */
export function getAllowanceRadiusForPlace(types) {
    if (types.includes('street_address') || types.includes('route')) {
        return 1; // 1km allowance for street level
    } else if (types.includes('neighborhood') || types.includes('sublocality')) {
        return 3; // 3km allowance for neighborhood level
    } else if (types.includes('locality') || types.includes('administrative_area_level_2')) { // City or county
        return 10; // 10km allowance for city/county level
    }
    return 20; // Default larger allowance for broader regions
}
