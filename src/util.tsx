import { EffectCallback, useEffect } from "react";

export function useEffectOnce(effect: EffectCallback, depedencies: Array<any>) {
  useEffect(effect, depedencies);
}
