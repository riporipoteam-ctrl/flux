import type { StoryFont, StorySticker } from "@/services/stories";
import { cn } from "@/lib/utils";

export function StoryLayerRenderer({ layer, index = 0 }: { layer: StorySticker; index?: number }) {
  if (layer.hidden) return null;
  const width = layer.kind === "emoji" ? undefined : `${layer.width ?? (layer.kind === "text" ? 72 : 42)}%`;
  return (
    <span
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none"
      style={{
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        zIndex: 30 + index,
        width,
        opacity: layer.opacity ?? 1,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
      }}
    >
      {layer.kind === "emoji" ? (
        <span className="block leading-none drop-shadow-xl" style={{ fontSize: `${layer.fontSize ?? 54}px` }}>{layer.value}</span>
      ) : layer.kind === "shape" ? (
        <span
          className={cn(
            "block w-full",
            layer.shape === "circle" && "aspect-square rounded-full",
            layer.shape === "rectangle" && "aspect-[2/1] rounded-md",
            layer.shape === "pill" && "h-12 rounded-full",
            layer.shape === "line" && "h-1 rounded-full"
          )}
          style={{ background: layer.background || layer.color || "#ffffff" }}
        />
      ) : (
        <span
          className={cn(
            "block w-full whitespace-pre-wrap px-3 py-2 leading-[1.05]",
            fontClass(layer.fontFamily),
            layer.kind === "label" && "rounded-xl"
          )}
          style={{
            color: layer.color || "#ffffff",
            background: layer.background || "transparent",
            fontSize: `${layer.fontSize ?? 32}px`,
            fontWeight: layer.fontWeight ?? 800,
            textAlign: layer.align || "center",
            borderRadius: layer.kind === "text" && layer.background !== "transparent" ? "14px" : undefined,
          }}
        >
          {layer.value}
        </span>
      )}
    </span>
  );
}

function fontClass(font?: StoryFont): string {
  if (font === "display") return "font-black tracking-tight";
  if (font === "serif") return "font-serif";
  if (font === "mono") return "font-mono";
  return "font-sans";
}
