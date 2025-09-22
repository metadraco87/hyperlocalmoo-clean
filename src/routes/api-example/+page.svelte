<script>
  import { onMount } from 'svelte';
  import apiClient from '$lib/api/apiClient';

  let apiData = null;
  let loading = false;
  let error = null;

  let formData = {
    title: '',
    content: ''
  };

  async function fetchRootData() {
    loading = true;
    error = null;

    try {
      const data = await apiClient.get('/');
      apiData = data;
    } catch (err) {
      console.error('Error fetching data:', err);
      error = err?.data?.message || err?.statusText || 'Failed to fetch data from API';
    } finally {
      loading = false;
    }
  }

  async function submitForm() {
    loading = true;
    error = null;

    try {
      const result = await apiClient.post('/posts', formData);
      apiData = result;
      formData = { title: '', content: '' };
    } catch (err) {
      console.error('Error submitting form:', err);
      error = err?.data?.message || err?.statusText || 'Failed to submit data to API';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchRootData();
  });
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">API Integration Example</h1>
    
    <!-- Status indicators -->
    {#if loading}
        <div class="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
            <p>Loading data...</p>
        </div>
    {/if}
    
    {#if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p><strong>Error:</strong> {error}</p>
        </div>
    {/if}
    
    <!-- GET request section -->
    <div class="bg-white shadow-md rounded p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4">GET Request Example</h2>
        
        <button 
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mb-4"
            on:click={fetchRootData} 
            disabled={loading}
        >
            Fetch API Data
        </button>
        
        {#if apiData}
            <div>
                <h3 class="font-medium mb-2">Response:</h3>
                <pre class="bg-gray-100 p-4 rounded overflow-x-auto">{JSON.stringify(apiData, null, 2)}</pre>
            </div>
        {/if}
    </div>
    
    <!-- POST request section -->
    <div class="bg-white shadow-md rounded p-6">
        <h2 class="text-xl font-semibold mb-4">POST Request Example</h2>
        
        <form on:submit|preventDefault={submitForm} class="space-y-4 mb-4">
            <div>
                <label for="title" class="block mb-1 font-medium">Title</label>
                <input 
                    type="text" 
                    id="title" 
                    bind:value={formData.title} 
                    class="w-full p-2 border border-gray-300 rounded" 
                    required
                />
            </div>
            
            <div>
                <label for="content" class="block mb-1 font-medium">Content</label>
                <textarea 
                    id="content" 
                    bind:value={formData.content} 
                    class="w-full p-2 border border-gray-300 rounded h-32" 
                    required
                ></textarea>
            </div>
            
            <button 
                type="submit" 
                class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                disabled={loading}
            >
                Submit Form
            </button>
        </form>
    </div>
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
