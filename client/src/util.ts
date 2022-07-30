import { Unixtime } from "./types";

export const currentTime: () => Unixtime = () => {
  return Date.now() / 1000;
};
