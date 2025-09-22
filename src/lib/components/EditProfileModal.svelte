<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import * as api from '$lib/api';
	import { auth } from '$lib/stores/auth';
	
	const dispatch = createEventDispatcher();

	// Props
	export let show = false;
	export let profileData: any = {};

	// Constants
	const BIO_MAX_LENGTH = 120;

	// Modal state variables
	let isSaving = false;
	let newUsername = '';
	let newBio = '';
	let newProfileImageUrl = '';
	let newShowEmail = true;
	let newShowLocation = true;
	let newShowProfileViews = true;
	let newShowTotalLocations = true;
	let newShowLastLoggedIn = true;
	let newYoutubeUrl = '';
	let newXUrl = '';
	let newMessengerUrl = '';
	let newInstagramUrl = '';
	let newTikTokUrl = '';
	let newShowStarredTo = 'everyone';
	let newShowFeaturedTo = 'everyone';
	let newShowConnectionsTo = 'everyone';
	let newShowBuddiesTo = 'buddies';
	let newAllowTaggingFrom = 'everyone';
	let newAllowMessagingFrom = 'everyone';
	let usernameError: string | null = null;
	let modalErrorMessage: string | null = null;
	let modalSuccessMessage: string | null = null;
	let selectedProfileImageFile: File | null = null;
	let selectedBackgroundImageFile: File | null = null;
	let selectedBackgroundImageFile2: File | null = null;
	let uploadingProfileImage = false;
	let uploadingBackgroundImage = false;
	let showUsernameDetailsModal = false;
	let checkAvailableLoading = false;
	let checkAvailableResult = '';
	
	// Background image variables
	let backgroundImageUrl = '';
	let manualBackgroundImageUrl = '';
	let backgroundImageUrl2 = '';
	let manualBackgroundImageUrl2 = '';

	// Computed values
	$: usernameChanged = newUsername !== profileData.username;
	$: canSave = newUsername.trim() !== '' && !usernameError;

	// Avatar and background generation
	const GRADIENTS = [
		['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'],
		['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#a8edea', '#fed6e3'],
		['#ff9a9e', '#fecfef'], ['#fad0c4', '#ffd1ff'], ['#a18cd1', '#fbc2eb'],
		['#ffecd2', '#fcb69f'], ['#ff8a80', '#ffb74d'], ['#81c784', '#aed581']
	];

	function stringToSeed(str: string): number {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return Math.abs(hash) % GRADIENTS.length;
	}

	function initials(username: string): string {
		return username ? username.charAt(0).toUpperCase() : 'U';
	}

	function textColor(seed: number): string {
		return seed % 2 === 0 ? '#ffffff' : '#000000';
	}

	function textShadow(seed: number): string | null {
		return seed % 2 === 0 ? '2px 2px 4px rgba(0,0,0,0.7)' : null;
	}

	$: avatarSeed = stringToSeed(profileData.username || 'user');
	$: defaultAvatarSvg = profileData.username
		? `data:image/svg+xml;utf8,<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${GRADIENTS[avatarSeed][0]}"/><stop offset="1" stop-color="${GRADIENTS[avatarSeed][1]}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)" rx="150"/><text x="50%" y="58%" text-anchor="middle" font-family="Inter,sans-serif" font-weight="bold" font-size="140" fill="${textColor(avatarSeed)}" style="paint-order:stroke;stroke-linecap:butt;stroke-linejoin:miter;${textShadow(avatarSeed) ? `text-shadow:${textShadow(avatarSeed)};` : ''}" dy=".35em">${initials(profileData.username)}</text></svg>`
		: '';

	// Initialize form values when modal opens
	$: if (show && profileData) {
		initializeFormValues();
	}

	function initializeFormValues() {
		newUsername = profileData.username || '';
		newBio = profileData.bio || '';
		newProfileImageUrl = profileData.profileImageUrl || '';
		newShowEmail = profileData.showEmail !== false;
		newShowLocation = profileData.showLocation !== false;
		newShowProfileViews = profileData.showProfileViews !== false;
		newShowTotalLocations = profileData.showTotalLocations !== false;
		newShowLastLoggedIn = profileData.showLastLoggedIn !== false;
		newYoutubeUrl = profileData.youtubeUrl || '';
		newXUrl = profileData.xUrl || '';
		newMessengerUrl = profileData.messengerUrl || '';
		newInstagramUrl = profileData.instagramUrl || '';
		newTikTokUrl = profileData.tikTokUrl || '';
		newShowStarredTo = profileData.showStarredTo || 'everyone';
		newShowFeaturedTo = profileData.showFeaturedTo || 'everyone';
		newShowConnectionsTo = profileData.showConnectionsTo || 'everyone';
		newShowBuddiesTo = profileData.showBuddiesTo || 'buddies';
		newAllowTaggingFrom = profileData.allowTaggingFrom || 'everyone';
		newAllowMessagingFrom = profileData.allowMessagingFrom || 'everyone';
		backgroundImageUrl = profileData.backgroundImageUrl || '';
		backgroundImageUrl2 = profileData.backgroundImageUrl2 || '';
		manualBackgroundImageUrl = '';
		manualBackgroundImageUrl2 = '';
	}

	function closeEditProfileModal() {
		show = false;
		dispatch('close');
	}

	async function checkUsernameAvailable() {
		if (!newUsername.trim() || newUsername === profileData.username) {
			checkAvailableResult = 'Username unchanged.';
			return;
		}

		checkAvailableLoading = true;
		usernameError = null;
		checkAvailableResult = '';

		try {
			const result = await api.checkUsernameAvailable(newUsername, $auth.token || '');
			if (result.available) {
				checkAvailableResult = '✅ Username is available!';
				usernameError = null;
			} else {
				checkAvailableResult = '❌ Username is taken.';
				usernameError = 'This username is already taken.';
			}
		} catch (error: any) {
			console.error('Username check error:', error);
			checkAvailableResult = '❌ Check failed.';
			usernameError = error.message || 'Failed to check username availability.';
		}

		checkAvailableLoading = false;
	}

	function openUsernameDetailsModal() {
		showUsernameDetailsModal = true;
	}

	function formatTimeUntilChange(lastChange: number): string {
		const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
		const nextChangeTime = lastChange + sevenDaysInMs;
		const now = Date.now();
		
		if (now >= nextChangeTime) {
			return 'You can change your username now.';
		}
		
		const timeLeft = nextChangeTime - now;
		const daysLeft = Math.ceil(timeLeft / (24 * 60 * 60 * 1000));
		
		return `You can change your username in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`;
	}

	// File upload handlers
	async function handleProfileImageFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		
		if (!file) return;
		
		selectedProfileImageFile = file;
		uploadingProfileImage = true;
		
		try {
			const result = await api.uploadFile(file, $auth.token || '');
			newProfileImageUrl = result.url || result.data;
		} catch (error: any) {
			console.error('Profile image upload error:', error);
			modalErrorMessage = error.message || 'Failed to upload profile image.';
		}
		
		uploadingProfileImage = false;
	}

	async function handleBackgroundImageFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		
		if (!file) return;
		
		selectedBackgroundImageFile = file;
		uploadingBackgroundImage = true;
		
		try {
			const result = await api.uploadFile(file, $auth.token || '');
			backgroundImageUrl = result.url || result.data;
			manualBackgroundImageUrl = result.url || result.data;
		} catch (error: any) {
			console.error('Background image upload error:', error);
			modalErrorMessage = error.message || 'Failed to upload background image.';
		}
		
		uploadingBackgroundImage = false;
	}

	async function handleBackgroundImageFile2Change(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		
		if (!file) return;
		
		selectedBackgroundImageFile2 = file;
		uploadingBackgroundImage = true;
		
		try {
			const result = await api.uploadFile(file, $auth.token || '');
			backgroundImageUrl2 = result.url || result.data;
			manualBackgroundImageUrl2 = result.url || result.data;
		} catch (error: any) {
			console.error('Background image 2 upload error:', error);
			modalErrorMessage = error.message || 'Failed to upload background image 2.';
		}
		
		uploadingBackgroundImage = false;
	}

	function handleRemoveProfilePicture() {
		selectedProfileImageFile = null;
		newProfileImageUrl = '';
	}

	function handleRemoveBackgroundImage() {
		selectedBackgroundImageFile = null;
		backgroundImageUrl = '';
		manualBackgroundImageUrl = '';
	}

	function handleRemoveBackgroundImage2() {
		selectedBackgroundImageFile2 = null;
		backgroundImageUrl2 = '';
		manualBackgroundImageUrl2 = '';
	}

	function isValidUrl(url: string): boolean {
		return /^https?:\/\/.+$/.test(url);
	}

	async function handleSaveProfile() {
		if (!$auth.token) {
			modalErrorMessage = 'Authentication required. Please log in.';
			return;
		}

		isSaving = true;
		modalErrorMessage = null;
		modalSuccessMessage = null;

		try {
			const updates: any = {};
			let hasChanges = false;

			// Username
			if (newUsername !== profileData.username) {
				if (newUsername.trim().length === 0) {
					modalErrorMessage = 'Username cannot be empty.';
					isSaving = false;
					return;
				}
				updates.username = newUsername.trim();
				hasChanges = true;
			}

			// Bio
			if (newBio !== profileData.bio) {
				if (newBio.length > BIO_MAX_LENGTH) {
					modalErrorMessage = `Bio cannot exceed ${BIO_MAX_LENGTH} characters.`;
					isSaving = false;
					return;
				}
				updates.bio = newBio;
				hasChanges = true;
			}

			// Profile Image
			const finalProfileImageUrl = newProfileImageUrl || '';
			if (finalProfileImageUrl !== (profileData.profileImageUrl || '')) {
				if (finalProfileImageUrl && !isValidUrl(finalProfileImageUrl)) {
					modalErrorMessage = 'Profile image URL must be a valid URL (starting with http:// or https://).';
					isSaving = false;
					return;
				}
				updates.profileImageUrl = finalProfileImageUrl;
				hasChanges = true;
			}

			// Background Image
			const finalBackgroundImageUrl = manualBackgroundImageUrl || backgroundImageUrl || '';
			if (finalBackgroundImageUrl !== (profileData.backgroundImageUrl || '')) {
				if (finalBackgroundImageUrl && !isValidUrl(finalBackgroundImageUrl)) {
					modalErrorMessage = 'Background image URL must be a valid URL (starting with http:// or https://).';
					isSaving = false;
					return;
				}
				updates.backgroundImageUrl = finalBackgroundImageUrl;
				hasChanges = true;
			}

			// Background Image 2
			const finalBackgroundImageUrl2 = manualBackgroundImageUrl2 || backgroundImageUrl2 || '';
			if (finalBackgroundImageUrl2 !== (profileData.backgroundImageUrl2 || '')) {
				if (finalBackgroundImageUrl2 && !isValidUrl(finalBackgroundImageUrl2)) {
					modalErrorMessage = 'Background image 2 URL must be a valid URL (starting with http:// or https://).';
					isSaving = false;
					return;
				}
				updates.backgroundImageUrl2 = finalBackgroundImageUrl2;
				hasChanges = true;
			}

			// Social links
			const socialUpdates = [
				{ key: 'youtubeUrl', old: profileData.youtubeUrl, new: newYoutubeUrl },
				{ key: 'xUrl', old: profileData.xUrl, new: newXUrl },
				{ key: 'messengerUrl', old: profileData.messengerUrl, new: newMessengerUrl },
				{ key: 'instagramUrl', old: profileData.instagramUrl, new: newInstagramUrl },
				{ key: 'tikTokUrl', old: profileData.tikTokUrl, new: newTikTokUrl }
			];

			socialUpdates.forEach(({ key, old, new: newValue }) => {
				if (newValue !== (old || '')) {
					updates[key] = newValue;
					hasChanges = true;
				}
			});

			// Privacy settings
			const privacyUpdates = [
				{ key: 'showEmail', old: profileData.showEmail, new: newShowEmail },
				{ key: 'showLocation', old: profileData.showLocation, new: newShowLocation },
				{ key: 'showProfileViews', old: profileData.showProfileViews, new: newShowProfileViews },
				{ key: 'showTotalLocations', old: profileData.showTotalLocations, new: newShowTotalLocations },
				{ key: 'showLastLoggedIn', old: profileData.showLastLoggedIn, new: newShowLastLoggedIn }
			];

			privacyUpdates.forEach(({ key, old, new: newValue }) => {
				if (newValue !== old) {
					updates[key] = newValue;
					hasChanges = true;
				}
			});

			// Visibility settings
			const visibilityUpdates = [
				{ key: 'showStarredTo', old: profileData.showStarredTo, new: newShowStarredTo },
				{ key: 'showFeaturedTo', old: profileData.showFeaturedTo, new: newShowFeaturedTo },
				{ key: 'showConnectionsTo', old: profileData.showConnectionsTo, new: newShowConnectionsTo },
				{ key: 'showBuddiesTo', old: profileData.showBuddiesTo, new: newShowBuddiesTo },
				{ key: 'allowTaggingFrom', old: profileData.allowTaggingFrom, new: newAllowTaggingFrom }
			];

			visibilityUpdates.forEach(({ key, old, new: newValue }) => {
				if (newValue !== (old || 'everyone')) {
					updates[key] = newValue;
					hasChanges = true;
				}
			});

			// Messaging permissions
			if (newAllowMessagingFrom !== (profileData.allowMessagingFrom || 'everyone')) {
				updates.allowMessagingFrom = newAllowMessagingFrom;
				hasChanges = true;
			}

			if (!hasChanges) {
				modalSuccessMessage = 'No changes to save.';
				isSaving = false;
				closeEditProfileModal();
				return;
			}

			const result = await api.updateProfile(updates, $auth.token || '');
			if (result.success) {
				modalSuccessMessage = 'Profile updated successfully!';
				dispatch('profile-updated', result);
				closeEditProfileModal();
			} else {
				modalErrorMessage = result.message || 'Failed to update profile.';
			}
		} catch (error: any) {
			console.error('Save profile error:', error);
			modalErrorMessage = error.message || 'Failed to update profile. Please try again.';
		}

		isSaving = false;
	}
</script>

{#if show}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<div
		class="edit-profile-modal-backdrop"
		role="dialog"
		aria-labelledby="edit-profile-title"
		on:click={closeEditProfileModal}
	>
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="edit-profile-modal edit-profile-modal-landscape"
			on:click|stopPropagation
		>
			<h2 id="edit-profile-title" class="modal-title">Edit Your Profile</h2>
			<form on:submit|preventDefault={handleSaveProfile}>
				<div class="modal-columns">
					<!-- Column 1: Images -->
					<div class="modal-column">
						<div class="form-section">
							<h3 class="form-section-title">Profile Image</h3>
							<div class="image-upload">
								{#if newProfileImageUrl}
									<img
										src={newProfileImageUrl}
										alt="Profile preview"
										class="preview-image"
									/>
								{:else}
									<img
										src={defaultAvatarSvg}
										alt="Default avatar"
										class="preview-image"
									/>
								{/if}
								
								<div class="upload-options">
									<label for="profile-image-upload" class="upload-btn">
										{#if uploadingProfileImage}Uploading...{:else}Choose File{/if}
									</label>
									<input
										id="profile-image-upload"
										type="file"
										accept="image/*,video/*"
										on:change={handleProfileImageFileChange}
										disabled={uploadingProfileImage}
										class="hidden"
									/>
									
									<div class="url-input-group">
										<label for="profile-image-url" class="form-label">Or enter image URL</label>
										<input
											id="profile-image-url"
											type="text"
											bind:value={newProfileImageUrl}
											placeholder="https://example.com/image.jpg"
											class="form-input"
											disabled={isSaving || uploadingProfileImage}
										/>
									</div>
								</div>
								
								{#if selectedProfileImageFile || newProfileImageUrl}
									<button
										on:click={handleRemoveProfilePicture}
										type="button"
										class="remove-btn"
									>
										Remove Image
									</button>
								{/if}
							</div>
						</div>

						<div class="form-section">
							<h3 class="form-section-title">Background Image</h3>
							<div class="image-upload">
								{#if backgroundImageUrl || manualBackgroundImageUrl}
									<img
										src={backgroundImageUrl || manualBackgroundImageUrl}
										alt="Background preview"
										class="preview-image background-preview"
									/>
								{:else}
									<div class="background-placeholder-preview">No background selected</div>
								{/if}
								
								<div class="upload-options">
									<label for="background-image-upload" class="upload-btn">
										{#if uploadingBackgroundImage}Uploading...{:else}Choose Background{/if}
									</label>
									<input
										id="background-image-upload"
										type="file"
										accept="image/*,video/*"
										on:change={handleBackgroundImageFileChange}
										disabled={uploadingBackgroundImage}
										class="hidden"
									/>
									
									<div class="url-input-group">
										<label for="background-image-url" class="form-label">Or enter image URL:</label>
										<input
											id="background-image-url"
											type="text"
											bind:value={manualBackgroundImageUrl}
											placeholder="https://example.com/background.jpg"
											class="form-input"
											disabled={isSaving || uploadingBackgroundImage}
										/>
									</div>
								</div>
								
								{#if selectedBackgroundImageFile || backgroundImageUrl || manualBackgroundImageUrl}
									<button
										on:click={handleRemoveBackgroundImage}
										type="button"
										class="remove-btn"
									>
										Remove Background
									</button>
								{/if}
							</div>
						</div>

						<div class="form-section">
							<h3 class="form-section-title">Posts Section Background</h3>
							<div class="image-upload">
								{#if backgroundImageUrl2 || manualBackgroundImageUrl2}
									<img
										src={backgroundImageUrl2 || manualBackgroundImageUrl2}
										alt="Background 2 preview"
										class="preview-image background-preview"
									/>
								{:else}
									<div class="background-placeholder-preview">No background selected</div>
								{/if}
								
								<div class="upload-options">
									<label for="background-image-2-upload" class="upload-btn">
										{#if uploadingBackgroundImage}Uploading...{:else}Choose Background 2{/if}
									</label>
									<input
										id="background-image-2-upload"
										type="file"
										accept="image/*,video/*"
										on:change={handleBackgroundImageFile2Change}
										disabled={uploadingBackgroundImage}
										class="hidden"
									/>
									
									<div class="url-input-group">
										<label for="background-image-2-url" class="form-label">Or enter image URL:</label>
										<input
											id="background-image-2-url"
											type="text"
											bind:value={manualBackgroundImageUrl2}
											placeholder="https://example.com/background2.jpg"
											class="form-input"
											disabled={isSaving || uploadingBackgroundImage}
										/>
									</div>
								</div>
								
								{#if selectedBackgroundImageFile2 || backgroundImageUrl2 || manualBackgroundImageUrl2}
									<button
										on:click={handleRemoveBackgroundImage2}
										type="button"
										class="remove-btn"
									>
										Remove Background 2
									</button>
								{/if}
							</div>
						</div>
					</div>

					<!-- Column 2: Username, Bio, Socials -->
					<div class="modal-column">
						<div class="form-section">
							<h3 class="form-section-title">Username</h3>
							<input
								type="text"
								id="editUsername"
								bind:value={newUsername}
								maxlength="15"
								class="form-input"
								aria-invalid={usernameError ? 'true' : 'false'}
							/>
							<div class="form-actions">
								<button
									type="button"
									on:click={checkUsernameAvailable}
									disabled={checkAvailableLoading || !usernameChanged}
									class="action-btn"
								>
									{#if checkAvailableLoading}Checking...{:else}Check Availability{/if}
								</button>
								<button
									type="button"
									on:click={openUsernameDetailsModal}
									class="action-btn secondary"
								>
									More details
								</button>
								{#if checkAvailableResult}
									<span class="check-result">{checkAvailableResult}</span>
								{/if}
							</div>
							{#if usernameError}
								<p class="error-text">{usernameError}</p>
							{/if}
						</div>

						<div class="form-section">
							<h3 class="form-section-title">Bio</h3>
							<textarea
								id="bio"
								bind:value={newBio}
								maxlength={BIO_MAX_LENGTH}
								class="form-textarea"
								disabled={isSaving || uploadingProfileImage}
								style="resize: none; overflow: hidden;"
								on:input={(e) => {
									const target = e.target;
									if (target instanceof HTMLTextAreaElement) {
										target.style.height = 'auto';
										target.style.height = target.scrollHeight + 'px';
									}
								}}
							></textarea>
							<p class="char-count">{newBio.length}/{BIO_MAX_LENGTH} characters</p>
						</div>

						<div class="form-section">
							<h3 class="form-section-title">Socials</h3>
							<div class="form-grid">
								<div>
									<label for="youtubeUrl" class="form-label">YouTube Channel:</label>
									<div class="prefix-input-group">
										<span class="input-prefix">youtube.com/@</span>
										<input type="text" id="youtubeUrl" bind:value={newYoutubeUrl} class="form-input prefixed-input" placeholder="channel-name" />
									</div>
								</div>
								<div>
									<label for="xUrl" class="form-label">X (Twitter) Handle:</label>
									<div class="prefix-input-group">
										<span class="input-prefix">x.com/</span>
										<input type="text" id="xUrl" bind:value={newXUrl} class="form-input prefixed-input" placeholder="username" />
									</div>
								</div>
								<div>
									<label for="messengerUrl" class="form-label">Messenger:</label>
									<div class="prefix-input-group">
										<span class="input-prefix">m.me/</span>
										<input type="text" id="messengerUrl" bind:value={newMessengerUrl} class="form-input prefixed-input" placeholder="username" />
									</div>
								</div>
								<div>
									<label for="instagramUrl" class="form-label">Instagram Handle:</label>
									<div class="prefix-input-group">
										<span class="input-prefix">instagram.com/</span>
										<input type="text" id="instagramUrl" bind:value={newInstagramUrl} class="form-input prefixed-input" placeholder="username" />
									</div>
								</div>
								<div>
									<label for="tikTokUrl" class="form-label">TikTok Handle:</label>
									<div class="prefix-input-group">
										<span class="input-prefix">tiktok.com/@</span>
										<input type="text" id="tikTokUrl" bind:value={newTikTokUrl} class="form-input prefixed-input" placeholder="username" />
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Column 3: Privacy Settings, Visibility Settings -->
					<div class="modal-column">
						<div class="form-section">
							<h3 class="form-section-title">Privacy Settings</h3>
							<div class="checkbox-item">
								<input type="checkbox" id="showEmail" bind:checked={newShowEmail} class="form-checkbox" />
								<label for="showEmail" class="checkbox-label">Show email address on profile</label>
							</div>
							<div class="checkbox-item">
								<input type="checkbox" id="showLocation" bind:checked={newShowLocation} class="form-checkbox" />
								<label for="showLocation" class="checkbox-label">Show location on profile</label>
							</div>
							<div class="checkbox-item">
								<input type="checkbox" id="showProfileViews" bind:checked={newShowProfileViews} class="form-checkbox" />
								<label for="showProfileViews" class="checkbox-label">Show profile views on profile</label>
							</div>
							<div class="checkbox-item">
								<input type="checkbox" id="showTotalLocations" bind:checked={newShowTotalLocations} class="form-checkbox" />
								<label for="showTotalLocations" class="checkbox-label">Show total locations visited</label>
							</div>
							<div class="checkbox-item">
								<input type="checkbox" id="showLastLoggedIn" bind:checked={newShowLastLoggedIn} class="form-checkbox" />
								<label for="showLastLoggedIn" class="checkbox-label">Show last logged in time</label>
							</div>
						</div>

						<div class="form-section">
							<h3 class="form-section-title">Visibility Settings</h3>
							<div class="form-group">
								<label for="showStarredTo" class="form-label">Starred Posts Visibility:</label>
								<select
									id="showStarredTo"
									bind:value={newShowStarredTo}
									class="form-input"
								>
									<option value="everyone">Everyone</option>
									<option value="connected">Connected Users</option>
									<option value="buddies">Buddies</option>
									<option value="never">Never</option>
								</select>
							</div>
							<div class="form-group">
								<label for="showFeaturedTo" class="form-label">Featured Posts Visibility:</label>
								<select
									id="showFeaturedTo"
									bind:value={newShowFeaturedTo}
									class="form-input"
								>
									<option value="everyone">Everyone</option>
									<option value="connected">Connected Users</option>
									<option value="buddies">Buddies</option>
									<option value="never">Never</option>
								</select>
							</div>
							<div class="form-group">
								<label for="showConnectionsTo" class="form-label">Connections Visibility:</label>
								<select
									id="showConnectionsTo"
									bind:value={newShowConnectionsTo}
									class="form-input"
								>
									<option value="everyone">Everyone</option>
									<option value="connected">Connected Users</option>
									<option value="buddies">Buddies</option>
									<option value="never">Never</option>
								</select>
							</div>
							<div class="form-group">
								<label for="showBuddiesTo" class="form-label">Buddies Visibility:</label>
								<select
									id="showBuddiesTo"
									bind:value={newShowBuddiesTo}
									class="form-input"
								>
									<option value="everyone">Everyone</option>
									<option value="connected">Connected Users</option>
									<option value="buddies">Buddies</option>
									<option value="never">Never</option>
								</select>
							</div>
							<div class="form-group">
								<label for="allowTaggingFrom" class="form-label">Allow Tagging From:</label>
								<select
									id="allowTaggingFrom"
									bind:value={newAllowTaggingFrom}
									class="form-input"
								>
									<option value="everyone">Everyone</option>
									<option value="connected">Connected Users</option>
									<option value="buddies">Buddies Only</option>
									<option value="never">No One</option>
								</select>
							</div>
							<div class="form-group">
								<label for="allowMessagingFrom" class="form-label">Allow Messaging From:</label>
								<select
									id="allowMessagingFrom"
									bind:value={newAllowMessagingFrom}
									class="form-input"
								>
									<option value="everyone">Anyone can message me</option>
									<option value="connected">Connected Users Only</option>
									<option value="buddies">Buddies Only</option>
								</select>
							</div>
						</div>
						{#if modalErrorMessage}
							<p class="error-text">{modalErrorMessage}</p>
						{/if}
						{#if modalSuccessMessage}
							<p class="success-text">{modalSuccessMessage}</p>
						{/if}
						<div class="form-actions">
							<button
								type="submit"
								disabled={isSaving || uploadingProfileImage || !canSave}
								class="save-btn"
								class:disabled={isSaving || uploadingProfileImage || !canSave}
							>
								{#if isSaving}Saving...{:else}Save Changes{/if}
							</button>
						</div>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if showUsernameDetailsModal}
	<div class="edit-profile-modal-backdrop" role="dialog" aria-labelledby="username-details-title">
		<div class="edit-profile-modal small">
			<h3 id="username-details-title" class="modal-title">Username Change Details</h3>
			<p class="modal-text">{formatTimeUntilChange(profileData.lastUsernameChange)}</p>
			<p class="modal-text small">Usernames can be changed once every 7 days.</p>
			<div class="form-actions">
				<button class="action-btn secondary" on:click={() => showUsernameDetailsModal = false}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
    /* Edit Profile Modal Styles - Only used for the edit profile modal */
    .edit-profile-modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        overflow-y: auto;
        padding: 20px;
    	scrollbar-width: none;      /* Firefox */
    	-ms-overflow-style: none;      /* IE and Edge */
    }

	.edit-profile-modal-backdrop::-webkit-scrollbar {
		display: none;                 /* Chrome, Safari, Opera */
	}

    .edit-profile-modal {
        background-color: #00000077;
        padding: 2.5rem;
        border-radius: 12px;
        box-shadow: 0 0 20px #00eaff;
        border: 1px solid #00eaff;
        width: 100%;
		height: 100%;
        max-width: 600px;
        max-height: 400px;
        color: #fff;
        overflow-y: auto;
    	scrollbar-width: none;
    	-ms-overflow-style: none;
    }

	.edit-profile-modal::-webkit-scrollbar {
		display: none;
	}

    .edit-profile-modal-landscape {
        max-width: 95vw;
        max-height: 65vh;
        width: 1200px;
    }

    .modal-title {
        color: #00eaff;
        font-size: 1.5rem;
        font-weight: bold;
        text-align: center;
        margin-bottom: 1.5rem;
		margin-top: -1rem;
        text-shadow: 0 0 10px #00eaff;
        position: relative; /* Not sticky - allow scrolling */
    }

    .modal-columns {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 2rem;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE and Edge */
		box-sizing: border-box;
    	overflow-x: auto;
    }

    .modal-columns::-webkit-scrollbar {
        display: none; /* Chrome, Safari, Opera */
    }

    .modal-column {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
		box-sizing: border-box;
    }

    .form-section {
        background: rgba(0, 234, 255, 0.1);
        padding: 1.5rem;
        border-radius: 8px;
        border: 1px solid rgba(0, 234, 255, 0.3);
    }

    .form-section-title {
        color: #00eaff;
        font-weight: bold;
        margin-bottom: 1rem;
        font-size: 1.1rem;
    }

    .form-input, .form-textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid rgba(0, 234, 255, 0.3);
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.5);
        color: #fff;
        font-size: 0.95rem;
		box-sizing: border-box;
    }

    .form-input:focus, .form-textarea:focus {
        outline: none;
        border-color: #00eaff;
        box-shadow: 0 0 5px rgba(0, 234, 255, 0.5);
    }

    .form-textarea {
        min-height: 80px;
        resize: vertical;
        font-family: inherit;
    }

    .form-grid {
        display: grid;
        gap: 1rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .form-label {
        color: #e0f2fe;
        font-weight: 500;
        margin-bottom: 0.25rem;
        font-size: 0.9rem;
    }

    .checkbox-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }

    .form-checkbox {
        width: auto;
        margin: 0;
    }

    .checkbox-label {
        color: #e0f2fe;
        font-size: 0.9rem;
        cursor: pointer;
    }

    .char-count {
        font-size: 0.8rem;
        color: #a0a0a0;
        text-align: right;
        margin-top: 0.25rem;
    }

    .form-actions {
        display: flex;
        gap: 1rem;
        justify-content: center; /* Center the save button */
        align-items: center;
        flex-wrap: wrap;
        margin-top: 1rem;
    }

    .action-btn, .save-btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9rem;
    }

    .action-btn {
        background: linear-gradient(135deg, #00eaff, #0066cc);
        color: white;
    }

    .action-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 234, 255, 0.4);
    }

    .action-btn.secondary {
        background: linear-gradient(135deg, #6b7280, #4b5563);
    }

    .action-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    .save-btn {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
    }

    .save-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }

    .save-btn.disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }



    .error-text {
        color: #f87171;
        font-size: 0.9rem;
        margin-top: 0.5rem;
    }

    .success-text {
        color: #34d399; /* Green for success */
        font-size: 0.9rem;
        margin-top: 0.5rem;
    }

    .check-result {
        font-size: 0.9rem;
        color: #e0f2fe;
    }

    .edit-profile-modal.small {
        max-width: 450px;
    }

    .modal-text {
        color: #e0f2fe;
        line-height: 1.6;
        margin-bottom: 1rem;
    }

    .modal-text.small {
        font-size: 0.9rem;
        color: #a0a0a0;
    }

    /* Image upload styles */
    .image-upload {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .preview-image {
        width: 100%;
        max-width: 200px;
        height: 120px;
        object-fit: cover;
        border-radius: 8px;
        border: 2px solid rgba(0, 234, 255, 0.3);
    }

    .background-preview {
        height: 80px;
    }

    .background-placeholder-preview {
        width: 100%;
        max-width: 200px;
        height: 80px;
        background: rgba(0, 0, 0, 0.3);
        border: 2px dashed rgba(0, 234, 255, 0.3);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #a0a0a0;
        font-size: 0.9rem;
    }

    .upload-options {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .upload-btn {
        background: linear-gradient(135deg, #00eaff, #0066cc);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        text-align: center;
        font-weight: 600;
        font-size: 0.85rem;
        transition: all 0.2s ease;
    }

    .upload-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 234, 255, 0.4);
    }

    .url-input-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .remove-btn {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: white;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.85rem;
        transition: all 0.2s ease;
    }

    .remove-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    }

    .hidden {
        display: none;
    }

    /* Prefix input styles */
    .prefix-input-group {
        display: flex;
        align-items: center;
        border: 1px solid rgba(0, 234, 255, 0.3);
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.5);
        overflow: hidden;
    }

    .input-prefix {
        background: rgba(0, 234, 255, 0.2);
        color: #00eaff;
        padding: 0.75rem 0.5rem;
        font-size: 0.85rem;
        font-weight: 600;
        white-space: nowrap;
        border-right: 1px solid rgba(0, 234, 255, 0.3);
    }

    .prefixed-input {
        border: none;
        border-radius: 0;
        background: transparent;
        flex: 1;
        margin: 0;
    }

    .prefixed-input:focus {
        border: none;
        box-shadow: none;
    }

    .prefix-input-group:focus-within {
        border-color: #00eaff;
        box-shadow: 0 0 5px rgba(0, 234, 255, 0.5);
    }

    /* Mobile responsiveness */
    @media (max-width: 1024px) {
        .modal-columns {
            grid-template-columns: 1fr;
            max-height: none;
        }

        .edit-profile-modal-landscape {
            max-width: 90vw;
            max-height: 85vh;
            width: auto;
        }

        .edit-profile-modal {
            padding: 1.5rem;
        }

        .modal-title {
            font-size: 1.5rem;
        }
    }

    @media (max-width: 768px) {
        .edit-profile-modal-backdrop {
            padding: 10px;
        }

        .form-actions {
            flex-direction: column;
        }

        .action-btn, .save-btn {
            width: 100%;
        }
    }
</style>
