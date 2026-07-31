export interface FluxProductFeature {
  id: string;
  area: "AskAI" | "Stories" | "Studio";
  name: string;
  description: string;
}

export const FLUX_PRODUCT_FEATURES: FluxProductFeature[] = [
  { id: "local-rewrite", area: "AskAI", name: "Local rewriting", description: "Rewrite and clean supplied text without a remote model." },
  { id: "local-summary", area: "AskAI", name: "Local summaries", description: "Create concise summaries from pasted text on device." },
  { id: "local-captions", area: "AskAI", name: "Caption generator", description: "Create several social caption options locally." },
  { id: "local-hashtags", area: "AskAI", name: "Hashtag generator", description: "Extract useful keywords and produce hashtags locally." },
  { id: "local-brainstorm", area: "AskAI", name: "Idea brainstorming", description: "Generate content and project ideas without a server." },
  { id: "automatic-ai-fallback", area: "AskAI", name: "Automatic local fallback", description: "Use local AskAI whenever the remote endpoint is missing or fails." },
  { id: "movable-story-text", area: "Stories", name: "Movable text layers", description: "Drag Story text anywhere on the canvas." },
  { id: "scalable-story-text", area: "Stories", name: "Resizable text layers", description: "Resize text using handles or exact sliders." },
  { id: "rotatable-story-text", area: "Stories", name: "Rotatable text layers", description: "Rotate text freely with a dedicated handle." },
  { id: "multiple-story-text", area: "Stories", name: "Multiple text layers", description: "Add independent text blocks instead of one fixed caption." },
  { id: "story-layer-order", area: "Stories", name: "Layer ordering", description: "Move Story layers forward or backward." },
  { id: "story-layer-lock", area: "Stories", name: "Layer locking", description: "Lock elements to prevent accidental movement." },
  { id: "story-layer-visibility", area: "Stories", name: "Layer visibility", description: "Hide and show individual Story elements." },
  { id: "story-undo-redo", area: "Stories", name: "Undo and redo", description: "Reverse and restore Story layer edits." },
  { id: "story-snap-guides", area: "Stories", name: "Center snapping", description: "Snap layers to horizontal and vertical center guides." },
  { id: "story-safe-area", area: "Stories", name: "Safe-area overlay", description: "Keep important content away from Story chrome." },
  { id: "story-shapes", area: "Stories", name: "Shape layers", description: "Add rectangles, circles, lines and pills." },
  { id: "story-font-controls", area: "Stories", name: "Advanced typography", description: "Control font, size, alignment, weight, color and background." },
  { id: "story-draft-autosave", area: "Stories", name: "Story draft autosave", description: "Automatically preserve layer work on the device." },
  { id: "visual-scene-editor", area: "Studio", name: "Visual scene editor", description: "Build 2D scenes directly instead of only editing code." },
  { id: "studio-object-drag", area: "Studio", name: "Object dragging", description: "Move scene objects directly on the visual stage." },
  { id: "studio-object-resize", area: "Studio", name: "Object resizing", description: "Resize objects using a visual handle or inspector values." },
  { id: "studio-property-inspector", area: "Studio", name: "Property inspector", description: "Edit position, size, color, text, opacity and radius." },
  { id: "studio-local-commands", area: "Studio", name: "Local Studio commands", description: "Add and edit scene objects with commands that work offline." },
  { id: "studio-scene-versions", area: "Studio", name: "Visual version history", description: "Save and restore scene and code together." },
];

export function assertFluxProductFeatureCount(): void {
  if (FLUX_PRODUCT_FEATURES.length !== 25) {
    throw new Error(`Expected 25 Flux product features, found ${FLUX_PRODUCT_FEATURES.length}`);
  }
}
