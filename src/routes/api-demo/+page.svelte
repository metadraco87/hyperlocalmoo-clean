<script>
    import { onMount } from 'svelte';
    
    let data = null;
    let loading = false;
    let error = null;

    // Function to fetch data from API
    async function fetchData() {
        loading = true;
        error = null;
        
        try {
            const response = await fetch('https://apexmoo.com/', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                    // You can add additional headers here if needed for auth, etc.
                }
            });
            
            if (!response.ok) {
                throw new Error(`API request failed with status: ${response.status}`);
            }
            
            const result = await response.json();
            data = result;
            console.log('API Response:', data);
        } catch (err) {
            console.error('Error fetching data:', err);
            error = err.message || 'Failed to fetch data from API';
        } finally {
            loading = false;
        }
    }

    // Call the API when the component mounts
    onMount(() => {
        fetchData();
    });
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">API Connection Demo</h1>
    
    <button 
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mb-4"
        on:click={fetchData} 
        disabled={loading}
    >
        {loading ? 'Loading...' : 'Refresh Data'}
    </button>
    
    {#if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p><strong>Error:</strong> {error}</p>
        </div>
    {/if}
    
    {#if data}
        <div class="bg-white shadow-md rounded p-4">
            <h2 class="text-xl font-semibold mb-2">API Response:</h2>
            <pre class="bg-gray-100 p-4 rounded overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
        </div>
    {:else if !error && !loading}
        <div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
            <p>No data available.</p>
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
