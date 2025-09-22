// Notification Type Definitions

export interface NotificationData {
    notificationId: string;
    type: string;
    category: string;
    message: string;
    senderEmail?: string;
    senderUsername?: string;
    relatedEntityId?: string;
    contentType?: string;
    contentSnippet?: string;
    fenceName?: string;
    locationName?: string;
    
    // Grouping and organization fields
    priority: number;
    column: string;
    groupCount: number;
    isGrouped: boolean;
    groupDisplayUsers: string[];
    
    // User relationship context
    isBuddy: boolean;
    isConnection: boolean;
    isLocationBased: boolean;
    isFavoriteRelated: boolean;
    
    // Action metadata
    actionUrl?: string;
    actionType?: string;
    iconType?: string;
    colorScheme: string;
    
    // Status
    readStatus: boolean;
    isLive: boolean;
    
    // Timestamps
    timestamp: number;
    createdAt: number;
    readAt?: number;
    expiresAt?: number;
    age?: string;
    
    // Profile data (for display)
    profileImageUrl?: string;
}

export interface GroupedNotifications {
    senderEmail: string;
    senderUsername: string;
    profileImageUrl: string;
    notifications: NotificationData[];
}

export interface ColumnCounts {
    [key: string]: {
        total: number;
        unread: number;
    };
}

export interface ColumnConfig {
    id: string;
    title: string;
    icon: string;
    isLive: boolean;
    hasSettings: boolean;
    refreshRate?: number;
    description?: string;
}

export type NotificationColumn = 'personal' | 'favorites' | 'location' | 'buddies' | 'connections';

export interface NotificationResponse {
    notifications: NotificationData[];
    column?: string;
    count: number;
    unreadCount: number;
    code: string;
}

export interface ColumnCountsResponse {
    columnCounts: ColumnCounts;
    code: string;
}
