<script>
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { fly } from 'svelte/transition';
    import { auth } from '$lib/stores/auth';
    import { get } from 'svelte/store';
    import { clearCache } from '$lib/cache';
    
    // Import new notification components
    import NotificationColumn from '$lib/components/NotificationColumn.svelte';
    import NotificationGroupModal from '$lib/components/NotificationGroupModal.svelte';
    import { fetchNotificationColumnCounts, createWelcomeNotification } from '$lib/api';
    
    // Import existing messages component
    import MessagesOverlay from '$lib/components/MessagesOverlay.svelte';

    // State management
    let currentColumn = 'personal';
    let columnCounts = {
        personal: { total: 0, unread: 0 },
        favorites: { total: 0, unread: 0 },
        location: { total: 0, unread: 0 },
        buddies: { total: 0, unread: 0 },
        connections: { total: 0, unread: 0 }
    };
    let showModal = false;
    let modalColumn = '';
    let modalNotifications = [];
    
    // Mobile state
    let isMobile = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwipeMode = false;
    
    // Existing messages state
    let showMessagesOverlay = false;
    let selectedConversation = null;
    
    // Live update interval for personal column
    let liveUpdateInterval = null;

    // Column definitions with collapsible state
    const columns = [
        { 
            id: 'personal', 
            title: 'Personal', 
            icon: '',
            isLive: true,
            hasSettings: false,
            collapsed: false // Always expanded for personal
        },
        { 
            id: 'favorites', 
            title: 'Favorites', 
            icon: '',
            isLive: false,
            hasSettings: true,
            collapsed: true // Start collapsed
        },
        { 
            id: 'location', 
            title: 'Location', 
            icon: '',
            isLive: false,
            hasSettings: false,
            collapsed: true // Start collapsed
        },
        { 
            id: 'buddies', 
            title: 'Buddies', 
            icon: '',
            isLive: false,
            hasSettings: false,
            collapsed: true // Start collapsed
        },
        { 
            id: 'connections', 
            title: 'Connections', 
            icon: '',
            isLive: false,
            hasSettings: false,
            collapsed: true // Start collapsed
        }
    ];

    // Collapsible state management
    let collapsedColumns = {
        personal: false, // Always visible
        favorites: true,
        location: true,
        buddies: true,
        connections: true
    };

    // Toggle column collapse state
    function toggleColumn(columnId) {
        collapsedColumns[columnId] = !collapsedColumns[columnId];
        collapsedColumns = { ...collapsedColumns }; // Trigger reactivity
    }

    // Auto-expand columns when they receive notifications
    $: {
        // Auto-expand columns with notifications
        Object.keys(columnCounts).forEach(columnId => {
            if (columnCounts[columnId].total > 0) {
                if (collapsedColumns[columnId] === true) {
                    collapsedColumns[columnId] = false;
                    collapsedColumns = { ...collapsedColumns };
                }
            }
        });
    }

    $: activeColumn = columns.find(col => col.id === currentColumn);
    $: totalUnreadCount = Object.values(columnCounts).reduce((sum, col) => sum + col.unread, 0);

    // Responsive detection
    function checkMobile() {
        if (browser) {
            isMobile = window.innerWidth < 768;
        }
    }

    async function loadColumnCounts() {
        if (!$auth?.token) return;
        
        try {
            const result = await fetchNotificationColumnCounts($auth.token);
            if (result.columnCounts) {
                columnCounts = { ...columnCounts, ...result.columnCounts };
            }
        } catch (error) {
            console.error('Error loading column counts:', error);
        }
    }

    function handleColumnChange(columnId) {
        currentColumn = columnId;
        
        // Reset unread count for opened column
        if (columnCounts[columnId]) {
            columnCounts[columnId].unread = 0;
            columnCounts = columnCounts;
        }
    }

    function handleColumnHeaderClick(event) {
        const { column } = event.detail;
        showModal = true;
        modalColumn = column;
        modalNotifications = [];
    }

    function handleNotificationClick(event) {
        const { notification } = event.detail;
        
        // Navigate based on notification action
        if (notification.actionUrl) {
            goto(notification.actionUrl);
        } else if (notification.type === 'message' && notification.relatedEntityId) {
            // Open messages overlay
            selectedConversation = notification.relatedEntityId;
            showMessagesOverlay = true;
        } else if (notification.relatedEntityId) {
            goto(`/posts/${notification.relatedEntityId}`);
        }
    }

    function handleUnreadCountChange(event) {
        const { column, count } = event.detail;
        if (columnCounts[column]) {
            columnCounts[column].unread = count;
            columnCounts = columnCounts;
        }
    }

    function handleSettingsClick(event) {
        const { column } = event.detail;
        console.log(`Opening settings for ${column} column`);
        // TODO: Implement column settings modal
    }

    function openMessagesOverlay() {
        // Open messages overlay without specific conversation
        selectedConversation = null;
        showMessagesOverlay = true;
    }

    function closeModal() {
        showModal = false;
        modalColumn = '';
        modalNotifications = [];
    }

    // Mobile swipe navigation
    function handleTouchStart(event) {
        if (!isMobile) return;
        
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        isSwipeMode = false;
    }

    function handleTouchMove(event) {
        if (!isMobile || !touchStartX) return;
        
        const currentX = event.touches[0].clientX;
        const currentY = event.touches[0].clientY;
        const diffX = touchStartX - currentX;
        const diffY = Math.abs(touchStartY - currentY);
        
        // Only trigger horizontal swipe if it's more horizontal than vertical
        if (Math.abs(diffX) > 50 && diffY < 100) {
            isSwipeMode = true;
            event.preventDefault();
        }
    }

    function handleTouchEnd(event) {
        if (!isMobile || !isSwipeMode) return;
        
        const endX = event.changedTouches[0].clientX;
        const diffX = touchStartX - endX;
        
        if (Math.abs(diffX) > 80) {
            const currentIndex = columns.findIndex(col => col.id === currentColumn);
            
            if (diffX > 0 && currentIndex < columns.length - 1) {
                // Swipe left - next column
                handleColumnChange(columns[currentIndex + 1].id);
            } else if (diffX < 0 && currentIndex > 0) {
                // Swipe right - previous column
                handleColumnChange(columns[currentIndex - 1].id);
            }
        }
        
        touchStartX = 0;
        touchStartY = 0;
        isSwipeMode = false;
    }

    function setupLiveUpdates() {
        if (liveUpdateInterval) {
            clearInterval(liveUpdateInterval);
        }
        
        // Update counts every 30 seconds
        liveUpdateInterval = setInterval(() => {
            loadColumnCounts();
        }, 30000);
    }

    // Keyboard navigation
    function handleKeydown(event) {
        if (showModal) return;
        
        const currentIndex = columns.findIndex(col => col.id === currentColumn);
        
        if (event.key === 'ArrowLeft' && currentIndex > 0) {
            handleColumnChange(columns[currentIndex - 1].id);
        } else if (event.key === 'ArrowRight' && currentIndex < columns.length - 1) {
            handleColumnChange(columns[currentIndex + 1].id);
        } else if (event.key === 'Enter' || event.key === ' ') {
            handleColumnHeaderClick({ detail: { column: currentColumn } });
        }
    }

    async function createWelcomeNotificationIfNeeded(authState) {
        try {
            // Only create welcome notification if this is the first login
            // Check localStorage for a flag indicating welcome notification was shown
            const welcomeShown = localStorage.getItem('welcomeNotificationShown');
            if (welcomeShown) {
                console.log('Welcome notification already shown, skipping');
                return;
            }
            
            const username = authState.username || authState.email?.split('@')[0] || 'User';
            
            console.log('Creating welcome notification for:', username);
            await createWelcomeNotification(username, authState.token);
            
            // Set flag in localStorage to prevent showing again
            localStorage.setItem('welcomeNotificationShown', 'true');
            
            // Refresh the personal column to show the new notification
            setTimeout(() => {
                loadColumnCounts();
                // Also refresh the personal notification column content
                clearCache();
            }, 1000);
            
        } catch (error) {
            console.error('Error creating welcome notification:', error);
        }
    }

    onMount(async () => {
        if (!browser) return;
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        window.addEventListener('keydown', handleKeydown);
        
        // Wait for auth
        const authState = get(auth);
        if (authState?.token) {
            await loadColumnCounts();
            setupLiveUpdates();
            
            // Check if this is a new user and create welcome notification
            await createWelcomeNotificationIfNeeded(authState);
        }
    });

    onDestroy(() => {
        if (browser) {
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener('keydown', handleKeydown);
        }
        
        if (liveUpdateInterval) {
            clearInterval(liveUpdateInterval);
        }
    });
</script>

<svelte:head>
    <title>Concierge - HyperLocal Moo</title>
    <meta name="description" content="Your personal notification and message center" />
</svelte:head>

<div class="concierge-container">
    <!-- Header -->
    <div class="concierge-header">
        <div class="header-content">
            <div class="header-main">
                <div class="neon-container">
                    <div class="header-title">
                        <h1>UPDATES</h1>
                        {#if totalUnreadCount > 0}
                            <span class="total-unread-badge">{totalUnreadCount}</span>
                        {/if}
                    </div>
                </div>
                <div class="header-description">
                    Your personal notification center
                </div>
            </div>
            <div class="header-actions">
                <button 
                    class="messages-btn"
                    on:click={openMessagesOverlay}
                    title="Open Messages"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    Messages
                </button>
            </div>
        </div>
    </div>

    <!-- Column Navigation (Mobile) -->
    {#if isMobile}
        <div class="mobile-nav">
            <div class="nav-tabs">
                {#each columns as column}
                    <button 
                        class="nav-tab"
                        class:active={currentColumn === column.id}
                        on:click={() => handleColumnChange(column.id)}
                    >
                        <span class="tab-icon">{column.icon}</span>
                        <span class="tab-title">{column.title}</span>
                        {#if columnCounts[column.id]?.unread > 0}
                            <span class="tab-badge">{columnCounts[column.id].unread}</span>
                        {/if}
                    </button>
                {/each}
            </div>
            <div class="swipe-indicator">
                <span>Swipe left/right to navigate columns</span>
            </div>
        </div>
    {/if}

    <!-- Main Content -->
    <div 
        class="notification-container"
        class:mobile={isMobile}
        on:touchstart={handleTouchStart}
        on:touchmove={handleTouchMove}
        on:touchend={handleTouchEnd}
    >
        {#if isMobile}
            <!-- Mobile: Single Column View -->
            <div class="mobile-column-view">
                <NotificationColumn
                    column={currentColumn}
                    title={activeColumn?.title}
                    unreadCount={columnCounts[currentColumn]?.unread || 0}
                    isActive={true}
                    hasSettings={activeColumn?.hasSettings}
                    isLive={activeColumn?.isLive}
                    on:header-click={handleColumnHeaderClick}
                    on:notification-click={handleNotificationClick}
                    on:unread-count-change={handleUnreadCountChange}
                    on:settings-click={handleSettingsClick}
                />
            </div>
        {:else}
            <!-- Desktop: Multi-Column Layout with Collapsible Headers -->
            <div class="desktop-columns">
                <!-- Personal Column (Collapsible like others) -->
                <div class="column-wrapper" class:collapsed={collapsedColumns.personal} class:expanded={!collapsedColumns.personal}>
                    <div class="column-header" on:click={() => toggleColumn('personal')} on:keydown={(e) => {if (e.key === 'Enter' || e.key === ' ') toggleColumn('personal');}} tabindex="0" role="button">
                        <h3 class="column-title">
                            <span class="column-icon">👤</span>
                            Personal
                            {#if columnCounts.personal.total > 0}
                                <span class="column-count">{columnCounts.personal.total}</span>
                            {/if}
                        </h3>
                        <div class="expand-icon" class:expanded={!collapsedColumns.personal}>
                            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                                <polyline points="6,9 12,15 18,9"/>
                            </svg>
                        </div>
                    </div>
                    {#if !collapsedColumns.personal}
                        <div class="column-content" in:fly="{{ y: -20, duration: 400 }}" out:fly="{{ y: -20, duration: 300 }}">
                            <NotificationColumn
                                column="personal"
                                title=""
                                unreadCount={columnCounts.personal.unread || 0}
                                isActive={true}
                                hasSettings={false}
                                isLive={true}
                                hideHeader={true}
                                on:header-click={handleColumnHeaderClick}
                                on:notification-click={handleNotificationClick}
                                on:unread-count-change={handleUnreadCountChange}
                            />
                        </div>
                    {/if}
                </div>

                <!-- Favorites Column -->
                <div class="column-wrapper" class:collapsed={collapsedColumns.favorites} class:expanded={!collapsedColumns.favorites}>
                    <div class="column-header" on:click={() => toggleColumn('favorites')} on:keydown={(e) => {if (e.key === 'Enter' || e.key === ' ') toggleColumn('favorites');}} tabindex="0" role="button">
                        <h3 class="column-title">
                            <span class="column-icon">⭐</span>
                            Favorites
                            {#if columnCounts.favorites.total > 0}
                                <span class="column-count">{columnCounts.favorites.total}</span>
                            {/if}
                        </h3>
                        <div class="expand-icon" class:expanded={!collapsedColumns.favorites}>
                            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                                <polyline points="6,9 12,15 18,9"/>
                            </svg>
                        </div>
                    </div>
                    {#if !collapsedColumns.favorites}
                        <div class="column-content" in:fly="{{ y: -20, duration: 400 }}" out:fly="{{ y: -20, duration: 300 }}">
                            <NotificationColumn
                                column="favorites"
                                title="Favorites"
                                unreadCount={columnCounts.favorites.unread || 0}
                                isActive={true}
                                hasSettings={true}
                                isLive={false}
                                hideHeader={true}
                                on:header-click={handleColumnHeaderClick}
                                on:notification-click={handleNotificationClick}
                                on:unread-count-change={handleUnreadCountChange}
                                on:settings-click={handleSettingsClick}
                            />
                        </div>
                    {/if}
                </div>

                <!-- Location Column Group with Sub-columns -->
                <div class="column-wrapper location-group expanded">
                    <!-- Location Column -->
                    <div class="column-wrapper" class:collapsed={collapsedColumns.location} class:expanded={!collapsedColumns.location}>
                        <div class="column-header" on:click={() => toggleColumn('location')} on:keydown={(e) => {if (e.key === 'Enter' || e.key === ' ') toggleColumn('location');}} tabindex="0" role="button">
                            <h3 class="column-title">
                                <span class="column-icon">📍</span>
                                Location
                                {#if columnCounts.location.total > 0}
                                    <span class="column-count">{columnCounts.location.total}</span>
                                {/if}
                            </h3>
                            <div class="expand-icon" class:expanded={!collapsedColumns.location}>
                                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                                    <polyline points="6,9 12,15 18,9"/>
                                </svg>
                            </div>
                        </div>
                        {#if !collapsedColumns.location}
                            <div class="column-content" in:fly="{{ y: -20, duration: 400 }}" out:fly="{{ y: -20, duration: 300 }}">
                                <NotificationColumn
                                    column="location"
                                    title="Location"
                                    unreadCount={columnCounts.location.unread || 0}
                                                                    isActive={true}
                                hasSettings={false}
                                isLive={false}
                                hideHeader={true}
                                on:header-click={handleColumnHeaderClick}
                                on:notification-click={handleNotificationClick}
                                on:unread-count-change={handleUnreadCountChange}
                                />
                            </div>
                        {/if}
                    </div>
                    
                    <!-- Buddies Sub-column -->
                    <div class="sub-column" class:collapsed={collapsedColumns.buddies} class:expanded={!collapsedColumns.buddies}>
                        <div class="column-header" on:click={() => toggleColumn('buddies')} on:keydown={(e) => {if (e.key === 'Enter' || e.key === ' ') toggleColumn('buddies');}} tabindex="0" role="button">
                            <h3 class="column-title">
                                <span class="column-icon">👥</span>
                                Buddies
                                {#if columnCounts.buddies.total > 0}
                                    <span class="column-count">{columnCounts.buddies.total}</span>
                                {/if}
                            </h3>
                            <div class="expand-icon" class:expanded={!collapsedColumns.buddies}>
                                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                                    <polyline points="6,9 12,15 18,9"/>
                                </svg>
                            </div>
                        </div>
                        {#if !collapsedColumns.buddies}
                            <div class="column-content" in:fly="{{ y: -20, duration: 400 }}" out:fly="{{ y: -20, duration: 300 }}">
                                <NotificationColumn
                                    column="buddies"
                                    title="Buddies"
                                    unreadCount={columnCounts.buddies.unread || 0}
                                                                    isActive={true}
                                hasSettings={false}
                                isLive={false}
                                hideHeader={true}
                                on:header-click={handleColumnHeaderClick}
                                on:notification-click={handleNotificationClick}
                                on:unread-count-change={handleUnreadCountChange}
                                />
                            </div>
                        {/if}
                    </div>

                    <!-- Connections Sub-column -->
                    <div class="sub-column" class:collapsed={collapsedColumns.connections} class:expanded={!collapsedColumns.connections}>
                        <div class="column-header" on:click={() => toggleColumn('connections')} on:keydown={(e) => {if (e.key === 'Enter' || e.key === ' ') toggleColumn('connections');}} tabindex="0" role="button">
                            <h3 class="column-title">
                                <span class="column-icon">🤝</span>
                                Connections
                                {#if columnCounts.connections.total > 0}
                                    <span class="column-count">{columnCounts.connections.total}</span>
                                {/if}
                            </h3>
                            <div class="expand-icon" class:expanded={!collapsedColumns.connections}>
                                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                                    <polyline points="6,9 12,15 18,9"/>
                                </svg>
                            </div>
                        </div>
                        {#if !collapsedColumns.connections}
                            <div class="column-content" in:fly="{{ y: -20, duration: 400 }}" out:fly="{{ y: -20, duration: 300 }}">
                                <NotificationColumn
                                    column="connections"
                                    title="Connections"
                                    unreadCount={columnCounts.connections.unread || 0}
                                                                    isActive={true}
                                hasSettings={false}
                                isLive={false}
                                hideHeader={true}
                                on:header-click={handleColumnHeaderClick}
                                on:notification-click={handleNotificationClick}
                                on:unread-count-change={handleUnreadCountChange}
                                />
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <!-- Notification Group Modal -->
    <NotificationGroupModal
        bind:isOpen={showModal}
        column={modalColumn}
        notifications={modalNotifications}
        on:close={closeModal}
        on:notification-click={handleNotificationClick}
        on:notifications-updated={(event) => {
            const { column, unreadCount } = event.detail;
            handleUnreadCountChange({ detail: { column, count: unreadCount } });
        }}
    />

    <!-- Messages Overlay -->
    <MessagesOverlay
        bind:showOverlay={showMessagesOverlay}
        bind:selectedConversation={selectedConversation}
    />
</div>

<style>
    /* FUTURISTIC BLACK THEME - Your beloved aesthetic! 🖤✨ */
    .concierge-container {
        min-height: 100vh;
        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%);
        padding: 20px;
        position: relative;
        overflow-x: hidden;
        font-family: 'Inter', sans-serif;
    }

    /* Animated background particles */
    .concierge-container::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: 
            radial-gradient(circle at 25% 25%, rgba(0, 234, 255, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 75% 75%, rgba(0, 102, 255, 0.1) 0%, transparent 50%);
        z-index: -1;
        animation: float 20s ease-in-out infinite;
    }

    @keyframes float {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        33% { transform: translateY(-20px) rotate(1deg); }
        66% { transform: translateY(20px) rotate(-1deg); }
    }

    .concierge-header {
        margin-bottom: 24px;
        font-family: 'Inter', sans-serif;
    }

    .header-content {
        max-width: 1400px;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
    }

    .header-main {
        flex: 1;
    }

    .header-actions {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-top: 8px;
    }

    .messages-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #00eaff 0%, #0066cc 100%);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 12px 16px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 234, 255, 0.3);
        font-family: 'Inter', sans-serif;
    }

    .messages-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 234, 255, 0.4);
        background: linear-gradient(135deg, #0066cc 0%, #004499 100%);
    }

    .messages-btn svg {
        width: 20px;
        height: 20px;
        stroke-width: 2;
    }

    .header-title {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
    }

    /* Neon container for UPDATES header */
    .neon-container {
        display: inline-block;
        padding: 12px 24px;
        border: 2px solid #00eaff;
        border-radius: 8px;
        background: transparent;
        box-shadow: 
            0 0 10px rgba(0, 234, 255, 0.3),
            inset 0 0 10px rgba(0, 234, 255, 0.1);
        animation: neonPulse 2s ease-in-out infinite alternate;
    }

    @keyframes neonPulse {
        0% {
            box-shadow: 
                0 0 10px rgba(0, 234, 255, 0.3),
                inset 0 0 10px rgba(0, 234, 255, 0.1);
        }
        100% {
            box-shadow: 
                0 0 20px rgba(0, 234, 255, 0.6),
                inset 0 0 15px rgba(0, 234, 255, 0.2);
        }
    }

    .header-title h1 {
        font-size: 32px;
        font-weight: 700;
        color: #00eaff;
        margin: 0;
        font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
        letter-spacing: 0.1em;
        text-shadow: 
            0 0 10px rgba(0, 234, 255, 0.5),
            0 0 20px rgba(0, 234, 255, 0.3),
            0 0 40px rgba(0, 234, 255, 0.2);
        animation: titleGlow 3s ease-in-out infinite alternate;
    }

    @keyframes titleGlow {
        from { 
            text-shadow: 
                0 0 10px rgba(0, 234, 255, 0.5),
                0 0 20px rgba(0, 234, 255, 0.3),
                0 0 40px rgba(0, 234, 255, 0.2);
        }
        to { 
            text-shadow: 
                0 0 15px rgba(0, 234, 255, 0.7),
                0 0 25px rgba(0, 234, 255, 0.5),
                0 0 50px rgba(0, 234, 255, 0.3);
        }
    }

    .total-unread-badge {
        background: #00eaff;
        color: #000;
        font-size: 14px;
        font-weight: 600;
        padding: 4px 12px;
        border-radius: 16px;
        min-width: 24px;
        text-align: center;
        box-shadow: 0 0 10px #00eaff;
        animation: badgePulse 2s infinite;
    }

    @keyframes badgePulse {
        0%, 100% { box-shadow: 0 0 10px #00eaff; }
        50% { box-shadow: 0 0 15px #00eaff, 0 0 25px rgba(0, 234, 255, 0.5); }
    }

    .header-description {
        color: #8892b0;
        font-size: 16px;
    }

    /* Mobile Navigation */
    .mobile-nav {
        margin-bottom: 16px;
    }

    .nav-tabs {
        display: flex;
        overflow-x: auto;
        gap: 8px;
        padding: 8px 0;
        scrollbar-width: none;
        -ms-overflow-style: none;
    }

    .nav-tabs::-webkit-scrollbar {
        display: none;
    }

    .nav-tab {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 12px 16px;
        background: linear-gradient(135deg, #222 0%, #1a1a1a 100%);
        border: 1px solid #333;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        min-width: 80px;
        position: relative;
        overflow: hidden;
        color: #8892b0;
    }

    .nav-tab::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent 0%, #00eaff 50%, transparent 100%);
        transform: translateX(-100%);
        transition: transform 0.6s ease;
    }

    .nav-tab:hover::before {
        transform: translateX(100%);
    }

    .nav-tab.active {
        background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
        color: #000;
        border-color: #00eaff;
        transform: translateY(-2px);
        box-shadow: 
            0 8px 30px rgba(0, 234, 255, 0.3),
            0 0 0 1px rgba(0, 234, 255, 0.1);
    }

    .nav-tab:hover:not(.active) {
        background: linear-gradient(135deg, #333 0%, #2a2a2a 100%);
        border-color: #00eaff;
        color: #fff;
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(0, 234, 255, 0.2);
    }

    .tab-icon {
        font-size: 18px;
    }

    .tab-title {
        font-size: 12px;
        font-weight: 500;
    }

    .tab-badge {
        position: absolute;
        top: 4px;
        right: 4px;
        background: #00eaff;
        color: #000;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 8px;
        min-width: 16px;
        text-align: center;
        box-shadow: 0 0 8px #00eaff;
        animation: badgePulse 2s infinite;
    }

    .nav-tab.active .tab-badge {
        background: #fbbf24;
        color: #000;
        box-shadow: 0 0 8px #fbbf24;
    }

    .swipe-indicator {
        text-align: center;
        margin-top: 8px;
    }

    .swipe-indicator span {
        color: #8892b0;
        font-size: 12px;
    }

    /* Main Content */
    .notification-container {
        max-width: 1400px;
        margin: 0 auto;
        height: calc(100vh - 140px);
    }

    .mobile-column-view {
        height: 100%;
    }

    .desktop-columns {
        display: grid;
        grid-template-columns: 1fr 1fr 2fr;
        gap: 20px;
        height: 100%;
        align-items: start; /* Changed to start alignment for dynamic sizing */
    }

    .column-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: #222;
        border-radius: 12px;
        border: 1px solid #333;
        overflow: hidden;
        transition: all 0.3s ease;
    }

    .column-wrapper.collapsed {
        height: auto;
        min-height: 60px;
        max-height: 60px;
    }

    .column-wrapper.expanded {
        height: fit-content;
        max-height: calc(100vh - 200px);
        min-height: 200px;
    }

    /* Collapsible Column Header */
    .column-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        border-bottom: 1px solid transparent;
        background: linear-gradient(135deg, rgba(0, 234, 255, 0.1) 0%, rgba(0, 102, 255, 0.1) 100%);
        border-radius: 12px 12px 0 0;
    }

    .column-header:hover {
        background: linear-gradient(135deg, rgba(0, 234, 255, 0.2) 0%, rgba(0, 102, 255, 0.2) 100%);
        border-bottom-color: #00eaff;
        box-shadow: 0 0 20px rgba(0, 234, 255, 0.3);
    }



    .column-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.1rem;
        font-weight: 600;
        color: #00eaff;
        margin: 0;
    }

    .column-icon {
        font-size: 1.2rem;
    }

    .column-count {
        background: rgba(0, 234, 255, 0.2);
        color: #00eaff;
        padding: 2px 8px;
        border-radius: 8px;
        font-size: 0.9rem;
        border: 1px solid #00eaff;
    }

    .expand-icon {
        transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        color: #00eaff;
        font-size: 1.2rem;
    }

    .expand-icon.expanded {
        transform: rotate(180deg);
    }

    .expand-icon svg {
        filter: drop-shadow(0 0 8px rgba(0, 234, 255, 0.5));
    }

    /* Column Content */
    .column-content {
        flex: 1;
        overflow: hidden;
        transition: all 0.3s ease;
    }

    .column-wrapper.collapsed .column-content {
        height: 0;
        opacity: 0;
    }

    .column-wrapper.expanded .column-content {
        height: auto;
        opacity: 1;
    }

    .location-group {
        display: grid;
        grid-template-rows: 1fr auto auto;
        gap: 12px;
        height: 100%;
    }

    .location-group.collapsed {
        height: auto;
        grid-template-rows: auto;
    }

    .sub-column {
        background-color: #1a1a1a;
        border-radius: 8px;
        border: 1px solid #333;
        overflow: hidden;
        transition: all 0.3s ease;
        height: 300px;
    }

    .sub-column.collapsed {
        height: 60px;
        min-height: 60px;
    }

    .sub-column.expanded {
        height: fit-content;
        max-height: 400px;
        min-height: 200px;
    }

    /* Mobile Responsiveness */
    @media (max-width: 767px) {
        .concierge-container {
            padding: 12px;
        }

        .header-title h1 {
            font-size: 24px;
        }

        .header-description {
            font-size: 14px;
        }

        .header-content {
            flex-direction: column;
            gap: 12px;
        }

        .header-actions {
            margin-top: 0;
            align-self: flex-end;
        }

        .messages-btn {
            padding: 10px 14px;
            font-size: 12px;
        }

        .notification-container {
            height: calc(100vh - 200px);
        }
    }

    /* Tablet Layout */
    @media (min-width: 768px) and (max-width: 1024px) {
        .desktop-columns {
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        .location-group {
            grid-column: span 2;
            grid-template-columns: 1fr 1fr 1fr;
            grid-template-rows: 1fr;
        }

        .sub-column {
            height: 100%;
        }
    }

    /* Large Desktop */
    @media (min-width: 1400px) {
        .desktop-columns {
            grid-template-columns: 350px 350px 1fr;
        }
    }

    /* Touch device optimizations */
    @media (hover: none) {
        .nav-tab:hover {
            background: linear-gradient(135deg, #222 0%, #1a1a1a 100%);
            border-color: #333;
            transform: none;
            box-shadow: none;
        }

        .nav-tab.active:hover {
            background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
            border-color: #00eaff;
        }
    }

    /* Futuristic scrollbar styling */
    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }

    ::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb {
        background: #00eaff;
        border-radius: 4px;
        box-shadow: 0 0 10px #00eaff;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: #0066ff;
        box-shadow: 0 0 15px #0066ff;
    }

    /* Loading shimmer effect for future use */
    .loading-shimmer {
        background: linear-gradient(90deg, 
            rgba(0, 234, 255, 0.1) 0%, 
            rgba(0, 234, 255, 0.3) 50%, 
            rgba(0, 234, 255, 0.1) 100%
        );
        background-size: 200% 100%;
        animation: shimmer 2s infinite;
    }

    @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
    }
</style>
