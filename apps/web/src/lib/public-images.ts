export type PublicImage = {
  id: string;
  alt: string;
  caption: string;
  eyebrow: string;
  src: string;
  sourceName: string;
  sourceUrl: string;
};

export const publicContactImages: PublicImage[] = [
  {
    id: "networking-conversation",
    eyebrow: "Meet",
    caption: "Conversations turn into contacts worth keeping.",
    alt: "Professionals talking during a conference break.",
    src: "https://images.pexels.com/photos/8761648/pexels-photo-8761648.jpeg?auto=compress&cs=tinysrgb&w=1400",
    sourceName: "Pavel Danilyuk / Pexels",
    sourceUrl: "https://www.pexels.com/photo/people-having-a-conversation-8761648/",
  },
  {
    id: "smartphone-group",
    eyebrow: "Share",
    caption: "People already use phones to stay close. ContactBook makes the details clearer.",
    alt: "A group of people sitting outdoors using smartphones.",
    src: "https://images.pexels.com/photos/7688668/pexels-photo-7688668.jpeg?auto=compress&cs=tinysrgb&w=1400",
    sourceName: "Kindel Media / Pexels",
    sourceUrl: "https://www.pexels.com/photo/people-using-smartphone-7688668/",
  },
  {
    id: "conference-phone",
    eyebrow: "Connect",
    caption: "Networking moments should not end with outdated contact records.",
    alt: "A person at a conference using a smartphone.",
    src: "https://images.pexels.com/photos/20732953/pexels-photo-20732953.jpeg?auto=compress&cs=tinysrgb&w=1400",
    sourceName: "BBSO / Pexels",
    sourceUrl: "https://www.pexels.com/photo/person-using-smartphone-20732953/",
  },
  {
    id: "professional-phone",
    eyebrow: "Move",
    caption: "Contact details need to move with people across work, travel, and life.",
    alt: "A professional person using a smartphone outdoors.",
    src: "https://images.pexels.com/photos/6326322/pexels-photo-6326322.jpeg?auto=compress&cs=tinysrgb&w=1400",
    sourceName: "Vanessa Garcia / Pexels",
    sourceUrl: "https://www.pexels.com/photo/photo-of-person-using-smartphone-6326322/",
  },
  {
    id: "workspace-phone",
    eyebrow: "Update",
    caption: "The right details should be easy to update from wherever work happens.",
    alt: "Hands holding and using a smartphone beside a laptop and coffee.",
    src: "https://images.pexels.com/photos/20044369/pexels-photo-20044369.jpeg?auto=compress&cs=tinysrgb&w=1400",
    sourceName: "Airam Dato-on / Pexels",
    sourceUrl: "https://www.pexels.com/photo/hands-holding-and-using-smartphone-20044369/",
  },
  {
    id: "business-card-exchange",
    eyebrow: "Replace",
    caption: "The old exchange was a card. The new exchange is a living contact profile.",
    alt: "Two hands exchanging a business card.",
    src: "https://images.unsplash.com/photo-1746080390656-62d79559a00d?auto=format&fit=crop&w=1400&q=80",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/two-hands-exchanging-a-business-card-5pNsRJuj8Dc",
  },
];
