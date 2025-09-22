<script lang="ts">
	let { data } = $props();

	function formatDate(date: Date) {
		return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
			Math.ceil((date.getTime() - Date.now()) / (1000 * 60)),
			'minute'
		);
	}
</script>

<svelte:head>
	<title>Local Feed - HyperlocalMoo</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
	<div class="mb-8">
		<h1 class="mb-2 text-3xl font-bold text-gray-900">Local Feed</h1>
		<p class="text-gray-600">See what's happening in your community</p>
	</div>

	<!-- Create new post button -->
	<div class="mb-6">
		<a
			href="/create"
			class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
		>
			<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
				></path>
			</svg>
			Create Post
		</a>
	</div>

	<!-- Posts feed -->
	{#if data.posts.length === 0}
		<div class="py-12 text-center">
			<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
				<span class="text-2xl">📝</span>
			</div>
			<h3 class="mb-2 text-lg font-medium text-gray-900">No posts yet</h3>
			<p class="mb-4 text-gray-600">Be the first to share something with your community!</p>
			<a
				href="/create"
				class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
			>
				Create First Post
			</a>
		</div>
	{:else}
		<div class="space-y-6">
			{#each data.posts as post}
				<article class="rounded-lg border bg-white p-6 shadow-sm">
					<!-- Post header -->
					<div class="mb-4 flex items-center">
						{#if post.user.picture}
							<img
								src={post.user.picture}
								alt={post.user.name || post.user.username}
								class="mr-3 h-10 w-10 rounded-full"
							/>
						{:else}
							<div class="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
								<span class="font-medium text-gray-600">
									{(post.user.name || post.user.username).charAt(0).toUpperCase()}
								</span>
							</div>
						{/if}
						<div class="flex-1">
							<h4 class="font-medium text-gray-900">
								{post.user.name || post.user.username}
							</h4>
							<div class="flex items-center text-sm text-gray-500">
								<time>
									{formatDate(post.createdAt)}
								</time>
								{#if post.location}
									<span class="mx-2">•</span>
									<span class="flex items-center">
										<svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
										{post.location}
									</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Post content -->
					<div class="prose prose-sm max-w-none">
						<p class="whitespace-pre-wrap text-gray-900">{post.content}</p>
					</div>

					<!-- Post actions -->
					<div class="mt-4 flex items-center justify-between border-t pt-4">
						<div class="flex space-x-4">
							<button class="flex items-center text-gray-500 transition-colors hover:text-blue-600">
								<svg class="mr-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
									></path>
								</svg>
								Like
							</button>
							<button class="flex items-center text-gray-500 transition-colors hover:text-blue-600">
								<svg class="mr-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
									></path>
								</svg>
								Comment
							</button>
						</div>
						<button 
							class="text-gray-500 transition-colors hover:text-gray-700"
							aria-label="Share post"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
								></path>
							</svg>
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>
