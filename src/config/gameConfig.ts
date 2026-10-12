export interface Options {
  sessionTime: number;
  spawnTime: number;
}

export interface Weapon {
  damage: number;
  cooldown: number;
  speed: number;
  lifetime: number;
}

export interface EnemyConfig {
  health: number;
  speed: number;
  rotation: number;
  radius: number;
  damage: number;
  range: number;
  cooldown: number;
}

export interface GameConfig extends Options {
  arena: { width: number; height: number };
  player: {
    health: number;
    speed: number;
    rotation: number;
    radius: number;
  };
  front: Weapon;
  side: Weapon;
  chaser: EnemyConfig;
  shooter: EnemyConfig;
  spawn: {
    minimumDistance: number;
    shooterRatio: number;
  };
}

export const defaultOptions: Options = {
  sessionTime: 120,
  spawnTime: 4,
};

export function validateOptions(options: Options): boolean {
  return (
    Number.isFinite(options.sessionTime) &&
    options.sessionTime >= 60 &&
    options.sessionTime <= 180 &&
    Number.isFinite(options.spawnTime) &&
    options.spawnTime >= 1 &&
    options.spawnTime <= 15
  );
}

export const makeConfig = (options: Options): GameConfig => ({
  ...options,
  arena: { width: 960, height: 600 },
  player: {
    health: 100,
    speed: 185,
    rotation: 2.7,
    radius: 21,
  },
  front: {
    damage: 25,
    cooldown: 0.42,
    speed: 390,
    lifetime: 1.6,
  },
  side: {
    damage: 20,
    cooldown: 1.15,
    speed: 350,
    lifetime: 1.4,
  },
  chaser: {
    health: 45,
    speed: 105,
    rotation: 2.1,
    radius: 20,
    damage: 22,
    range: 0,
    cooldown: 0,
  },
  shooter: {
    health: 65,
    speed: 80,
    rotation: 1.8,
    radius: 22,
    damage: 12,
    range: 300,
    cooldown: 1.8,
  },
  spawn: {
    minimumDistance: 260,
    shooterRatio: 0.5,
  },
});

// Rankings must compare matches played with the same configuration.
export const configKey = (config: GameConfig): string =>
  JSON.stringify(config);