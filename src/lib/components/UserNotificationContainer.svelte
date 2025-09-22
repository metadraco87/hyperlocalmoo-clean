<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fade, slide } from 'svelte/transition';
    import * as api from '$lib/api';
    import { auth } from '$lib/stores/auth';
    import type { NotificationData } from '$lib/types/notifications';
    
    const dispatch = createEventDispatcher();

    export let notifications: NotificationData[] = [];
    export let senderUsername: string = '';
    export let senderEmail: string = '';
    export let profileImageUrl: string = '';
    export let isExpanded: boolean = false;
    export let showExpandButton: boolean = true;

    // Calculate summary info
    $: messageCount = notifications.filter(n => n.type === 'message').length;
    $: otherCount = notifications.filter(n => n.type !== 'message').length;
    $: totalCount = notifications.length;
    $: hasUnread = notifications.some(n => !n.readStatus);
    $: oldestTime = Math.min(...notifications.map(n => n.timestamp));

    function formatTimeAgo(timestamp: number): string {
        const now = Date.now();
        const diff = now - timestamp;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (hours < 1) return 'now';
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    function handleNotificationClick(notification: NotificationData): void {
        // Don't navigate for buddy requests - they need accept/reject actions
        if (notification.type === 'buddy_request') {
            return;
        }
        dispatch('notification-click', { notification });
    }

    async function handleAcceptBuddyRequest(notification: NotificationData, event: Event) {
        event.stopPropagation();
        try {
            await api.acceptBuddyRequest(notification.senderEmail, $auth.token);
            // Remove the notification from the list (or mark it as handled)
            dispatch('buddy-request-accepted', { notification });
        } catch (error) {
            console.error('Error accepting buddy request:', error);
        }
    }

    async function handleRejectBuddyRequest(notification: NotificationData, event: Event) {
        event.stopPropagation();
        try {
            await api.rejectBuddyRequest(notification.senderEmail, $auth.token);
            // Remove the notification from the list (or mark it as handled)
            dispatch('buddy-request-rejected', { notification });
        } catch (error) {
            console.error('Error rejecting buddy request:', error);
        }
    }

    function handleExpandToggle() {
        isExpanded = !isExpanded;
        dispatch('expand-toggle', { isExpanded, senderEmail });
    }

    function getNotificationIcon(type: string): string {
        const iconMap: { [key: string]: string } = {
            'message': '💬',
            'post_starred': '⭐',
            'post_commented': '💭',
            'post_reposted': '🔄',
            'post_featured': '🌟',
            'tag': '🏷️',
            'new_connection': '🤝',
            'new_buddy': '👥',
            'buddy_request': '🤝💙',
            'favorite_added': '❤️',
            'account_verification': '✅',
            'buddy_posted': '📝',
            'location_new_posts': '📍'
        };
        return iconMap[type] || '🔔';
    }

    function getActionText(notification: NotificationData): string {
        const actionMap: { [key: string]: string } = {
            'message': 'sent you a message',
            'post_starred': 'starred your post',
            'post_commented': 'commented on your post',
            'post_reposted': 'reposted your post',
            'post_featured': 'featured your post',
            'tag': 'tagged you in a post',
            'new_connection': 'connected with you',
            'new_buddy': 'became your buddy',
            'buddy_request': 'wants to add you as a buddy',
            'favorite_added': 'added you to favorites'
        };
        return actionMap[notification.type] || 'interacted with you';
    }
</script>

<div class="user-notification-container" class:has-unread={hasUnread} class:expanded={isExpanded}>
    <!-- Container Header -->
            <div 
            class="container-header" 
            on:click={handleExpandToggle} 
            on:keydown={(e) => e.key === 'Enter' && handleExpandToggle()}
            role="button" 
            tabindex="0"
        >
        <div class="user-info">
            <img 
                src={profileImageUrl || '/default-avatar.png'} 
                alt={`${senderUsername} profile`}
                class="profile-image"
                loading="lazy"
            />
            <div class="user-details">
                <span class="username">@{senderUsername}</span>
                <div class="notification-summary">
                    {#if messageCount > 0 && otherCount > 0}
                        {messageCount} message{messageCount > 1 ? 's' : ''}, {otherCount} notification{otherCount > 1 ? 's' : ''}
                    {:else if messageCount > 0}
                        {messageCount} message{messageCount > 1 ? 's' : ''}
                    {:else}
                        {otherCount} notification{otherCount > 1 ? 's' : ''}
                    {/if}
                </div>
            </div>
        </div>
        <div class="container-meta">
            <span class="timestamp">{formatTimeAgo(oldestTime)}</span>
            {#if showExpandButton}
                <button class="expand-btn" class:rotated={isExpanded}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                    </svg>
                </button>
            {/if}
        </div>
    </div>

    <!-- Expanded Content -->
    {#if isExpanded && notifications.length > 0}
        <div class="notification-list" transition:slide={{ duration: 200 }}>
            {#each notifications as notification (notification.notificationId)}
                <div 
                    class="notification-item" 
                    class:unread={!notification.readStatus}
                    on:click={() => handleNotificationClick(notification)}
                    on:keydown={(e) => e.key === 'Enter' && handleNotificationClick(notification)}
                    role="button"
                    tabindex="0"
                    transition:fade={{ duration: 150 }}
                >
                    <div class="notification-icon">
                        {getNotificationIcon(notification.type)}
                    </div>
                    <div class="notification-content">
                        <div class="notification-text">
                            {#if notification.isGrouped && notification.groupCount > 1}
                                {notification.message}
                            {:else}
                                {getActionText(notification)}
                            {/if}
                        </div>
                        <div class="notification-meta">
                            <span class="notification-time">{formatTimeAgo(notification.timestamp)}</span>
                            {#if notification.contentSnippet}
                                <span class="content-snippet">"{notification.contentSnippet.substring(0, 50)}..."</span>
                            {/if}
                        </div>
                        
                        <!-- Buddy Request Actions -->
                        {#if notification.type === 'buddy_request'}
                            <div class="buddy-request-actions">
                                <button 
                                    class="buddy-action-btn accept-btn"
                                    on:click={(e) => handleAcceptBuddyRequest(notification, e)}
                                    title="Accept buddy request"
                                >
                                    ✓ Accept
                                </button>
                                <button 
                                    class="buddy-action-btn reject-btn"
                                    on:click={(e) => handleRejectBuddyRequest(notification, e)}
                                    title="Reject buddy request"
                                >
                                    ✗ Reject
                                </button>
                            </div>
                        {/if}
                    </div>
                    {#if !notification.readStatus}
                        <div class="unread-indicator"></div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .user-notification-container {
        background: white;
        border-radius: 12px;
        border: 1px solid #e5e7eb;
        margin-bottom: 8px;
        overflow: hidden;
        transition: all 0.2s ease;
    }

    .user-notification-container:hover {
        border-color: #d1d5db;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .user-notification-container.has-unread {
        border-left: 4px solid #3b82f6;
        background: #fefefe;
    }

    .user-notification-container.expanded {
        border-color: #3b82f6;
    }

    .container-header {
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .container-header:hover {
        background-color: #f9fafb;
    }

    .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
    }

    .profile-image {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #e5e7eb;
    }

    .user-details {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .username {
        font-weight: 600;
        color: #1f2937;
        font-size: 14px;
    }

    .notification-summary {
        font-size: 12px;
        color: #6b7280;
    }

    .container-meta {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .timestamp {
        font-size: 11px;
        color: #9ca3af;
    }

    .expand-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #6b7280;
        transition: transform 0.2s ease;
        padding: 4px;
        border-radius: 4px;
    }

    .expand-btn:hover {
        background-color: #f3f4f6;
        color: #374151;
    }

    .expand-btn.rotated {
        transform: rotate(180deg);
    }

    .notification-list {
        border-top: 1px solid #f3f4f6;
        background: #f9fafb;
    }

    .notification-item {
        padding: 10px 16px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        cursor: pointer;
        transition: background-color 0.2s ease;
        position: relative;
    }

    .notification-item:hover {
        background-color: #f3f4f6;
    }

    .notification-item:not(:last-child) {
        border-bottom: 1px solid #f0f0f0;
    }

    .notification-item.unread {
        background-color: #eff6ff;
    }

    .notification-item.unread:hover {
        background-color: #dbeafe;
    }

    .notification-icon {
        font-size: 16px;
        line-height: 1;
        margin-top: 2px;
    }

    .notification-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .notification-text {
        font-size: 13px;
        color: #374151;
        line-height: 1.4;
    }

    .notification-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .notification-time {
        font-size: 11px;
        color: #9ca3af;
    }

    .content-snippet {
        font-size: 11px;
        color: #6b7280;
        font-style: italic;
    }

    .unread-indicator {
        width: 8px;
        height: 8px;
        background-color: #3b82f6;
        border-radius: 50%;
        margin-top: 6px;
        flex-shrink: 0;
    }

    /* Mobile Responsiveness */
    @media (max-width: 640px) {
        .container-header {
            padding: 10px 12px;
        }

        .profile-image {
            width: 36px;
            height: 36px;
        }

        .username {
            font-size: 13px;
        }

        .notification-summary {
            font-size: 11px;
        }

        .notification-item {
            padding: 8px 12px;
        }

        .notification-text {
            font-size: 12px;
        }
    }

    /* Buddy Request Action Buttons */
    .buddy-request-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
    }

    .buddy-action-btn {
        padding: 4px 12px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .accept-btn {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
    }

    .accept-btn:hover {
        background: linear-gradient(135deg, #059669, #047857);
        transform: translateY(-1px);
    }

    .reject-btn {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: white;
    }

    .reject-btn:hover {
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        transform: translateY(-1px);
    }
</style>
