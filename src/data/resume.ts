// The résumé, as data. /resume renders it, and `npm run resume` prints it to a one-page PDF.
// Rules it follows (see reports/UX intern resume for Google.md):
//   one column, live text, standard headings, every link also written out as text,
//   Google's X-Y-Z bullets ("accomplished X, as measured by Y, by doing Z"),
//   the posting's own words where they're true, and no number that can't be defended.

export interface Entry {
  title: string;
  org?: string;
  meta?: string; // place, platform, or a one-line descriptor
  when: string;
  link?: { label: string; href: string };
  bullets: string[];
}

export const resume = {
  headline: 'UX Designer | Interaction and Motion Design',
  location: 'Gwalior, India (open to Bengaluru)',
  summary:
    'Product design student who applies user-centered design: starting from user interviews and real user data, then designing user flows, wireframes and interactive prototypes in Figma. Strong in interaction, visual and motion design; also a 3D generalist.',

  education: [
    {
      title: 'Integrated B.Tech in Information Technology + MBA (5-year dual degree, full-time)',
      org: 'ABV-Indian Institute of Information Technology and Management (ABV-IIITM), Gwalior',
      when: '2023 – Expected 2028',
      bullets: [],
    },
  ] as Entry[],

  projects: [
    {
      title: 'Margin',
      meta: 'Lecture study companion, Android | Solo: research and design',
      when: '2026',
      link: { label: 'case study', href: '/work/margin' },
      bullets: [
        'Turned 10,657 public app reviews and forum posts into a 607-post evidence base by hand-coding 935 of them, then tested 7 hypotheses against it (4 confirmed, 2 rejected) before designing anything.',
        'Designed an offline-first lecture player where every note is pinned to its timestamp, prioritised by the top finding: 177 of 607 posts (29%) were about offline use and downloads.',
      ],
    },
    {
      title: 'Ruko',
      meta: 'Scam safety in UPI payments for parents 45+ | Solo: research and design',
      when: 'Oct 2026',
      link: { label: 'case study', href: '/work/ruko' },
      bullets: [
        'Ran 6 user interviews with adults aged 48–68 and a comparison test of 3 warning messages; 0 of 6 chose the generic warning and 5 of 6 had a habit of clearing pop-ups.',
        'Designed a stop screen that names the exact rupee amount, explains the risk in the user’s language and offers one tap to call family, prototyped end to end as an interactive Figma flow.',
      ],
    },
    {
      title: 'ThriftUp',
      meta: 'E-commerce site with a clothing buy-back program | Solo designer',
      when: '2024',
      link: { label: 'case study', href: '/work/thriftup' },
      bullets: [
        'Won 1st Prize in the Winter UI/UX Project Competition 2024 by designing 50+ screens end to end: personas, information architecture, wireframes, a design system and high-fidelity UI.',
      ],
    },
    {
      title: 'What if…?',
      meta: 'Interaction and motion design prototypes, iOS',
      when: '2026',
      link: { label: 'prototypes', href: '/work/what-if' },
      bullets: [
        'Built 3 interactive prototypes in Figma (Smart Animate, interactive components, variables, tuned springs), each answering one gesture question with a single native transition.',
      ],
    },
  ] as Entry[],

  experience: [
    {
      title: 'Product Design Intern',
      org: 'Hygge Energy',
      meta: 'Sustainable energy management',
      when: 'Nov 2025 – Jan 2026',
      bullets: [
        'Designed user flows, wireframes and dashboard screens for an energy management product, and refined its mobile app interactions for clarity and consistency.',
      ],
    },
    {
      title: 'UI/UX Designer',
      org: 'Infotsav, ABV-IIITM’s technology and cultural festival',
      when: '2024 – 2025',
      bullets: [
        'Led the 2025 website redesign for usability, accessibility and visual consistency, after designing UI components and layouts for the 2024 site.',
      ],
    },
    {
      title: 'Freelance UI and Graphic Designer',
      org: 'Student events and small businesses',
      when: '2020 – Present',
      bullets: [
        'Designed brand identities, social media graphics and landing-page prototypes in Figma and Framer.',
      ],
    },
  ] as Entry[],

  skills: [
    { k: 'UX', v: 'User-centered design, user interviews, concept testing, qualitative coding, hypothesis testing, user flows, wireframing, information architecture, interactive prototyping, design systems, accessibility' },
    { k: 'Visual and motion', v: 'Interaction design, visual design, motion design, graphic design, branding, 3D environments and lighting' },
    { k: 'Tools', v: 'Figma, Framer, Adobe Illustrator, Adobe Photoshop, Blender' },
    { k: 'Technical', v: 'HTML, CSS, Python, C#, C++, MySQL, Unity, Unreal Engine' },
  ],

  achievements: [
    '1st Prize, Winter UI/UX Project Competition 2024 (ThriftUp).',
    '3D artwork selected for ABV-IIITM’s annual magazine three years running (2023, 2024, 2025).',
    'Design volunteer for Aurora, ABV-IIITM’s cultural festival (2023–2024): posters, graphics and branding.',
  ],
};
