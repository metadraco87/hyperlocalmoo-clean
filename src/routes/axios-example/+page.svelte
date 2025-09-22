<script lang="ts">
    import { onMount } from 'svelte';
    import api from '$lib/api/axiosClient';
    
    // Types for API responses
    interface ApiResponse {
        success: boolean;
        message?: string;
        data?: any;
    }
    
    // State variables
    let apiData: ApiResponse | null = null;
    let loading = false;
    let error: string | null = null;
    
    // Load data when component mounts
    onMount(() => {
        fetchData();
    });
    
    // Fetch data from API
    async function fetchData() {
        loading = true;
        error = null;
        
        try {
            const response = await api.get<ApiResponse>('/');
            apiData = response;
            console.log('API response:', response);
        } catch (err: any) {
            console.error('Error fetching data:', err);
            // Handle axios error response
            if (err.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                error = `Error ${err.response.status}: ${err.response.data?.message || err.response.statusText}`;
            } else if (err.request) {
                // The request was made but no response was received
                error = 'Network error: No response received from server';
            } else {
                // Something happened in setting up the request
                error = `Request error: ${err.message}`;
            }
        } finally {
            loading = false;
        }
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">Axios API Client Example</h1>
    
    <div class="mb-4">
        <button 
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            on:click={fetchData} 
            disabled={loading}
        >
            {loading ? 'Loading...' : 'Fetch API Data'}
        </button>
    </div>
    
    {#if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p><strong>Error:</strong> {error}</p>
        </div>
    {/if}
    
    {#if apiData}
        <div class="bg-white shadow-md rounded p-4">
            <h2 class="text-xl font-semibold mb-2">API Response:</h2>
            <pre class="bg-gray-100 p-4 rounded overflow-x-auto">{JSON.stringify(apiData, null, 2)}</pre>
        </div>
    {/if}
</div>

<style>
    .container {
        max-width: 800px;
    }
    
    pre {
        white-space: pre-wrap;
        word-break: break-word;
    }
</style>
