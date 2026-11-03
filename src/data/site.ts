// Everything personal lives here. Edit this file, not the components.
// Empty strings hide the matching link on the site.

export const site = {
  name: 'Nabaskar Brahma',
  short: 'NB',
  role: 'UX/UI designer',
  roleNext: '3D generalist',
  location: 'India',
  timezone: 'Asia/Kolkata',
  tzLabel: 'IST',
  // Shown in the About window. Check these.
  education: 'ABV-Indian Institute of Information Technology and Management, Gwalior · Integrated B.Tech (IT) + MBA · graduating 2028',
  status: 'Open to Summer 2027 UX internships',
  description:
    'Nabaskar Brahma: UX/UI designer. Research-led case studies in mobile, trust and safety, and learning products, plus motion and 3D.',

  // Public contact email (used for mailto links and as the letter fallback). Leave '' to hide.
  email: 'nabaskarbrahma1624@gmail.com',
  resume: '/resume', // the résumé page; it links the PDF (npm run resume rebuilds it)
  socials: [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/nabaskar/' },
    { label: 'Behance', href: 'https://www.behance.net/nabaskarbrahma' },
    { label: 'ArtStation', href: 'https://www.artstation.com/nabaskar' },
    { label: 'GitHub', href: 'https://github.com/nabrahma' },
  ],

  // Letters: create a free access key at https://web3forms.com with the inbox you want
  // letters delivered to, then put it in .env as PUBLIC_WEB3FORMS_KEY=xxxx
  web3formsKey: import.meta.env.PUBLIC_WEB3FORMS_KEY ?? '',
};

export type Site = typeof site;
