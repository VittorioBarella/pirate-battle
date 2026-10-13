import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Texture,
  TilingSprite,
} from "pixi.js";

import { islands } from "./simulation";
import type { Body, Simulation } from "./simulation";

const files = {
  player: "/assets/default/ships/ship_2.png",
  chaser: "/assets/default/ships/ship_3.png",
  shooter: "/assets/default/ships/ship_5.png",
  water: "/assets/default/tiles/tile_73.png",
  grass: "/assets/default/tiles/tile_39.png",
  explosion: "/assets/default/effects/explosion_1.png",
  fire: "/assets/default/effects/fire_1.png",
};

type GameTextures = Record<keyof typeof files, Texture>;

interface ShipView {
  root: Container;
  sprite: Sprite;
  bar: Graphics;
  fire: Sprite;
}

let loaded: Promise<GameTextures> | undefined;

export function loadTextures(): Promise<GameTextures> {
  if (!loaded) {
    loaded = Promise.all(
      Object.entries(files).map(async ([key, url]) => {
        const simulateFailure =
          import.meta.env.VITE_TEST_MODE === "true" &&
          key === "water" &&
          new URLSearchParams(location.search).get("assetFailure") === "1";

        const texture = await Assets.load<Texture>(
          simulateFailure ? "/assets/missing-water.png" : url,
        );

        return [key, texture] as const;
      }),
    )
      .then((entries) => Object.fromEntries(entries) as GameTextures)
      .catch((error: unknown) => {
        loaded = undefined;
        throw error;
      });
  }

  return loaded;
}

export class GameRenderer {
  app = new Application();
  world = new Container();
  ships = new Map<number, ShipView>();
  graphics = new Graphics();
  effects = new Map<number, Sprite>();

  private textures!: GameTextures;

  async init(
    host: HTMLElement,
    textures: GameTextures,
  ): Promise<void> {
    await this.app.init({
      width: 960,
      height: 600,
      background: 0x123d50,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      antialias: true,
    });

    this.textures = textures;

    host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute("aria-label", "Naval battle arena");
    this.app.canvas.dataset.testid = "game-canvas";

    this.app.stage.addChild(this.world);

    const water = new TilingSprite({
      texture: textures.water,
      width: 960,
      height: 600,
    });

    water.tint = 0x8dd1df;
    this.world.addChild(water);

    const coast = new Graphics();

    for (const island of islands) {
      coast
        .circle(island.x, island.y, island.r + 8)
        .fill({ color: 0x81d1c5, alpha: 0.55 })
        .circle(island.x, island.y, island.r)
        .fill(0xe7c383)
        .circle(island.x, island.y - 5, island.r * 0.8)
        .fill(0x5e995d);

      const tree = new Sprite(textures.grass);

      tree.anchor.set(0.5);
      tree.position.set(island.x, island.y);
      tree.width = island.r;
      tree.height = island.r;

      this.world.addChild(tree);
    }

    this.world.addChildAt(coast, 1);
    this.world.addChild(this.graphics);
  }

  drawBody(body: Body): void {
    let view = this.ships.get(body.id);

    if (!view) {
      const root = new Container();
      const sprite = new Sprite(this.textures[body.kind]);
      const bar = new Graphics();
      const fire = new Sprite(this.textures.fire);

      sprite.anchor.set(0.5);
      sprite.width = 42;
      sprite.height = 66;

      fire.anchor.set(0.5);
      fire.width = 20;
      fire.height = 26;

      root.addChild(sprite, fire, bar);
      this.world.addChild(root);

      view = { root, sprite, bar, fire };
      this.ships.set(body.id, view);
    }

    const healthRatio = body.hp / body.maxHp;

    view.root.position.set(body.x, body.y);
    view.sprite.rotation = body.angle - Math.PI / 2;

    view.sprite.tint =
      body.flash > 0
        ? 0xffb7a0
        : healthRatio < 0.35
          ? 0x998b78
          : 0xffffff;

    view.fire.visible = healthRatio < 0.35;
    view.fire.position.set(0, 8);

    const color =
      body.kind === "player"
        ? 0x82e7ba
        : body.kind === "chaser"
          ? 0xff806e
          : 0x94c4ff;

    view.bar
      .clear()
      .roundRect(-24, -45, 48, 7, 3)
      .fill(0x071e2b)
      .roundRect(-23, -44, 46 * healthRatio, 5, 2)
      .fill(color);
  }

  render(simulation: Simulation): void {
    const bodies = [simulation.player, ...simulation.enemies];

    for (const body of bodies) {
      this.drawBody(body);
    }

    const liveShips = new Set(bodies.map((body) => body.id));

    for (const [id, view] of this.ships) {
      if (!liveShips.has(id)) {
        view.root.destroy({ children: true });
        this.ships.delete(id);
      }
    }

    this.graphics.clear();

    for (const bullet of simulation.bullets) {
      this.graphics
        .circle(bullet.x, bullet.y, 4)
        .fill(bullet.owner === "player" ? 0xffe5a0 : 0xff826e);
    }

    for (const effect of simulation.effects) {
      let sprite = this.effects.get(effect.id);

      if (!sprite) {
        sprite = new Sprite(this.textures.explosion);
        sprite.anchor.set(0.5);

        this.world.addChild(sprite);
        this.effects.set(effect.id, sprite);
      }

      sprite.position.set(effect.x, effect.y);

      const size = effect.kind === "explosion" ? 75 : 24;
      const remainingLife = effect.life / effect.maxLife;

      sprite.width = size * (1 + (1 - remainingLife) * 0.4);
      sprite.height = sprite.width;
      sprite.alpha = remainingLife;
    }

    const liveEffects = new Set(
      simulation.effects.map((effect) => effect.id),
    );

    for (const [id, sprite] of this.effects) {
      if (!liveEffects.has(id)) {
        sprite.destroy();
        this.effects.delete(id);
      }
    }
  }

  destroy(): void {
    this.ships.clear();
    this.effects.clear();

    // Shared textures remain cached for subsequent matches.
    this.app.destroy(true, {
      children: true,
      texture: false,
      textureSource: false,
    });
  }
}