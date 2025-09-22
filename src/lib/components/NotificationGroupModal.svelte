<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import UserNotificationContainer from './UserNotificationContainer.svelte';
    import { fetchNotificationsByColumn, markNotificationAsRead } from '$lib/api';
    import { auth } from '$lib/stores/auth';
    import type { NotificationData, GroupedNotifications, NotificationColumn } from '$lib/types/notifications';
    
    const dispatch = createEventDispatcher();

    export let isOpen: boolean = false;
    export let column: NotificationColumn = 'personal';
    export let title: string = '';
    export let notifications: NotificationData[] = [];
    
    let modalElement: HTMLElement;
    let loading: boolean = false;
    let expandedContainers = new Set<string>();

    // Column configuration for modal
    const columnConfig = {
        personal: { 
            title: 'Personal Notifications', 
            icon: '👤',
            description: 'All your personal notifications in detail'
        },
        favorites: { 
            title: 'Favorites', 
            icon: '⭐',
            description: 'Updates from your favorite users, posts, and locations'
        },
        location: { 
            title: 'Location Activity', 
            icon: '📍',
            description: 'Activity and updates in your area'
        },
        buddies: { 
            title: 'Buddy Activities', 
            icon: '👥',
            description: 'What your buddies are up to'
        },
        connections: { 
            title: 'Connection Updates', 
            icon: '🤝',
            description: 'Your connection activities and requests'
        }
    };

    $: config = columnConfig[column as keyof typeof columnConfig] || columnConfig.personal;
    $: modalTitle = title || config.title;
    $: groupedNotifications = groupNotificationsByUser(notifications);
    $: totalUnread = notifications.filter(n => !n.readStatus).length;

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

    function handleClose() {
        isOpen = false;
        dispatch('close');
    }

    function handleBackdropClick(event: MouseEvent): void {
        if (event.target === modalElement) {
            handleClose();
        }
    }

    function handleKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            handleClose();
        }
    }

    async function handleMarkAllAsRead() {
        if (!$auth?.token) return;
        
        try {
            loading = true;
            
            // Mark all as read locally first
            notifications = notifications.map(n => ({ ...n, readStatus: true }));
            
            // TODO: Call API to mark all as read for this column
            // await markAllColumnNotificationsAsRead(column, $auth.token);
            
            dispatch('notifications-updated', { 
                column, 
                notifications,
                unreadCount: 0
            });
            
        } catch (error) {
            console.error('Error marking all as read:', error);
            // Revert on error
            notifications = notifications.map(n => ({ ...n, readStatus: false }));
        } finally {
            loading = false;
        }
    }

    async function handleRefresh() {
        if (!$auth?.token) return;
        
        try {
            loading = true;
            
            const result = await fetchNotificationsByColumn(column, $auth.token, {
                limit: 50, // Get more in modal view
                includeGrouped: true
            });
            
            if (result.notifications) {
                notifications = result.notifications;
                dispatch('notifications-updated', { 
                    column, 
                    notifications,
                    unreadCount: result.unreadCount || 0
                });
            }
        } catch (error) {
            console.error('Error refreshing notifications:', error);
        } finally {
            loading = false;
        }
    }

    function handleNotificationClick(event: CustomEvent): void {
        const { notification } = event.detail;
        
        // Mark as read
        if (!notification.readStatus) {
            notification.readStatus = true;
            notifications = notifications;
            
            dispatch('notifications-updated', { 
                column, 
                notifications,
                unreadCount: notifications.filter(n => !n.readStatus).length
            });
        }
        
        // Close modal and dispatch for navigation
        handleClose();
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

    function handleExpandAll() {
        expandedContainers = new Set(groupedNotifications.map(g => g.senderEmail));
    }

    function handleCollapseAll() {
        expandedContainers = new Set();
    }
</script>

{#if isOpen}
    <!-- Modal Backdrop -->
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div 
        class="modal-backdrop" 
        bind:this={modalElement}
        on:click={handleBackdropClick}
        on:keydown={handleKeydown}
        transition:fade={{ duration: 200 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
    >
        <!-- Modal Content -->
        <div 
            class="modal-content"
            transition:scale={{ 
                duration: 250, 
                opacity: 0.8, 
                start: 0.95,
                easing: quintOut 
            }}
        >
            <!-- Modal Header -->
            <div class="modal-header">
                <div class="header-info">
                    <div class="header-title">
                        <span class="title-icon">{config.icon}</span>
                        <h2 id="modal-title">{modalTitle}</h2>
                        {#if totalUnread > 0}
                            <span class="unread-badge">{totalUnread}</span>
                        {/if}
                    </div>
                    <p class="header-description">{config.description}</p>
                </div>
                
                <div class="header-actions">
                    <button 
                        class="action-btn secondary"
                        on:click={handleRefresh}
                        disabled={loading}
                        title="Refresh notifications"
                    >
                        <svg 
                            class="icon" 
                            class:spinning={loading}
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                        >
                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                        </svg>
                        Refresh
                    </button>
                    
                    {#if totalUnread > 0}
                        <button 
                            class="action-btn primary"
                            on:click={handleMarkAllAsRead}
                            disabled={loading}
                        >
                            Mark All Read
                        </button>
                    {/if}
                    
                    <button 
                        class="close-btn"
                        on:click={handleClose}
                        title="Close modal"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Modal Body -->
            <div class="modal-body">
                {#if loading && notifications.length === 0}
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <span>Loading notifications...</span>
                    </div>
                {:else if groupedNotifications.length === 0}
                    <div class="empty-state">
                        <span class="empty-icon">{config.icon}</span>
                        <h3>No notifications yet</h3>
                        <p>{config.description}</p>
                        <button class="action-btn primary" on:click={handleRefresh}>
                            Check for updates
                        </button>
                    </div>
                {:else}
                    <!-- Bulk Actions -->
                    <div class="bulk-actions">
                        <span class="notification-count">
                            {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                            {#if totalUnread > 0}
                                • {totalUnread} unread
                            {/if}
                        </span>
                        <div class="expand-actions">
                            <button class="expand-btn" on:click={handleExpandAll}>
                                Expand All
                            </button>
                            <button class="expand-btn" on:click={handleCollapseAll}>
                                Collapse All
                            </button>
                        </div>
                    </div>

                    <!-- Notifications List -->
                    <div class="notifications-container">
                        {#each groupedNotifications as group (group.senderEmail)}
                            <UserNotificationContainer
                                notifications={group.notifications}
                                senderUsername={group.senderUsername}
                                senderEmail={group.senderEmail}
                                profileImageUrl={group.profileImageUrl}
                                isExpanded={expandedContainers.has(group.senderEmail)}
                                on:notification-click={handleNotificationClick}
                                on:expand-toggle={handleExpandToggle}
                            />
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    }

    .modal-content {
        background: white;
        border-radius: 16px;
        width: 100%;
        max-width: 800px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        overflow: hidden;
    }

    .modal-header {
        padding: 24px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
    }

    .header-info {
        flex: 1;
    }

    .header-title {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
    }

    .title-icon {
        font-size: 24px;
    }

    #modal-title {
        font-size: 20px;
        font-weight: 700;
        color: #111827;
        margin: 0;
    }

    .unread-badge {
        background: #ef4444;
        color: white;
        font-size: 12px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 12px;
        min-width: 20px;
        text-align: center;
    }

    .header-description {
        color: #6b7280;
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .action-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
    }

    .action-btn.primary {
        background: #3b82f6;
        color: white;
    }

    .action-btn.primary:hover:not(:disabled) {
        background: #2563eb;
    }

    .action-btn.secondary {
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #e5e7eb;
    }

    .action-btn.secondary:hover:not(:disabled) {
        background: #e5e7eb;
    }

    .action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #6b7280;
        padding: 8px;
        border-radius: 8px;
        transition: all 0.2s ease;
    }

    .close-btn:hover {
        background: #f3f4f6;
        color: #374151;
    }

    .icon.spinning {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 0;
    }

    .loading-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        gap: 16px;
    }

    .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #f3f4f6;
        border-top: 3px solid #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    .empty-icon {
        font-size: 48px;
        opacity: 0.6;
    }

    .empty-state h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #374151;
    }

    .empty-state p {
        margin: 0;
        color: #6b7280;
        line-height: 1.5;
    }

    .bulk-actions {
        padding: 16px 24px;
        border-bottom: 1px solid #f3f4f6;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #f9fafb;
    }

    .notification-count {
        color: #6b7280;
        font-size: 14px;
    }

    .expand-actions {
        display: flex;
        gap: 8px;
    }

    .expand-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #3b82f6;
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s ease;
    }

    .expand-btn:hover {
        background: #dbeafe;
    }

    .notifications-container {
        padding: 16px 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
        .modal-backdrop {
            padding: 12px;
        }

        .modal-content {
            max-height: 95vh;
        }

        .modal-header {
            padding: 16px;
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
        }

        .header-actions {
            justify-content: flex-end;
        }

        .header-title {
            flex-wrap: wrap;
        }

        #modal-title {
            font-size: 18px;
        }

        .bulk-actions {
            padding: 12px 16px;
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
        }

        .expand-actions {
            justify-content: center;
        }

        .notifications-container {
            padding: 12px 16px;
        }

        .loading-state,
        .empty-state {
            padding: 32px 16px;
        }

        .action-btn {
            font-size: 13px;
            padding: 6px 12px;
        }
    }

    /* Custom scrollbar */
    .modal-body::-webkit-scrollbar {
        width: 8px;
    }

    .modal-body::-webkit-scrollbar-track {
        background: #f1f5f9;
    }

    .modal-body::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
    }

    .modal-body::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }
</style>
