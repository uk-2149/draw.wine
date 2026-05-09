import { debug } from "console";

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
  log: (...args: any[]) => {
    console.log(Colors.blue("[LOG]"), ...args);
  },
  error: (...args: any[]) => {
    console.error(Colors.red("[ERROR]"), ...args);
  },
  warn: (...args: any[]) => {
    console.warn(Colors.yellow("[WARN]"), ...args);
  },
  info: (...args: any[]) => {
    console.info(Colors.cyan("[INFO]"), ...args);
  },
  success: (...args: any[]) => {
    console.log(Colors.green("[SUCCESS]"), ...args);
  },
  debug: (...args: any[]) => {
    debug(Colors.magenta("[DEBUG]"), ...args);
  },
};
