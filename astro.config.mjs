import { defineConfig } from 'astro/config';

// Static output: deploy dist/ to Vercel, Netlify, Cloudflare Pages or GitHub Pages.
export default defineConfig({
  site: 'https://portfolio-nabaskarbrahma.vercel.app',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  image: { responsiveStyles: false },
  devToolbar: { enabled: false },
});
