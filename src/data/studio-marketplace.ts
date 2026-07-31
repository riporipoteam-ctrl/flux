export type StudioAssetKind = "3d" | "2d" | "texture" | "animation" | "sfx" | "music" | "template";

export interface StudioMarketplaceAsset {
  id: string;
  name: string;
  kind: StudioAssetKind;
  collection: string;
  source: "Kenney" | "Quaternius" | "OpenGameArt";
  sourceUrl: string;
  license: string;
  tags: string[];
  previewTone?: number;
}

const PACKS: Array<{
  source: StudioMarketplaceAsset["source"];
  collection: string;
  sourceUrl: string;
  license: string;
  kinds: StudioAssetKind[];
  names: string[];
  tags: string[];
}> = [
  {
    source: "Kenney",
    collection: "RPG Base",
    sourceUrl: "https://kenney.nl/assets/rpg-base",
    license: "CC0 1.0",
    kinds: ["2d", "texture", "template"],
    names: ["Stone Floor", "Grass Tile", "Wood Wall", "Castle Door", "Treasure Chest", "Village Roof", "Dungeon Steps", "Bridge Segment", "Market Stall", "Path Corner"],
    tags: ["rpg", "fantasy", "tiles"],
  },
  {
    source: "Kenney",
    collection: "Top-down Shooter",
    sourceUrl: "https://kenney.nl/assets/top-down-shooter",
    license: "CC0 1.0",
    kinds: ["2d", "texture", "template"],
    names: ["Player Soldier", "Alien Enemy", "Crate", "Metal Floor", "Laser Pickup", "Barrier", "Explosion Sheet", "Turret", "Space Door", "Health Pack"],
    tags: ["shooter", "sci-fi", "sprites"],
  },
  {
    source: "Kenney",
    collection: "Block Pack",
    sourceUrl: "https://kenney.nl/assets/block-pack",
    license: "CC0 1.0",
    kinds: ["3d", "texture"],
    names: ["Grass Block", "Stone Block", "Sand Block", "Water Block", "Tree Block", "Brick Block", "Snow Block", "Lava Block", "Glass Block", "Road Block"],
    tags: ["voxel", "building", "world"],
  },
  {
    source: "Kenney",
    collection: "Top-down Tanks",
    sourceUrl: "https://kenney.nl/assets/top-down-tanks-redux",
    license: "CC0 1.0",
    kinds: ["2d", "texture", "template"],
    names: ["Blue Tank", "Red Tank", "Heavy Tank", "Tank Turret", "Shell", "Track Mark", "Desert Ground", "Barricade", "Smoke Sheet", "Destroyed Tank"],
    tags: ["tank", "battle", "vehicle"],
  },
  {
    source: "Quaternius",
    collection: "Universal Base Characters",
    sourceUrl: "https://quaternius.com/",
    license: "CC0 1.0",
    kinds: ["3d", "animation"],
    names: ["Hero Character", "Robot Character", "Knight Character", "Wizard Character", "Ranger Character", "Idle Animation", "Run Animation", "Jump Animation", "Attack Animation", "Dance Animation"],
    tags: ["character", "rigged", "animation"],
  },
  {
    source: "Quaternius",
    collection: "Ultimate Buildings",
    sourceUrl: "https://quaternius.com/",
    license: "CC0 1.0",
    kinds: ["3d", "texture"],
    names: ["Modern House", "City Tower", "Shop Building", "Police Station", "Hospital", "Warehouse", "Small Cabin", "Apartment Block", "Office Building", "Garage"],
    tags: ["building", "city", "environment"],
  },
  {
    source: "Quaternius",
    collection: "Nature Pack",
    sourceUrl: "https://quaternius.com/",
    license: "CC0 1.0",
    kinds: ["3d", "texture"],
    names: ["Oak Tree", "Pine Tree", "Rock Cluster", "Flower Patch", "Bush", "Mushroom", "Mountain Piece", "River Rock", "Palm Tree", "Cactus"],
    tags: ["nature", "environment", "low-poly"],
  },
  {
    source: "OpenGameArt",
    collection: "Community Audio",
    sourceUrl: "https://opengameart.org/art-search-advanced?keys=&field_art_type_tid%5B%5D=13",
    license: "License varies per asset — verify before publishing",
    kinds: ["sfx", "music"],
    names: ["Menu Click", "Coin Pickup", "Power Up", "Explosion", "Footstep", "Jump", "Victory Loop", "Battle Loop", "Ambient Forest", "Space Ambience"],
    tags: ["audio", "sound", "music"],
  },
  {
    source: "Kenney",
    collection: "Interface Sounds",
    sourceUrl: "https://kenney.nl/assets/interface-sounds",
    license: "CC0 1.0",
    kinds: ["sfx"],
    names: ["Confirm", "Cancel", "Hover", "Open Panel", "Close Panel", "Notification", "Error", "Success", "Toggle On", "Toggle Off"],
    tags: ["ui", "audio", "interface"],
  },
  {
    source: "Kenney",
    collection: "Impact Sounds",
    sourceUrl: "https://kenney.nl/assets/impact-sounds",
    license: "CC0 1.0",
    kinds: ["sfx"],
    names: ["Wood Impact", "Metal Impact", "Glass Break", "Stone Hit", "Soft Hit", "Heavy Hit", "Crash", "Drop", "Bounce", "Debris"],
    tags: ["impact", "audio", "physics"],
  },
  {
    source: "Quaternius",
    collection: "Vehicles",
    sourceUrl: "https://quaternius.com/",
    license: "CC0 1.0",
    kinds: ["3d", "animation"],
    names: ["Sports Car", "Police Car", "Truck", "Bus", "Motorbike", "Helicopter", "Plane", "Boat", "Tractor", "Racing Kart"],
    tags: ["vehicle", "transport", "low-poly"],
  },
  {
    source: "Kenney",
    collection: "Platformer Kit",
    sourceUrl: "https://kenney.nl/assets/platformer-kit",
    license: "CC0 1.0",
    kinds: ["3d", "2d", "template"],
    names: ["Player Capsule", "Moving Platform", "Checkpoint", "Coin", "Spike Trap", "Spring Pad", "Goal Flag", "Cloud Platform", "Breakable Crate", "Portal"],
    tags: ["platformer", "gameplay", "starter"],
  },
];

export const STUDIO_MARKETPLACE_ASSETS: StudioMarketplaceAsset[] = PACKS.flatMap((pack, packIndex) =>
  pack.names.map((name, index) => ({
    id: `${pack.source.toLowerCase()}-${packIndex}-${index}`,
    name,
    kind: pack.kinds[index % pack.kinds.length],
    collection: pack.collection,
    source: pack.source,
    sourceUrl: pack.sourceUrl,
    license: pack.license,
    tags: [...pack.tags, name.toLowerCase()],
    previewTone: pack.kinds[index % pack.kinds.length] === "sfx" || pack.kinds[index % pack.kinds.length] === "music"
      ? 180 + ((packIndex * 97 + index * 53) % 620)
      : undefined,
  }))
);

export const STUDIO_ASSET_KINDS: Array<{ id: "all" | StudioAssetKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "3d", label: "3D" },
  { id: "2d", label: "2D" },
  { id: "texture", label: "Textures" },
  { id: "animation", label: "Animations" },
  { id: "sfx", label: "SFX" },
  { id: "music", label: "Music" },
  { id: "template", label: "Templates" },
];