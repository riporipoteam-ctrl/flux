export type StoryMusicGenre =
  | "Comedy"
  | "Electronic"
  | "Epic"
  | "Horror"
  | "Romance"
  | "Scoring"
  | "Upbeat"
  | "Zoned";

export interface StoryMusicTrack {
  id: string;
  title: string;
  artist: string;
  genre: StoryMusicGenre;
  mood: string;
  license: "CC0 / Public Domain";
  sourceUrl: string;
  audioUrl: string;
  attributionRequired: false;
}

const FREEPD_LIBRARY_URL = "https://en.freepd.cn/music";

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function utf8Hex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function freePdAudioUrl(genre: StoryMusicGenre, title: string): string {
  return `https://en.freepd.cn/api/music/${utf8Hex(`${genre}/${title}.mp3`)}`;
}

function track(genre: StoryMusicGenre, title: string, mood: string): StoryMusicTrack {
  return {
    id: `${genre.toLowerCase()}-${slugify(title)}`,
    title,
    artist: "FreePD public-domain library",
    genre,
    mood,
    license: "CC0 / Public Domain",
    sourceUrl: `${FREEPD_LIBRARY_URL}/${genre.toLowerCase()}`,
    audioUrl: freePdAudioUrl(genre, title),
    attributionRequired: false,
  };
}

/**
 * 130 real CC0/public-domain MP3 tracks sourced from FreePD's preserved library.
 * They are streamed on demand; Flux does not synthesize music in the browser.
 */
export const STORY_MUSIC: StoryMusicTrack[] = [
  track("Comedy", "Alls Fair In Love", "Playful"),
  track("Comedy", "Attic Secrets", "Playful"),
  track("Comedy", "Baltic Levity", "Playful"),
  track("Comedy", "Barnville", "Playful"),
  track("Comedy", "Barroom Ballet", "Playful"),
  track("Comedy", "BeBop for Joey", "Playful"),
  track("Comedy", "Busybody", "Playful"),
  track("Comedy", "Cha-Cha Ender", "Playful"),
  track("Comedy", "Circus of Freaks", "Playful"),
  track("Comedy", "Comic Game Loop - Mischief", "Playful"),
  track("Comedy", "Creepy Comedy", "Playful"),
  track("Comedy", "Dance of the Tuba Plum Fairy", "Playful"),
  track("Comedy", "Drunken Party", "Playful"),
  track("Comedy", "Fancy Family", "Playful"),
  track("Comedy", "Fenster's Explanation", "Playful"),
  track("Comedy", "Foam Rubber", "Playful"),
  track("Comedy", "Fright Night Twist", "Playful"),
  track("Comedy", "Frogs Legs Rag", "Playful"),
  track("Comedy", "Ghost Town", "Playful"),
  track("Comedy", "Going Bananas", "Playful"),
  track("Comedy", "Hello! Ma Baby", "Playful"),
  track("Comedy", "Holiday Weasel", "Playful"),
  track("Comedy", "Hopeful", "Playful"),
  track("Comedy", "Horns", "Playful"),
  track("Comedy", "Joey's Song", "Playful"),
  track("Comedy", "Jungle Mission", "Playful"),
  track("Comedy", "Krampus's Workshop", "Playful"),
  track("Comedy", "Llama in Pajama", "Playful"),
  track("Comedy", "Lurking Sloth", "Playful"),
  track("Comedy", "Madness of Linda", "Playful"),
  track("Comedy", "Managing Mischief", "Playful"),
  track("Comedy", "Maple Leaf Rag", "Playful"),
  track("Comedy", "Monsters in Hotel", "Playful"),
  track("Comedy", "My Giant Bunny Friend", "Playful"),
  track("Comedy", "Night in the Castle", "Playful"),
  track("Comedy", "Organ Filler", "Playful"),
  track("Comedy", "Rush", "Playful"),
  track("Comedy", "Sad Drunken Party", "Playful"),
  track("Comedy", "Silly Boy", "Playful"),
  track("Comedy", "Silly Intro", "Playful"),
  track("Comedy", "Spring Chicken", "Playful"),
  track("Comedy", "Take the Ride", "Playful"),
  track("Comedy", "The Entertainer", "Playful"),
  track("Comedy", "USSR", "Playful"),
  track("Comedy", "Vintage Party", "Playful"),
  track("Comedy", "Wakka Wakka", "Playful"),
  track("Electronic", "3 am West End", "Electronic"),
  track("Electronic", "Arpent", "Electronic"),
  track("Electronic", "Backbeat", "Electronic"),
  track("Electronic", "Beat One", "Electronic"),
  track("Electronic", "Beat Thee", "Electronic"),
  track("Electronic", "Bit Bit Loop", "Electronic"),
  track("Electronic", "Chronos", "Electronic"),
  track("Electronic", "Favorite", "Electronic"),
  track("Electronic", "Fireworks", "Electronic"),
  track("Electronic", "Goodnightmare", "Electronic"),
  track("Electronic", "Hear What They Say", "Electronic"),
  track("Electronic", "Hippety Hop", "Electronic"),
  track("Epic", "Adventure", "Cinematic"),
  track("Epic", "Adventures of Flying Jack", "Cinematic"),
  track("Epic", "Ancient Rite", "Cinematic"),
  track("Epic", "Assassin", "Cinematic"),
  track("Epic", "Battle Ready", "Cinematic"),
  track("Epic", "Behind Enemy Lines", "Cinematic"),
  track("Epic", "Beyond - part 2", "Cinematic"),
  track("Epic", "Big Eyes", "Cinematic"),
  track("Epic", "Black Knight", "Cinematic"),
  track("Epic", "Cornfield Chase", "Cinematic"),
  track("Epic", "Emotional Blockbuster 2", "Cinematic"),
  track("Epic", "Epic Blockbuster 2", "Cinematic"),
  track("Horror", "Alien Invasion", "Dark"),
  track("Horror", "Alien Spaceship Atmosphere", "Dark"),
  track("Horror", "Asking Questions", "Dark"),
  track("Horror", "Cockroaches", "Dark"),
  track("Horror", "Consecrated Ground", "Dark"),
  track("Horror", "Creepy Hallow", "Dark"),
  track("Horror", "Cursed Intro", "Dark"),
  track("Horror", "Dawn of the Apocalypse", "Dark"),
  track("Horror", "Footsteps in the Attic", "Dark"),
  track("Horror", "Halloween Theme 1", "Dark"),
  track("Horror", "Hidden Truth", "Dark"),
  track("Horror", "Hor Hor", "Dark"),
  track("Romance", "A Very Brady Special", "Warm"),
  track("Romance", "Amazing Grace", "Warm"),
  track("Romance", "Brothers Unite", "Warm"),
  track("Romance", "Burt's Requiem", "Warm"),
  track("Romance", "Champ de tournesol", "Warm"),
  track("Romance", "Horizon Flare", "Warm"),
  track("Romance", "Isolation Waltz", "Warm"),
  track("Romance", "La Citadelle", "Warm"),
  track("Romance", "Landra's Dream", "Warm"),
  track("Romance", "Lovely Piano Song", "Warm"),
  track("Romance", "Lucky Break", "Warm"),
  track("Romance", "Night in Venice", "Warm"),
  track("Scoring", "Action Strike", "Soundtrack"),
  track("Scoring", "After the End", "Soundtrack"),
  track("Scoring", "Beginning of Conflict", "Soundtrack"),
  track("Scoring", "City Run", "Soundtrack"),
  track("Scoring", "Desert Fox Underscore", "Soundtrack"),
  track("Scoring", "Desert Fox", "Soundtrack"),
  track("Scoring", "Dreams of Vain", "Soundtrack"),
  track("Scoring", "Driving Concern", "Soundtrack"),
  track("Scoring", "Final Step", "Soundtrack"),
  track("Scoring", "Find Them", "Soundtrack"),
  track("Scoring", "Funky Energy Loop", "Soundtrack"),
  track("Scoring", "Guerilla Tactics", "Soundtrack"),
  track("Upbeat", "Advertime", "Upbeat"),
  track("Upbeat", "And Just Like That", "Upbeat"),
  track("Upbeat", "Bar Brawl", "Upbeat"),
  track("Upbeat", "Be Chillin", "Upbeat"),
  track("Upbeat", "City Sunshine", "Upbeat"),
  track("Upbeat", "From Page to Practice", "Upbeat"),
  track("Upbeat", "Funshine", "Upbeat"),
  track("Upbeat", "Happy Whistling Ukulele", "Upbeat"),
  track("Upbeat", "Inspiration", "Upbeat"),
  track("Upbeat", "Inventing Flight", "Upbeat"),
  track("Upbeat", "Limit 70", "Upbeat"),
  track("Upbeat", "Motions", "Upbeat"),
  track("Zoned", "120 Monster", "Ambient"),
  track("Zoned", "2006-June-26", "Ambient"),
  track("Zoned", "2017 12 01 in C Major", "Ambient"),
  track("Zoned", "2017 12 02 in D Minor", "Ambient"),
  track("Zoned", "2017 12 04 in A Minor", "Ambient"),
  track("Zoned", "2017 12 05 in Ab Major", "Ambient"),
  track("Zoned", "30 Seconds (Live)", "Ambient"),
  track("Zoned", "80s Smooth Rocker", "Ambient"),
  track("Zoned", "A Little Faith", "Ambient"),
  track("Zoned", "A Terrible Sounding Piece of Music", "Ambient"),
  track("Zoned", "A Turn for the Worse", "Ambient"),
  track("Zoned", "A Wormhole in the Top of the World", "Ambient"),
];

export const STORY_MUSIC_GENRES: Array<"All" | StoryMusicGenre> = [
  "All",
  "Comedy",
  "Electronic",
  "Epic",
  "Horror",
  "Romance",
  "Scoring",
  "Upbeat",
  "Zoned",
];

export function getStoryMusicTrack(trackId: string | null | undefined): StoryMusicTrack | null {
  if (!trackId) return null;
  return STORY_MUSIC.find((item) => item.id === trackId) || null;
}

export function startStoryMusic(trackId: string | null | undefined): () => void {
  if (typeof window === "undefined") return () => undefined;
  const selected = getStoryMusicTrack(trackId);
  if (!selected) return () => undefined;

  const audio = new Audio(selected.audioUrl);
  audio.preload = "metadata";
  audio.loop = true;
  audio.volume = 0.32;
  audio.playsInline = true;

  let stopped = false;
  void audio.play().catch(() => {
    if (!stopped) console.warn(`Flux could not preview ${selected.title}`);
  });

  return () => {
    stopped = true;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  };
}
