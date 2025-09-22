// Consolidated Post and Comment type definitions

export interface Post {
    id: string;
    userId?: string;
    username?: string;
    ownerUsername?: string;
    ownerEmail?: string;
    headline?: string;
    content?: string;
    title?: string;
    details?: string;
    imageUrl?: string;
    mediaUrl?: string;
    link?: string;
    category?: string;
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
    geohash?: string;
    locationName?: string;
    fenceName?: string;
    createdAt: number;
    updatedAt?: number;
    profileImageUrl?: string;
    hasExactLocation?: boolean;
    location?: {
        name: string;
        lat: number;
        lng: number;
        zoom?: number | null;
        bounds?: { north: number; east: number; south: number; west: number } | null;
        locationType?: string;
    };
    tags?: string[];
    views?: number;
    clicks?: number;
    stars?: number;
    starsCount?: number;
    commentsCount?: number;
    featuredInLocationUntil?: number;
    featuredInSearchUntil?: number;
    featuredBy?: string;
    // Repost fields
    originalPostId?: string | null;
    isRepost?: boolean;
    originalAuthor?: string;
    originalUsername?: string;
    originalPost?: Post;
    // Tagged users
    taggedUserIds?: string[];
    taggedUsersDetailed?: Array<{ userId: string; username: string; start: number; end: number }>;
}

export interface Comment {
    commentId: string;
    postId: string;
    userEmail: string;
    username: string;
    content: string;
    createdAt: number;
    parentCommentId?: string;
    repliesCount?: number;
    profileImageUrl?: string;
    taggedUserIds?: string[];
    taggedUsersDetailed?: Array<{ userId: string; username: string; start: number; end: number }>;
}
