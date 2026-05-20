const color = (text: string, colorCode: string) =>
  `\x1b[${colorCode}m${text}\x1b[0m`;

export const Colors = {
  red: (text: string) => color(text, "31"),
  green: (text: string) => color(text, "32"),
  yellow: (text: string) => color(text, "33"),
  blue: (text: string) => color(text, "34"),
  magenta: (text: string) => color(text, "35"),
  cyan: (text: string) => color(text, "36"),
};

export const Logger = {
  log: (...args: unknown[]) => {
    console.log(Colors.blue("[LOG]"), ...args);
  },
  error: (...args: unknown[]) => {
    console.error(Colors.red("[ERROR]"), ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(Colors.yellow("[WARN]"), ...args);
  },
  info: (...args: unknown[]) => {
    console.info(Colors.cyan("[INFO]"), ...args);
  },
  success: (...args: unknown[]) => {
    console.log(Colors.green("[SUCCESS]"), ...args);
  },
  debug: (...args: unknown[]) => {
    console.debug(Colors.magenta("[DEBUG]"), ...args);
  },
};
