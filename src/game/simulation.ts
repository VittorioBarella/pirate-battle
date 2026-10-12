import type { GameConfig, Weapon } from "../config/gameConfig";
import { Input } from "./input";

export interface Body {
  id: number;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  radius: number;
  kind: "player" | "chaser" | "shooter";
  cooldown: number;
  flash: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  owner: "player" | "enemy";
}

export interface Effect {
  id: number;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  kind: "shot" | "hit" | "explosion";
}

export const islands = [
  { x: 480, y: 285, r: 73 },
  { x: 735, y: 450, r: 48 },
  { x: 230, y: 155, r: 44 },
];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const angleDelta = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Check the entire movement segment to detect fast projectiles.
export function segmentHit(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;

  const t = clamp(
    ((cx - ax) * dx + (cy - ay) * dy) / (dx * dx + dy * dy || 1),
    0,
    1,
  );

  return Math.hypot(ax + t * dx - cx, ay + t * dy - cy) <= radius;
}

export class Simulation {
  config: GameConfig;
  input: Input;
  player: Body;

  enemies: Body[] = [];
  bullets: Bullet[] = [];
  effects: Effect[] = [];

  elapsed = 0;
  score = 0;
  ended = false;
  reason: "time" | "death" = "time";
  paused = false;

  cooldown = { front: 0, port: 0, starboard: 0 };
  spawnClock = 0;
  spawnCount = 0;

  private id = 1;
  private seed: number;

  constructor(config: GameConfig, input: Input, seed = 1337) {
    this.config = structuredClone(config);
    this.input = input;
    this.seed = seed;

    this.player = {
      id: 0,
      x: 170,
      y: 430,
      angle: -Math.PI / 2,
      hp: config.player.health,
      maxHp: config.player.health,
      radius: config.player.radius,
      kind: "player",
      cooldown: 0,
      flash: 0,
    };
  }

  random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  effect(x: number, y: number, kind: Effect["kind"]): void {
    const life = kind === "explosion" ? 0.5 : 0.17;

    this.effects.push({
      id: this.id++,
      x,
      y,
      kind,
      life,
      maxLife: life,
    });
  }

  move(body: Body, distance: number): void {
    const { width, height } = this.config.arena;
    const radius = body.radius;

    const x = clamp(
      body.x + Math.cos(body.angle) * distance,
      radius,
      width - radius,
    );

    const y = clamp(
      body.y + Math.sin(body.angle) * distance,
      radius,
      height - radius,
    );

    const blocked = islands.some(
      (island) =>
        Math.hypot(x - island.x, y - island.y) < radius + island.r,
    );

    if (!blocked) {
      body.x = x;
      body.y = y;
    }
  }

  spawn(
    kind?: "chaser" | "shooter",
    position?: { x: number; y: number },
  ): void {
    const type =
      kind ??
      (this.spawnCount++ === 0
        ? "chaser"
        : this.spawnCount === 2
          ? "shooter"
          : this.random() < this.config.spawn.shooterRatio
            ? "shooter"
            : "chaser");

    const cfg = this.config[type];
    let point = position;

    // Skip this spawn if no safe position is found after 60 attempts.
    for (let attempt = 0; !point && attempt < 60; attempt++) {
      const x = 30 + this.random() * (this.config.arena.width - 60);
      const y = 30 + this.random() * (this.config.arena.height - 60);

      const farFromPlayer =
        Math.hypot(x - this.player.x, y - this.player.y) >
        this.config.spawn.minimumDistance;

      const overlapsIsland = islands.some(
        (island) =>
          Math.hypot(x - island.x, y - island.y) <
          island.r + cfg.radius + 12,
      );

      const overlapsEnemy = this.enemies.some(
        (enemy) =>
          Math.hypot(x - enemy.x, y - enemy.y) <
          enemy.radius + cfg.radius,
      );

      if (farFromPlayer && !overlapsIsland && !overlapsEnemy) {
        point = { x, y };
      }
    }

    if (!point) return;

    this.enemies.push({
      id: this.id++,
      ...point,
      kind: type,
      angle: Math.atan2(
        this.player.y - point.y,
        this.player.x - point.x,
      ),
      hp: cfg.health,
      maxHp: cfg.health,
      radius: cfg.radius,
      cooldown: cfg.cooldown,
      flash: 0,
    });
  }

  fire(
    body: Body,
    angle: number,
    weapon: Weapon,
    count: number,
    owner: Bullet["owner"],
  ): void {
    for (let index = 0; index < count; index++) {
      const offset = (index - (count - 1) / 2) * 16;

      const x =
        body.x +
        Math.cos(angle) * (body.radius + 5) -
        Math.sin(angle) * offset;

      const y =
        body.y +
        Math.sin(angle) * (body.radius + 5) +
        Math.cos(angle) * offset;

      this.bullets.push({
        id: this.id++,
        x,
        y,
        vx: Math.cos(angle) * weapon.speed,
        vy: Math.sin(angle) * weapon.speed,
        life: weapon.lifetime,
        damage: weapon.damage,
        owner,
      });

      this.effect(x, y, "shot");
    }
  }

  update(dt: number): void {
    if (this.paused || this.ended) return;
    if (!Number.isFinite(dt) || dt <= 0) return;

    dt = Math.min(dt, this.config.sessionTime - this.elapsed);
    this.elapsed += dt;

    const player = this.player;

    player.flash = Math.max(0, player.flash - dt);

    player.angle +=
      (Number(this.input.has("right")) -
        Number(this.input.has("left"))) *
      this.config.player.rotation *
      dt;

    if (this.input.has("forward")) {
      this.move(player, this.config.player.speed * dt);
    }

    for (const name of ["front", "port", "starboard"] as const) {
      this.cooldown[name] = Math.max(0, this.cooldown[name] - dt);

      if (this.input.has(name) && this.cooldown[name] <= 0) {
        const weapon =
          name === "front" ? this.config.front : this.config.side;

        const angleOffset =
          name === "port"
            ? -Math.PI / 2
            : name === "starboard"
              ? Math.PI / 2
              : 0;

        this.fire(
          player,
          player.angle + angleOffset,
          weapon,
          name === "front" ? 1 : 3,
          "player",
        );

        this.cooldown[name] = weapon.cooldown;
      }
    }

    this.spawnClock += dt;

    while (this.spawnClock + 1e-8 >= this.config.spawnTime) {
      this.spawnClock -= this.config.spawnTime;
      this.spawn();
    }

    for (const enemy of this.enemies) {
      if (player.hp <= 0) break;
      if (enemy.hp <= 0 || enemy.kind === "player") continue;

      const cfg = this.config[enemy.kind];
      const distance = Math.hypot(
        player.x - enemy.x,
        player.y - enemy.y,
      );

      let target = Math.atan2(
        player.y - enemy.y,
        player.x - enemy.x,
      );

      // Steer around islands before applying hard collision checks.
      for (const island of islands) {
        if (
          segmentHit(
            enemy.x,
            enemy.y,
            enemy.x + Math.cos(target) * 100,
            enemy.y + Math.sin(target) * 100,
            island.x,
            island.y,
            island.r + enemy.radius + 10,
          )
        ) {
          const from = Math.atan2(
            enemy.y - island.y,
            enemy.x - island.x,
          );

          target =
            from +
            (angleDelta(target, from) >= 0
              ? Math.PI / 2
              : -Math.PI / 2);

          break;
        }
      }

      enemy.angle += clamp(
        angleDelta(target, enemy.angle),
        -cfg.rotation * dt,
        cfg.rotation * dt,
      );

      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.cooldown -= dt;

      if (enemy.kind === "chaser" || distance > cfg.range * 0.72) {
        this.move(enemy, cfg.speed * dt);
      }

      if (
        enemy.kind === "chaser" &&
        Math.hypot(enemy.x - player.x, enemy.y - player.y) <=
          enemy.radius + player.radius
      ) {
        player.hp = Math.max(0, player.hp - cfg.damage);
        player.flash = 0.2;
        enemy.hp = 0;

        // Self-destruction does not award points.
        this.effect(enemy.x, enemy.y, "explosion");
      } else if (
        enemy.kind === "shooter" &&
        distance <= cfg.range &&
        Math.abs(
          angleDelta(
            Math.atan2(player.y - enemy.y, player.x - enemy.x),
            enemy.angle,
          ),
        ) < 0.2 &&
        enemy.cooldown <= 0
      ) {
        this.fire(
          enemy,
          enemy.angle,
          {
            ...this.config.front,
            damage: cfg.damage,
            cooldown: cfg.cooldown,
          },
          1,
          "enemy",
        );

        enemy.cooldown = cfg.cooldown;
      }
    }

    for (const bullet of this.bullets) {
      if (player.hp <= 0) break;
      if (bullet.life <= 0) continue;

      const travelTime = Math.min(dt, bullet.life);
      const x = bullet.x + bullet.vx * travelTime;
      const y = bullet.y + bullet.vy * travelTime;

      bullet.life = Math.max(0, bullet.life - dt);

      let distance = Infinity;
      let victim: Body | undefined;

      const targets =
        bullet.owner === "player" ? this.enemies : [player];

      for (const body of targets) {
        if (
          body.hp > 0 &&
          segmentHit(
            bullet.x,
            bullet.y,
            x,
            y,
            body.x,
            body.y,
            body.radius + 3,
          )
        ) {
          const targetDistance = Math.hypot(
            body.x - bullet.x,
            body.y - bullet.y,
          );

          if (targetDistance < distance) {
            distance = targetDistance;
            victim = body;
          }
        }
      }

      const obstacle = islands.some(
        (island) =>
          segmentHit(
            bullet.x,
            bullet.y,
            x,
            y,
            island.x,
            island.y,
            island.r,
          ) &&
          Math.hypot(
            island.x - bullet.x,
            island.y - bullet.y,
          ) -
            island.r <
            distance,
      );

      if (obstacle) {
        bullet.life = 0;
      } else if (victim) {
        victim.hp = Math.max(0, victim.hp - bullet.damage);
        victim.flash = 0.2;
        bullet.life = 0;

        this.effect(x, y, "hit");

        if (victim.hp === 0 && victim.kind !== "player") {
          this.score++;
          this.effect(victim.x, victim.y, "explosion");
        }
      }

      bullet.x = x;
      bullet.y = y;

      if (
        x < 0 ||
        x > this.config.arena.width ||
        y < 0 ||
        y > this.config.arena.height
      ) {
        bullet.life = 0;
      }
    }

    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);
    this.bullets = this.bullets.filter((bullet) => bullet.life > 0);

    for (const effect of this.effects) {
      effect.life -= dt;
    }

    this.effects = this.effects.filter((effect) => effect.life > 0);

    if (
      player.hp <= 0 ||
      this.elapsed >= this.config.sessionTime - 1e-8
    ) {
      this.ended = true;
      this.reason = player.hp <= 0 ? "death" : "time";
      this.input.clear();
    }
  }

  snapshot() {
    return {
      player: { ...this.player },
      enemies: this.enemies.map((enemy) => ({ ...enemy })),
      bullets: this.bullets.map((bullet) => ({ ...bullet })),
      cooldown: { ...this.cooldown },
      elapsed: this.elapsed,
      score: this.score,
      paused: this.paused,
      ended: this.ended,
      spawnCount: this.spawnCount,
    };
  }
}