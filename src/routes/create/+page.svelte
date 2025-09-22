<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';

	let { data, form } = $props();

	let content = $state('');
	let location = $state('');
	let submitting = $state(false);

	const maxLength = 1000;
	const remaining = $derived(maxLength - content.length);
</script>

<svelte:head>
	<title>Create Post - HyperlocalMoo</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
	<div class="mb-8">
		<h1 class="mb-2 text-3xl font-bold text-gray-900">Create Post</h1>
		<p class="text-gray-600">Share something with your local community</p>
	</div>

	<form
		method="POST"
		class="rounded-lg border bg-white p-6 shadow-sm"
		use:enhance={() => {
			submitting = true;
			return async ({ result, update }) => {
				submitting = false;
				if (result.type === 'redirect') {
					goto(result.location);
				} else {
					await update();
				}
			};
		}}
	>
		{#if form?.error}
			<div class="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
				<p class="text-red-800">{form.error}</p>
			</div>
		{/if}

		<!-- Content textarea -->
		<div class="mb-6">
			<label for="content" class="mb-2 block text-sm font-medium text-gray-700">
				What's on your mind?
			</label>
			<textarea
				id="content"
				name="content"
				bind:value={content}
				rows="4"
				class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
				placeholder="Share something with your community..."
				required
			></textarea>
			<div class="mt-2 flex items-center justify-between text-sm">
				<span class="text-gray-500"> Share updates, ask questions, or announce events </span>
				<span
					class="text-gray-500"
					class:text-red-500={remaining < 50}
					class:text-yellow-500={remaining >= 50 && remaining < 100}
				>
					{remaining} characters remaining
				</span>
			</div>
		</div>

		<!-- Location input -->
		<div class="mb-6">
			<label for="location" class="mb-2 block text-sm font-medium text-gray-700">
				<svg class="mr-1 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
					></path>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
					></path>
				</svg>
				Location (optional)
			</label>
			<input
				type="text"
				id="location"
				name="location"
				bind:value={location}
				class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
				placeholder="e.g., Downtown Coffee Shop, Central Park"
			/>
		</div>

		<!-- Submit buttons -->
		<div class="flex items-center justify-between">
			<a href="/feed" class="px-4 py-2 text-gray-700 transition-colors hover:text-gray-900">
				Cancel
			</a>
			<button
				type="submit"
				disabled={submitting || content.trim().length === 0 || remaining < 0}
				class="rounded-md bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300"
			>
				{#if submitting}
					<svg
						class="mr-3 -ml-1 inline h-5 w-5 animate-spin text-white"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Posting...
				{:else}
					Share Post
				{/if}
			</button>
		</div>
	</form>

	<!-- Tips section -->
	<div class="mt-8 rounded-lg bg-blue-50 p-6">
		<h3 class="mb-2 text-lg font-medium text-blue-900">💡 Tips for great posts</h3>
		<ul class="space-y-1 text-blue-800">
			<li>• Be respectful and kind to your community</li>
			<li>• Share local events, recommendations, or questions</li>
			<li>• Add a location to help neighbors find relevant content</li>
			<li>• Keep it brief but informative</li>
		</ul>
	</div>
</div>
