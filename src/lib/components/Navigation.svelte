<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';

	let { user } = $props();
</script>

<header class="border-b bg-white shadow-sm">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<!-- Logo and brand -->
			<div class="flex items-center">
				<a href="/" class="text-xl font-bold text-blue-600"> HyperlocalMoo </a>
			</div>

			<!-- Navigation -->
			<nav class="hidden space-x-8 md:flex">
				<a
					href="/"
					class="rounded-md px-3 py-2 text-sm font-medium text-gray-900 hover:text-blue-600"
					class:text-blue-600={$page.url.pathname === '/'}
				>
					Home
				</a>
				{#if user}
					<a
						href="/feed"
						class="rounded-md px-3 py-2 text-sm font-medium text-gray-900 hover:text-blue-600"
						class:text-blue-600={$page.url.pathname === '/feed'}
					>
						Feed
					</a>
					<a
						href="/create"
						class="rounded-md px-3 py-2 text-sm font-medium text-gray-900 hover:text-blue-600"
						class:text-blue-600={$page.url.pathname === '/create'}
					>
						Create Post
					</a>
				{/if}
			</nav>

			<!-- User menu -->
			<div class="flex items-center space-x-4">
				{#if user}
					<div class="flex items-center space-x-3">
						{#if user.picture}
							<img
								src={user.picture}
								alt={user.name || user.username}
								class="h-8 w-8 rounded-full"
							/>
						{/if}
						<span class="text-sm font-medium text-gray-900">
							{user.name || user.username}
						</span>
						<form method="POST" action="/auth/logout" use:enhance>
							<button
								type="submit"
								class="rounded-md px-3 py-2 text-sm font-medium text-gray-900 hover:text-red-600"
							>
								Sign out
							</button>
						</form>
					</div>
				{:else}
					<a
						href="/auth/login/google"
						class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
					>
						Sign in with Google
					</a>
				{/if}
			</div>
		</div>
	</div>
</header>
