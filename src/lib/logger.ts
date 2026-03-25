const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

const raw = process.env.LOG_LEVEL;
const currentLevel: Level = raw && raw in LEVELS ? (raw as Level) : "info";

const COLORS = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  magenta: "\x1b[35m",
} as const;

function timestamp(): string {
  return new Date().toISOString().slice(11, 23);
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function write(level: Level, scope: string, msg: string, extra?: object): void {
  if (LEVELS[level] < LEVELS[currentLevel]) return;
  const color = COLORS[level];
  const tag = level.toUpperCase().padEnd(5);
  const prefix = `${COLORS.dim}${timestamp()}${COLORS.reset} ${color}${tag}${COLORS.reset} ${COLORS.magenta}[${scope}]${COLORS.reset}`;

  if (extra) {
    const details = Object.entries(extra)
      .map(([k, v]) => `${COLORS.dim}${k}=${COLORS.reset}${v}`)
      .join(" ");
    console.log(`${prefix} ${msg} ${details}`);
  } else {
    console.log(`${prefix} ${msg}`);
  }
}

interface ScopedLogger {
  debug(msg: string, extra?: object): void;
  info(msg: string, extra?: object): void;
  warn(msg: string, extra?: object): void;
  error(msg: string, extra?: object): void;
  time(label: string): (extra?: object) => void;
}

export function createLogger(scope: string): ScopedLogger {
  return {
    debug: (msg, extra) => write("debug", scope, msg, extra),
    info: (msg, extra) => write("info", scope, msg, extra),
    warn: (msg, extra) => write("warn", scope, msg, extra),
    error: (msg, extra) => write("error", scope, msg, extra),
    time(label: string) {
      const start = performance.now();
      write("debug", scope, `${label} started`);
      return (extra?: object) => {
        const ms = Math.round(performance.now() - start);
        write("info", scope, `${label} ${COLORS.green}${formatMs(ms)}${COLORS.reset}`, extra);
      };
    },
  };
}
