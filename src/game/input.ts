export type Action =
  | "forward"
  | "left"
  | "right"
  | "front"
  | "port"
  | "starboard";

export class Input {
  private sources = new Map<string, Action>();

  set(source: string, action: Action): void {
    this.sources.set(source, action);
  }

  release(source: string): void {
    this.sources.delete(source);
  }

  has(action: Action): boolean {
    for (const activeAction of this.sources.values()) {
      if (activeAction === action) {
        return true;
      }
    }

    return false;
  }

  clear(): void {
    this.sources.clear();
  }
}

export const keys: Record<string, Action> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "front",
  KeyQ: "port",
  KeyE: "starboard",
};