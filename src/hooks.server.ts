import type { Handle } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import * as api from '$lib/api';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    // AWS credentials will be automatically loaded from environment variables
});

// Extend SvelteKit Locals type for auth
declare module '@sveltejs/kit' {
    interface Locals {
        auth: {
            token: string;
            email: string;
            username: string;
        } | null;
    }
}

export const handle: Handle = async ({ event, resolve }) => {
    let token = event.request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
        token = event.cookies.get('token');
    }

    console.log('hooks.server.ts: Token extracted from request:', token ? 'Present' : 'Not found', 'URL:', event.url.pathname, 'Headers:', JSON.stringify([...event.request.headers], null, 2), 'Cookies:', JSON.stringify(event.cookies.getAll(), null, 2));

    if (token) {
        try {
            const user = await api.getUser(token);
            event.locals.auth = {
                token,
                email: user.email,
                username: user.username
            };
            console.log('hooks.server.ts: locals.auth set to:', JSON.stringify(event.locals.auth, null, 2));
        } catch (error) {
            if (error && typeof error === 'object' && 'message' in error) {
                console.error('hooks.server.ts: Failed to validate token:', (error as any).message, 'Token:', token ? 'Present' : 'Not found');
            } else {
                console.error('hooks.server.ts: Failed to validate token:', error, 'Token:', token ? 'Present' : 'Not found');
            }
            event.locals.auth = null;
        }
    } else {
        console.log('hooks.server.ts: No token provided, setting locals.auth to null for URL:', event.url.pathname);
        event.locals.auth = null;
    }

    if (event.url.pathname === '/api/upload' && event.request.method === 'POST') {
        if (!event.locals.auth) {
            console.log('hooks.server.ts: Unauthorized upload attempt, locals.auth:', event.locals.auth);
            return new Response(JSON.stringify({ type: 'error', status: 401, message: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const formData = await event.request.formData();
        const file = formData.get('file') as File;
        if (!file) {
            console.log('hooks.server.ts: No file provided in upload request');
            return new Response(JSON.stringify({ type: 'error', status: 400, message: 'No file provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const fileName = `uploads/${uuidv4()}-${file.name}`;
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        try {
            console.log('hooks.server.ts: Uploading file to S3:', fileName, 'Size:', fileBuffer.length, 'Type:', file.type);
            await s3.send(new PutObjectCommand({
                Bucket: process.env.S3_BUCKET || 'hyperlocalmoo-uploads',
                Key: fileName,
                Body: fileBuffer,
                ContentType: file.type,
                ACL: 'public-read'
            }));

            const fileUrl = `https://${process.env.S3_BUCKET || 'hyperlocalmoo-uploads'}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileName}`;
            console.log('hooks.server.ts: Upload successful, URL:', fileUrl);
            return new Response(JSON.stringify({ type: 'success', status: 200, data: fileUrl }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            if (error && typeof error === 'object' && 'message' in error) {
                console.error('hooks.server.ts: Upload error:', (error as any).message);
            } else {
                console.error('hooks.server.ts: Upload error:', error);
            }
            return new Response(JSON.stringify({ type: 'error', status: 500, message: 'Upload failed' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

        // --- Content Security Policy (CSP) header ---
        const response = await resolve(event);

        const isDev = process.env.NODE_ENV !== 'production';
        const csp = [
            isDev ? "default-src 'self' data: blob: https:;" : "default-src 'self';",
            "script-src 'self' https://maps.googleapis.com https://maps.gstatic.com https://cdnjs.cloudflare.com https://pagead2.googlesyndication.com https://www.googletagservices.com https://www.google.com https://www.google-analytics.com https://google-analytics.com https://googletagmanager.com https://ep2.adtrafficquality.google 'unsafe-inline' 'unsafe-eval';",
            "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://www.google.com;",
            "img-src 'self' data: blob: https://*.amazonaws.com https://*.peakpx.com https://maps.gstatic.com https://maps.googleapis.com https://wallpapers.com https://*.wallpapers.com https://unsplash.com https://*.unsplash.com https://pexels.com https://*.pexels.com https://imgur.com https://*.imgur.com https://flickr.com https://*.flickr.com https://*.staticflickr.com https://pinterest.com https://*.pinterest.com https://*.pinimg.com https://google.com https://*.google.com https://*.googleusercontent.com https://*.ggpht.com https://images.unsplash.com https://i.imgur.com https://tpc.googlesyndication.com https://www.google.com https://pagead2.googlesyndication.com https:;",
            "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com https://www.google.com;",
            isDev
                ? "connect-src * data: blob:;"
                : "connect-src 'self' http://localhost:4000 ws://localhost:4000 https://apexmoo.com https://maps.googleapis.com https://maps.gstatic.com https://places.googleapis.com https://*.googleapis.com https://*.google.com https://www.google-analytics.com https://google-analytics.com https://googletagmanager.com https://pagead2.googlesyndication.com https://www.googletagservices.com https://ep1.adtrafficquality.google;",
            "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://pagead2.googlesyndication.com;",
            "object-src 'none';",
            "media-src 'self' data: blob: https://*.amazonaws.com https://wallpapers.com https://*.wallpapers.com https://unsplash.com https://*.unsplash.com https://pexels.com https://*.pexels.com https://imgur.com https://*.imgur.com https://flickr.com https://*.flickr.com https://*.staticflickr.com https://pinterest.com https://*.pinterest.com https://*.pinimg.com https://google.com https://*.google.com https://*.googleusercontent.com https://*.ggpht.com https:;",
            "report-uri /api/csp-violation-report;"
        ].join(' ');
    
        response.headers.set('Content-Security-Policy', csp);
        response.headers.set('X-Debug-CSP', csp); // check in DevTools → Network → main document
    
        return response;
};