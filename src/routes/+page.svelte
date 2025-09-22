<script lang="ts">
	import { page } from '$app/stores';

	let { data } = $props();
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	{#if data.user}
		<!-- Welcome back section -->
		<div class="mb-8">
			<h1 class="mb-2 text-3xl font-bold text-gray-900">
				Welcome back, {data.user.name || data.user.username}!
			</h1>
			<p class="text-gray-600">Stay connected with your local community.</p>
		</div>

		<!-- Quick actions -->
		<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
			<a
				href="/feed"
				class="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
			>
				<h3 class="mb-2 text-lg font-semibold text-gray-900">📰 Local Feed</h3>
				<p class="text-gray-600">See what's happening in your area</p>
			</a>

			<a
				href="/create"
				class="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
			>
				<h3 class="mb-2 text-lg font-semibold text-gray-900">✍️ Create Post</h3>
				<p class="text-gray-600">Share something with your community</p>
			</a>

			<a
				href="/explore"
				class="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
			>
				<h3 class="mb-2 text-lg font-semibold text-gray-900">🗺️ Explore</h3>
				<p class="text-gray-600">Discover new places and events</p>
			</a>
		</div>
	{:else}
		<!-- Hero section for non-authenticated users -->
		<div class="py-12 text-center">
			<h1 class="mb-4 text-4xl font-bold text-gray-900">Welcome to HyperlocalMoo</h1>
			<p class="mx-auto mb-8 max-w-2xl text-xl text-gray-600">
				Connect with your local community, discover events, and share what matters to you.
			</p>
			<a
				href="/auth/login/google"
				class="inline-flex items-center rounded-md bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
			>
				<svg class="mr-2 h-5 w-5" viewBox="0 0 24 24">
					<path
						fill="currentColor"
						d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
					/>
					<path
						fill="currentColor"
						d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
					/>
					<path
						fill="currentColor"
						d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
					/>
					<path
						fill="currentColor"
						d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
					/>
				</svg>
				Get Started with Google
			</a>
		</div>

		<!-- Features section -->
		<div class="py-12">
			<div class="grid grid-cols-1 gap-8 md:grid-cols-3">
				<div class="text-center">
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100"
					>
						<span class="text-2xl">🏘️</span>
					</div>
					<h3 class="mb-2 text-lg font-semibold text-gray-900">Local Focus</h3>
					<p class="text-gray-600">Connect with people and events in your immediate area</p>
				</div>

				<div class="text-center">
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100"
					>
						<span class="text-2xl">💬</span>
					</div>
					<h3 class="mb-2 text-lg font-semibold text-gray-900">Community</h3>
					<p class="text-gray-600">Share updates, ask questions, and help your neighbors</p>
				</div>

				<div class="text-center">
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100"
					>
						<span class="text-2xl">🔒</span>
					</div>
					<h3 class="mb-2 text-lg font-semibold text-gray-900">Privacy First</h3>
					<p class="text-gray-600">Your data stays private with secure authentication</p>
				</div>
			</div>
		</div>
	{/if}
</div>
