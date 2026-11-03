import { defineConfig } from 'astro/config';

// Static output: deploy dist/ to Vercel, Netlify, Cloudflare Pages or GitHub Pages.
export default defineConfig({
  site: 'https://example.com', // TODO: set to your real domain before deploying
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  image: { responsiveStyles: false },
  devToolbar: { enabled: false },
});
