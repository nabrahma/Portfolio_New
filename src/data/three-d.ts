import type { ImageMetadata } from 'astro';
import cafe from '../assets/3d/cafe.jpg';
import woods from '../assets/3d/woods.webp';
import porch from '../assets/3d/porch.jpg';
import bedroom from '../assets/3d/bedroom.jpg';
import hangAround from '../assets/3d/hang-around.jpg';
import kitchen from '../assets/3d/kitchen.jpg';
import lakeside from '../assets/3d/lakeside.jpg';
import lonely from '../assets/3d/lonely.jpg';
import sunset from '../assets/3d/sunset.jpg';
import pondSide from '../assets/3d/pond-side.jpg';
import river from '../assets/3d/river.jpg';
import shop from '../assets/3d/shop.jpg';
import cityStreet from '../assets/3d/city-street.jpg';
import doorway from '../assets/3d/doorway.jpg';
import walkAround from '../assets/3d/walk-around.jpg';
import windowRain from '../assets/3d/window-rain.jpg';
import windowSeat from '../assets/3d/window-seat.jpg';

// The 3D folder. Order = reading order on /3d; the first `featured` ones also run on the home page.
// To add a render: drop it in src/assets/3d/, import it above, add an entry below.
export interface Render {
  slug: string;
  title: string;
  image: ImageMetadata;
  alt: string;
  featured?: boolean;
  year?: string; // optional, shown when set
  tools?: string[]; // optional, e.g. ['Blender', 'Photoshop']
  note?: string;
}

export const renders: Render[] = [
  { slug: 'window-rain', title: 'Window, rain', image: windowRain, featured: true, alt: 'A dim living room at dusk. A floor lamp glows beside a sofa while a curtain blows in through an open window onto green trees.' },
  { slug: 'cafe', title: 'Alone café', image: cafe, featured: true, alt: 'A small café at night seen from across a wet street, its warm windows the only light, reflected in the rain on the pavement.' },
  { slug: 'woods', title: 'Alone in the woods', image: woods, featured: true, alt: 'A blue, fog-filled pine forest with ferns in the foreground and a tiny figure standing far off between the trunks.' },
  { slug: 'sunset', title: 'Looking at the sunset', image: sunset, featured: true, alt: 'A figure in a hooded jacket stands in silhouette in tall grass, facing a low orange sun under a dark, cloudy sky.' },
  { slug: 'kitchen', title: 'Kitchen', image: kitchen, featured: true, alt: 'A man stands in a dark kitchen, lit only by the warm light under the wall cabinets.' },
  { slug: 'pond-side', title: 'Pond side', image: pondSide, featured: true, alt: 'Late sunlight cuts through tall trees onto a figure sitting alone in the grass.' },
  { slug: 'shop', title: 'Shop', image: shop, featured: true, alt: 'A figure pushes a shopping trolley through a dark convenience store, backlit by a bright doorway full of daylight.' },
  { slug: 'lonely', title: 'Lonely', image: lonely, featured: true, alt: 'A man sits hunched at a desk in a dark room, a single stripe of light across the polished floor.' },
  { slug: 'river', title: 'River', image: river, alt: 'A man sits on a grassy bank under a tree, looking across pale water toward a misty mountain.' },
  { slug: 'porch', title: 'Porch', image: porch, alt: 'A figure leans against a post on a dark wooden porch, looking out at a misty green forest.' },
  { slug: 'city-street', title: 'City street', image: cityStreet, alt: 'Low angle of a figure standing under a tree outside an old shuttered shop with a hand-painted Korean sign.' },
  { slug: 'doorway', title: 'Doorway', image: doorway, alt: 'A room glowing deep orange: a shelf with books, a plant and a clock, and a figure sitting in the shadow of a doorway.' },
  { slug: 'bedroom', title: 'Bedroom', image: bedroom, alt: 'A man sits on the edge of a bed in a dark room, a curtain hanging at the right.' },
  { slug: 'lakeside', title: 'Lakeside', image: lakeside, alt: 'A deep blue, foggy hillside of tall grass with a faint figure almost lost in the mist.' },
  { slug: 'walk-around', title: 'Walk around', image: walkAround, alt: 'Seen from a fire escape above, a person carrying a bag walks along a sunlit pavement beside a red brick wall.' },
  { slug: 'hang-around', title: 'Hang around', image: hangAround, alt: 'A wide, sunlit city street lined with trees; a lone man stands on the far pavement in front of a pale stone building.' },
  { slug: 'window-seat', title: 'Window seat', image: windowSeat, alt: 'A figure sits in near darkness beside a tall window with white curtains, trees just visible outside.' },
];
