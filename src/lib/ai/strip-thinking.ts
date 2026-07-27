/**
 * Strip model "thinking" / chain-of-thought from assistant text.
 * Qwen and similar models often emit <think>...</think> or similar.
 */

const THINK_OPEN_TAGS = [
  "<think>",
  "<thinking>",
  "<thought>",
  "<reason>",
  "<reasoning>",
  "```thinking",
  "```thought",
];

/**
 * Remove completed think blocks and common "Thinking Process:" preambles.
 */
export function stripThinkingText(text: string): string {
  if (!text) return "";

  let out = text;

  // XML-style think blocks (including incomplete trailing open tags)
  out = out.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "");
  out = out.replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/gi, "");
  out = out.replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, "");
  out = out.replace(/<reason(?:ing)?>[\s\S]*?(?:<\/reason(?:ing)?>|$)/gi, "");

  // Markdown fenced thinking
  out = out.replace(/```(?:thinking|thought|reasoning)[\s\S]*?(?:```|$)/gi, "");

  // "Thinking Process:" / "Reasoning:" style dumps until blank line double or end
  out = out.replace(
    /^(?:thinking process|reasoning process|chain of thought|internal monologue)\s*:?\s*[\s\S]*?(?=\n\n[A-Z#*]|\n\n|$)/gim,
    ""
  );

  // Lines that are pure "Thinking..." labels
  out = out.replace(/^\s*(?:thinking|reasoning)\s*(?:process)?\s*:?\s*$/gim, "");

  // Orphan open tags at start
  for (const tag of THINK_OPEN_TAGS) {
    const idx = out.toLowerCase().indexOf(tag.toLowerCase());
    if (idx === 0 || (idx > 0 && out.slice(0, idx).trim() === "")) {
      // drop everything until close or keep nothing if still open
      const close =
        tag.startsWith("<") && !tag.startsWith("```")
          ? `</${tag.slice(1)}`
          : "```";
      const closeIdx = out.toLowerCase().indexOf(close.toLowerCase());
      if (closeIdx >= 0) {
        out = out.slice(closeIdx + close.length);
      } else if (idx >= 0) {
        // still inside thinking — drop all if no answer yet after
        out = "";
      }
    }
  }

  // Collapse excess blank lines
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

/**
 * Streaming filter: holds back content while inside a think block.
 */
export class StreamThinkingFilter {
  private buf = "";
  private inBlock = false;
  private blockClose = "";

  push(chunk: string): string {
    this.buf += chunk;
    let released = "";

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.inBlock) {
        const closeIdx = this.buf
          .toLowerCase()
          .indexOf(this.blockClose.toLowerCase());
        if (closeIdx === -1) {
          // keep last few chars in case close tag is split across chunks
          if (this.buf.length > 32) {
            this.buf = this.buf.slice(-32);
          }
          break;
        }
        this.buf = this.buf.slice(closeIdx + this.blockClose.length);
        this.inBlock = false;
        this.blockClose = "";
        continue;
      }

      const lower = this.buf.toLowerCase();
      let openIdx = -1;
      let openLen = 0;
      let close = "";

      const patterns: Array<{ open: string; close: string }> = [
        { open: "<think>", close: "</think>" },
        { open: "<thinking>", close: "</thinking>" },
        { open: "<thought>", close: "</thought>" },
        { open: "<reasoning>", close: "</reasoning>" },
        { open: "<reason>", close: "</reason>" },
        { open: "```thinking", close: "```" },
        { open: "```thought", close: "```" },
        { open: "```reasoning", close: "```" },
      ];

      for (const p of patterns) {
        const i = lower.indexOf(p.open);
        if (i !== -1 && (openIdx === -1 || i < openIdx)) {
          openIdx = i;
          openLen = p.open.length;
          close = p.close;
        }
      }

      // "Thinking Process:" at start of buffer/line
      const tp = lower.search(/(?:^|\n)\s*thinking process\s*:/);
      if (tp !== -1 && (openIdx === -1 || tp < openIdx)) {
        // treat until double newline as thinking
        const start = tp;
        released += this.buf.slice(0, start);
        const rest = this.buf.slice(start);
        const end = rest.search(/\n\n/);
        if (end === -1) {
          this.buf = rest;
          // hold
          break;
        }
        this.buf = rest.slice(end + 2);
        continue;
      }

      if (openIdx === -1) {
        // Avoid holding partial tag at end
        const hold = partialTagHold(this.buf);
        released += this.buf.slice(0, this.buf.length - hold);
        this.buf = this.buf.slice(this.buf.length - hold);
        break;
      }

      released += this.buf.slice(0, openIdx);
      this.buf = this.buf.slice(openIdx + openLen);
      this.inBlock = true;
      this.blockClose = close;
    }

    return released;
  }

  flush(): string {
    if (this.inBlock) {
      this.buf = "";
      this.inBlock = false;
      return "";
    }
    const left = stripThinkingText(this.buf);
    this.buf = "";
    return left;
  }
}

function partialTagHold(s: string): number {
  // If buffer ends with partial "<thi" or "```thi" hold it
  const tail = s.slice(-20);
  if (/<[a-z]*$/i.test(tail) || /```[a-z]*$/i.test(tail)) {
    const m = tail.match(/(<[a-z]*|```[a-z]*)$/i);
    return m ? m[0].length : 0;
  }
  if (/thinking process\s*:?$/i.test(tail)) {
    return Math.min(s.length, 40);
  }
  return 0;
}
