<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import UserNotificationContainer from './UserNotificationContainer.svelte';
    import { fetchNotificationsByColumn, refreshNotificationColumn, markColumnAsOpened } from '$lib/api';
    import { auth } from '$lib/stores/auth';
    import { goto } from '$app/navigation';
    import type { NotificationData, GroupedNotifications, NotificationColumn } from '$lib/types/notifications';

    const dispatch = createEventDispatcher();

    export let column: NotificationColumn = 'personal';
    export let title: string = '';
    export let unreadCount: number = 0;
    export let isActive: boolean = false;
    export let hasSettings: boolean = false;
    export let isLive: boolean = false; // For real-time updates
    export let hideHeader: boolean = false; // Hide the column header (for external header control)

    let notifications: NotificationData[] = [];
    let loading: boolean = true;
    let error: string = '';
    let expandedContainers = new Set<string>();
    let refreshInterval: number | null = null;
    let lastRefresh: number = 0;

    // Column configuration
    const columnConfig = {
        personal: { 
            title: 'Personal', 
            icon: '👤', 
            refreshRate: 0, // Live updates
            description: 'Your personal notifications',
            hasSettings: false
        },
        favorites: { 
            title: 'Favorites', 
            icon: '⭐', 
            refreshRate: 30000, // 30 seconds
            description: 'Updates from your favorites',
            hasSettings: true
        },
        location: { 
            title: 'Location', 
            icon: '📍', 
            refreshRate: 60000, // 1 minute
            description: 'Activity in your area',
            hasSettings: false
        },
        buddies: { 
            title: 'Buddies', 
            icon: '👥', 
            refreshRate: 45000, // 45 seconds
            description: 'Updates from your buddies',
            hasSettings: false
        },
        connections: { 
            title: 'Connections', 
            icon: '🤝', 
            refreshRate: 60000, // 1 minute
            description: 'Connection activities',
            hasSettings: false
        }
    };

    $: config = columnConfig[column as keyof typeof columnConfig] || columnConfig.personal;
    $: displayTitle = title || `${config.title} ${unreadCount > 0 ? `(${unreadCount})` : ''}`;
    $: groupedNotifications = groupNotificationsByUser(notifications);

    function groupNotificationsByUser(notifs: NotificationData[]): GroupedNotifications[] {
        const groups: { [key: string]: GroupedNotifications } = {};
        
        notifs.forEach(notification => {
            const key = notification.senderEmail || 'system';
            if (!groups[key]) {
                groups[key] = {
                    senderEmail: notification.senderEmail || 'system',
                    senderUsername: notification.senderUsername || 'System',
                    profileImageUrl: notification.profileImageUrl || '',
                    notifications: []
                };
            }
            groups[key].notifications.push(notification);
        });

        // Sort groups by most recent notification
        return Object.values(groups).sort((a, b) => {
            const aLatest = Math.max(...a.notifications.map((n: NotificationData) => n.timestamp));
            const bLatest = Math.max(...b.notifications.map((n: NotificationData) => n.timestamp));
            return bLatest - aLatest;
        });
    }

    async function loadNotifications() {
        if (!$auth?.token) return;
        
        try {
            loading = true;
            error = '';
            
            const result = await fetchNotificationsByColumn(column, $auth.token, {
                limit: 30,
                includeGrouped: true
            });
            
            if (result.notifications) {
                notifications = result.notifications;
                
                // Update unread count from API response
                if (result.unreadCount !== undefined) {
                    dispatch('unread-count-change', { 
                        column, 
                        count: result.unreadCount 
                    });
                }
                
                lastRefresh = Date.now();
            }
        } catch (err) {
            console.error(`Error loading ${column} notifications:`, err);
            error = `Failed to load ${column} notifications`;
        } finally {
            loading = false;
        }
    }

    async function handleRefresh() {
        if (!$auth?.token) return;
        
        try {
            const result = await refreshNotificationColumn(column, $auth.token);
            if (result.notifications) {
                notifications = result.notifications;
                dispatch('unread-count-change', { 
                    column, 
                    count: result.unreadCount || 0 
                });
            }
        } catch (err) {
            console.error(`Error refreshing ${column} notifications:`, err);
        }
    }

    async function handlePullToRefresh() {
        dispatch('pull-refresh-start');
        await handleRefresh();
        dispatch('pull-refresh-end');
    }

    function setupAutoRefresh() {
        // Clear any existing interval first
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }

        const rate = config.refreshRate;
        if (rate > 0 && isActive && !refreshInterval) {
            refreshInterval = window.setInterval(() => {
                const timeSinceRefresh = Date.now() - lastRefresh;
                if (timeSinceRefresh >= rate && !loading) {
                    handleRefresh();
                }
            }, Math.max(rate, 5000)); // Minimum 5 second intervals
        }
    }

    function handleNotificationClick(event: CustomEvent): void {
        const { notification } = event.detail;
        
        // Mark as read
        markNotificationAsRead(notification);
        
        // Navigate based on action
        if (notification.actionUrl) {
            goto(notification.actionUrl);
        } else if (notification.type === 'message' && notification.relatedEntityId) {
            goto(`/messages/${notification.relatedEntityId}`);
        } else if (notification.relatedEntityId && notification.contentType === 'post') {
            goto(`/posts/${notification.relatedEntityId}`);
        }
        
        dispatch('notification-click', { notification, column });
    }

    function handleExpandToggle(event: CustomEvent): void {
        const { isExpanded, senderEmail } = event.detail;
        
        if (isExpanded) {
            expandedContainers.add(senderEmail);
        } else {
            expandedContainers.delete(senderEmail);
        }
        expandedContainers = expandedContainers; // Trigger reactivity
    }

    function handleHeaderClick() {
        dispatch('header-click', { column });
    }

    function handleSettingsClick() {
        dispatch('settings-click', { column });
    }

    async function markNotificationAsRead(notification: NotificationData): Promise<void> {
        if (notification.readStatus) return;
        
        try {
            // Update locally first for immediate feedback
            notification.readStatus = true;
            notifications = notifications;
            
            // Update unread count
            const newUnreadCount = notifications.filter(n => !n.readStatus).length;
            dispatch('unread-count-change', { column, count: newUnreadCount });
            
            // Call API to mark as read
            if ($auth?.token && notification.notificationId) {
                await import('$lib/api').then(api => 
                    api.markNotificationAsRead(notification.notificationId, $auth.token || '')
                );
            }
        } catch (err) {
            console.error('Error marking notification as read:', err);
            // Revert on error
            notification.readStatus = false;
            notifications = notifications;
        }
    }

    onMount(async () => {
        if (isActive) {
            await loadNotifications();
            
            // Mark column as opened for retention management
            if ($auth?.token) {
                try {
                    console.log(`NotificationColumn: Attempting to mark ${column} column as opened`);
                    await markColumnAsOpened(column, $auth.token);
                    console.log(`NotificationColumn: Successfully marked ${column} column as opened`);
                } catch (err) {
                    console.error(`NotificationColumn: Error marking ${column} column as opened:`, err);
                    // Don't throw - this shouldn't break the UI
                }
            }
        }
    });

    let hasInitialized = false;
    
    $: if (isActive && !hasInitialized) {
        hasInitialized = true;
        setupAutoRefresh();
        if (notifications.length === 0 && !loading) {
            loadNotifications();
        }
    } else if (!isActive && refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }

    onDestroy(() => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });
</script>

<div class="notification-column" class:active={isActive}>
    <!-- Column Header -->
    {#if !hideHeader}
    <div 
        class="column-header" 
        on:click={handleHeaderClick} 
        on:keydown={(e) => e.key === 'Enter' && handleHeaderClick()}
        role="button" 
        tabindex="0"
    >
        <div class="header-content">
            <div class="column-info">
                <span class="column-icon">{config.icon}</span>
                <span class="column-title">{displayTitle}</span>
            </div>
            <div class="header-actions">
                {#if hasSettings || config.hasSettings}
                    <button 
                        class="settings-btn" 
                        on:click|stopPropagation={handleSettingsClick}
                        title="Column Settings"
                    >
                        ⚙️
                    </button>
                {/if}
                <button 
                    class="refresh-btn" 
                    on:click|stopPropagation={handleRefresh}
                    title="Refresh"
                    disabled={loading}
                >
                    <svg 
                        class="refresh-icon" 
                        class:spinning={loading}
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="currentColor"
                    >
                        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                </button>
            </div>
        </div>
    </div>
    {/if}

    <!-- Column Content -->
    <div class="column-content">
        {#if loading && notifications.length === 0}
            <div class="loading-state" transition:fade>
                <div class="loading-spinner"></div>
                <span>Loading {config.title.toLowerCase()} notifications...</span>
            </div>
        {:else if error}
            <div class="error-state" transition:fade>
                <span class="error-icon">⚠️</span>
                <span class="error-message">{error}</span>
                <button class="retry-btn" on:click={loadNotifications}>
                    Try Again
                </button>
            </div>
        {:else if groupedNotifications.length === 0}
            <div class="empty-state" transition:fade>
                <span class="empty-icon">{config.icon}</span>
                <span class="empty-message">No {config.title.toLowerCase()} notifications yet</span>
                <span class="empty-description">{config.description}</span>
            </div>
        {:else}
            <div class="notifications-list">
                {#each groupedNotifications as group (group.senderEmail)}
                    <div transition:fly={{ y: 20, duration: 200 }}>
                        <UserNotificationContainer
                            notifications={group.notifications}
                            senderUsername={group.senderUsername}
                            senderEmail={group.senderEmail}
                            profileImageUrl={group.profileImageUrl}
                            isExpanded={expandedContainers.has(group.senderEmail)}
                            on:notification-click={handleNotificationClick}
                            on:expand-toggle={handleExpandToggle}
                        />
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Pull to refresh indicator (for mobile) -->
    {#if isActive}
        <div class="pull-refresh-area" on:touchstart={handlePullToRefresh}>
            <!-- Pull to refresh functionality will be handled by parent -->
        </div>
    {/if}
</div>

<style>
    .notification-column {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: linear-gradient(135deg, #222 0%, #1a1a1a 100%);
        border-radius: 12px;
        border: 1px solid #333;
        overflow: hidden;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
    }

    .notification-column::before {
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

    .notification-column:hover::before {
        transform: translateX(100%);
    }

    .notification-column.active {
        border-color: #00eaff;
        box-shadow: 
            0 8px 30px rgba(0, 234, 255, 0.3),
            0 0 0 1px rgba(0, 234, 255, 0.1);
        transform: translateY(-2px);
    }

    .column-header {
        background: linear-gradient(135deg, #333 0%, #2a2a2a 100%);
        padding: 16px;
        border-bottom: 1px solid #444;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .column-header:hover {
        background: linear-gradient(135deg, #444 0%, #333 100%);
        border-bottom-color: #00eaff;
    }

    .header-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .column-info {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .column-icon {
        font-size: 18px;
    }

    .column-title {
        font-weight: 600;
        color: #00eaff;
        font-size: 16px;
        text-shadow: 0 0 8px rgba(0, 234, 255, 0.3);
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .settings-btn,
    .refresh-btn {
        background: none;
        border: 1px solid transparent;
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        color: #8892b0;
        transition: all 0.3s ease;
    }

    .settings-btn:hover,
    .refresh-btn:hover {
        background-color: rgba(0, 234, 255, 0.1);
        border-color: #00eaff;
        color: #00eaff;
        box-shadow: 0 0 8px rgba(0, 234, 255, 0.2);
    }

    .settings-btn:disabled,
    .refresh-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .refresh-icon {
        transition: transform 0.2s ease;
    }

    .refresh-icon.spinning {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .column-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .loading-state,
    .error-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 16px;
        text-align: center;
        color: #8892b0;
        gap: 12px;
    }

    .loading-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid #333;
        border-top: 2px solid #00eaff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        box-shadow: 0 0 10px rgba(0, 234, 255, 0.3);
    }

    .error-icon,
    .empty-icon {
        font-size: 32px;
        opacity: 0.6;
    }

    .error-message,
    .empty-message {
        font-weight: 500;
        color: #475569;
    }

    .empty-description {
        font-size: 14px;
        color: #64748b;
    }

    .retry-btn {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s ease;
    }

    .retry-btn:hover {
        background: #2563eb;
    }

    .notifications-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .pull-refresh-area {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 50px;
        pointer-events: none;
    }

    /* Mobile Responsive */
    @media (max-width: 640px) {
        .column-header {
            padding: 12px;
        }

        .column-title {
            font-size: 14px;
        }

        .column-icon {
            font-size: 16px;
        }

        .column-content {
            padding: 12px;
        }

        .loading-state,
        .error-state,
        .empty-state {
            padding: 24px 12px;
        }

        .empty-icon,
        .error-icon {
            font-size: 24px;
        }
    }

    /* Custom scrollbar */
    .column-content::-webkit-scrollbar {
        width: 6px;
    }

    .column-content::-webkit-scrollbar-track {
        background: transparent;
    }

    .column-content::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
    }

    .column-content::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }
</style>
