import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter(),
    csp: {
      mode: 'auto',
      directives: {
        'script-src': [
          'self',
          'unsafe-inline',
          'unsafe-eval',
          'https://maps.googleapis.com',
          'https://maps.gstatic.com',
          'https://cdnjs.cloudflare.com',
          'https://pagead2.googlesyndication.com',
          'https://www.googletagservices.com',
          'https://www.google.com',
          'https://www.google-analytics.com',
          'https://google-analytics.com',
          'https://googletagmanager.com',
          'https://ep2.adtrafficquality.google',
          'https://ep1.adtrafficquality.google'
        ],
        'frame-src': [
          'self',
          'https://googleads.g.doubleclick.net',
          'https://tpc.googlesyndication.com',
          'https://www.google.com',
          'https://pagead2.googlesyndication.com',
          'https://ep2.adtrafficquality.google'
        ],
        'connect-src': [
          'self',
          'https://api.apexmoo.com',
          'https://maps.googleapis.com',
          'https://maps.gstatic.com',
          'https://places.googleapis.com',
          'https://*.googleapis.com',
          'https://*.google.com',
          'https://www.google-analytics.com',
          'https://google-analytics.com',
          'https://googletagmanager.com',
          'https://pagead2.googlesyndication.com',
          'https://www.googletagservices.com',
          'https://ep1.adtrafficquality.google'
        ],
        'img-src': [
          'self',
          'data:',
          'blob:',
          'https://*.amazonaws.com',
          'https://*.peakpx.com',
          'https://maps.gstatic.com',
          'https://maps.googleapis.com',
          'https://wallpapers.com',
          'https://*.wallpapers.com',
          'https://unsplash.com',
          'https://*.unsplash.com',
          'https://pexels.com',
          'https://*.pexels.com',
          'https://imgur.com',
          'https://*.imgur.com',
          'https://flickr.com',
          'https://*.flickr.com',
          'https://*.staticflickr.com',
          'https://pinterest.com',
          'https://*.pinterest.com',
          'https://*.pinimg.com',
          'https://google.com',
          'https://*.google.com',
          'https://*.googleusercontent.com',
          'https://*.ggpht.com',
          'https://images.unsplash.com',
          'https://i.imgur.com',
          'https://tpc.googlesyndication.com',
          'https://www.google.com',
          'https://pagead2.googlesyndication.com',
          'https:'
        ],
        'style-src': [
          'self',
          'unsafe-inline',
          'https://cdnjs.cloudflare.com',
          'https://fonts.googleapis.com',
          'https://www.google.com'
        ],
        'font-src': [
          'self',
          'https://cdnjs.cloudflare.com',
          'https://fonts.gstatic.com',
          'https://www.google.com'
        ],
        'object-src': ['none'],
        'base-uri': ['none'],
        'report-uri': ['/api/csp-violation-report']
      }
    }
  }
};

export default config;
