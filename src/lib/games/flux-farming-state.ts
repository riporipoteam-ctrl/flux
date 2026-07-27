export type SeedId = "carrot" | "wheat" | "corn" | "tomato" | "strawberry" | "pumpkin";
export type FarmTool = "plant" | "water" | "harvest";
export type RegionId = "homestead" | "pinebrook" | "sunfields" | "orchard" | "moonlake" | "wildwood";

export type FarmPlot = {
  crop: SeedId | null;
  stage: number;
  watered: boolean;
};

export type FarmAnimal = {
  id: "chicken" | "cow" | "sheep";
  name: string;
};

export type FarmState = {
  version: 3;
  farmName: string;
  day: number;
  level: number;
  xp: number;
  coins: number;
  harvested: number;
  houseLevel: number;
  barnLevel: number;
  tool: FarmTool;
  seed: SeedId;
  region: RegionId;
  plots: FarmPlot[];
  animals: FarmAnimal[];
  introSeen: boolean;
  notice: string;
};

export const SEEDS: Record<SeedId, { name: string; icon: string; cost: number; sell: number; days: number; level: number }> = {
  carrot: { name: "Carrot", icon: "🥕", cost: 2, sell: 7, days: 2, level: 1 },
  wheat: { name: "Wheat", icon: "🌾", cost: 3, sell: 8, days: 2, level: 1 },
  corn: { name: "Corn", icon: "🌽", cost: 4, sell: 12, days: 3, level: 2 },
  tomato: { name: "Tomato", icon: "🍅", cost: 5, sell: 15, days: 3, level: 3 },
  strawberry: { name: "Strawberry", icon: "🍓", cost: 7, sell: 21, days: 4, level: 5 },
  pumpkin: { name: "Pumpkin", icon: "🎃", cost: 10, sell: 32, days: 5, level: 8 },
};

export const REGIONS: Array<{ id: RegionId; name: string; level: number; description: string; icon: string }> = [
  { id: "homestead", name: "Brightvale Farm", level: 1, description: "Your farmhouse, fields and animal meadow.", icon: "🏡" },
  { id: "pinebrook", name: "Pinebrook Market", level: 3, description: "Trade produce and meet the valley residents.", icon: "🏘️" },
  { id: "sunfields", name: "Sunflower Fields", level: 5, description: "Bees, rare seeds and golden summer crops.", icon: "🌻" },
  { id: "orchard", name: "Misty Orchard", level: 8, description: "Fruit trees hide Mara's missing letters.", icon: "🌳" },
  { id: "moonlake", name: "Moonlit Lake", level: 12, description: "Fishing, night crops and the old boathouse.", icon: "🌙" },
  { id: "wildwood", name: "Wildwood", level: 16, description: "Restore the heart of Brightvale.", icon: "🌲" },
];

export function createFarmState(owner: string): FarmState {
  return {
    version: 3,
    farmName: `${owner}'s Farm`,
    day: 1,
    level: 1,
    xp: 0,
    coins: 50,
    harvested: 0,
    houseLevel: 1,
    barnLevel: 1,
    tool: "plant",
    seed: "carrot",
    region: "homestead",
    plots: Array.from({ length: 20 }, () => ({ crop: null, stage: 0, watered: false })),
    animals: [],
    introSeen: false,
    notice: "Mara is waiting beside the old farmhouse.",
  };
}

export function loadFarmState(storageKey: string, owner: string): FarmState {
  const fresh = createFarmState(owner);
  if (typeof window === "undefined") return fresh;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Partial<FarmState> & { plots?: Array<Partial<FarmPlot>> };
    const plots = Array.from({ length: 20 }, (_, index) => {
      const plot = saved.plots?.[index];
      const crop = plot?.crop && plot.crop in SEEDS ? plot.crop as SeedId : null;
      return {
        crop,
        stage: Number.isFinite(plot?.stage) ? Math.max(0, Number(plot?.stage)) : 0,
        watered: Boolean(plot?.watered),
      };
    });
    return {
      ...fresh,
      ...saved,
      version: 3,
      plots,
      animals: Array.isArray(saved.animals) ? saved.animals.filter((animal): animal is FarmAnimal => Boolean(animal?.id && animal?.name)) : [],
      farmName: typeof saved.farmName === "string" ? saved.farmName.slice(0, 32) : fresh.farmName,
      notice: "Welcome back to Brightvale.",
    };
  } catch {
    return fresh;
  }
}

export type FarmAction =
  | { type: "hydrate"; state: FarmState }
  | { type: "rename"; name: string }
  | { type: "selectTool"; tool: FarmTool }
  | { type: "selectSeed"; seed: SeedId }
  | { type: "interact"; index: number }
  | { type: "nextDay" }
  | { type: "visitRegion"; region: RegionId }
  | { type: "upgrade"; building: "house" | "barn" }
  | { type: "buyAnimal"; animal: FarmAnimal }
  | { type: "dismissIntro" };

function awardXp(state: FarmState, amount: number): Pick<FarmState, "xp" | "level"> {
  let xp = state.xp + amount;
  let level = state.level;
  while (xp >= level * 24) {
    xp -= level * 24;
    level += 1;
  }
  return { xp, level };
}

export function farmReducer(state: FarmState, action: FarmAction): FarmState {
  if (action.type === "hydrate") return action.state;
  if (action.type === "rename") return { ...state, farmName: action.name.slice(0, 32) };
  if (action.type === "selectTool") return { ...state, tool: action.tool, notice: `${action.tool[0].toUpperCase()}${action.tool.slice(1)} tool selected.` };
  if (action.type === "selectSeed") return { ...state, seed: action.seed, tool: "plant", notice: `${SEEDS[action.seed].name} seeds selected.` };
  if (action.type === "dismissIntro") return { ...state, introSeen: true, notice: "Plant your first crop to begin Mara's request." };

  if (action.type === "interact") {
    const plot = state.plots[action.index];
    if (!plot) return state;
    const plots = [...state.plots];
    if (state.tool === "plant") {
      const seed = SEEDS[state.seed];
      if (plot.crop) return { ...state, notice: "That field is already planted." };
      if (state.level < seed.level) return { ...state, notice: `${seed.name} unlocks at level ${seed.level}.` };
      if (state.coins < seed.cost) return { ...state, notice: "You need more coins for those seeds." };
      plots[action.index] = { crop: state.seed, stage: 0, watered: false };
      return { ...state, ...awardXp(state, 1), plots, coins: state.coins - seed.cost, notice: `${seed.name} planted. Water it before ending the day.` };
    }
    if (state.tool === "water") {
      if (!plot.crop) return { ...state, notice: "Plant something here first." };
      if (plot.stage >= SEEDS[plot.crop].days) return { ...state, notice: "This crop is ready to harvest." };
      if (plot.watered) return { ...state, notice: "This crop is already watered today." };
      plots[action.index] = { ...plot, watered: true };
      return { ...state, plots, notice: "Watered. It will grow overnight." };
    }
    if (!plot.crop) return { ...state, notice: "There is nothing to harvest here." };
    const seed = SEEDS[plot.crop];
    if (plot.stage < seed.days) return { ...state, notice: `${seed.name} needs ${seed.days - plot.stage} more growing day${seed.days - plot.stage === 1 ? "" : "s"}.` };
    plots[action.index] = { crop: null, stage: 0, watered: false };
    return { ...state, ...awardXp(state, 5), plots, coins: state.coins + seed.sell, harvested: state.harvested + 1, notice: `${seed.name} harvested for ${seed.sell} coins!` };
  }

  if (action.type === "nextDay") {
    const grown = state.plots.filter((plot) => plot.watered).length;
    const animalIncome = state.animals.length * 3;
    return {
      ...state,
      day: state.day + 1,
      coins: state.coins + animalIncome,
      plots: state.plots.map((plot) => !plot.crop ? plot : ({ ...plot, stage: plot.watered ? Math.min(SEEDS[plot.crop].days, plot.stage + 1) : plot.stage, watered: false })),
      notice: grown ? `${grown} crop${grown === 1 ? "" : "s"} grew overnight${animalIncome ? ` and your animals earned ${animalIncome} coins` : ""}.` : "Nothing grew. Remember to water before sleeping.",
    };
  }

  if (action.type === "visitRegion") {
    const region = REGIONS.find((item) => item.id === action.region);
    if (!region || state.level < region.level) return { ...state, notice: `${region?.name ?? "That region"} unlocks at level ${region?.level ?? "?"}.` };
    return { ...state, region: action.region, notice: `Travelled to ${region.name}.` };
  }

  if (action.type === "upgrade") {
    const current = action.building === "house" ? state.houseLevel : state.barnLevel;
    const cost = current * 60;
    if (current >= 5) return { ...state, notice: `Your ${action.building} is fully upgraded.` };
    if (state.coins < cost) return { ...state, notice: `You need ${cost} coins for that upgrade.` };
    const xp = awardXp(state, 12);
    return { ...state, ...xp, coins: state.coins - cost, [action.building === "house" ? "houseLevel" : "barnLevel"]: current + 1, notice: `${action.building === "house" ? "Farmhouse" : "Barn"} upgraded to level ${current + 1}!` };
  }

  if (action.type === "buyAnimal") {
    if (state.animals.some((animal) => animal.id === action.animal.id)) return { ...state, notice: `${action.animal.name} already lives here.` };
    const prices = { chicken: 40, cow: 90, sheep: 120 };
    const cost = prices[action.animal.id];
    if (state.barnLevel < ({ chicken: 1, cow: 2, sheep: 3 }[action.animal.id])) return { ...state, notice: "Upgrade the barn before welcoming this animal." };
    if (state.coins < cost) return { ...state, notice: `You need ${cost} coins.` };
    return { ...state, ...awardXp(state, 10), coins: state.coins - cost, animals: [...state.animals, action.animal], notice: `${action.animal.name} joined the farm!` };
  }

  return state;
}
