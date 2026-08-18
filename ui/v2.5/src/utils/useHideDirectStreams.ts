import { useEffect, useState } from "react";
import ScreenUtils from "src/utils/screen";

const WINDOWS_ARM_CACHE_KEY = "stash-windows-arm";

interface INavigatorUAData {
  platform: string;
  getHighEntropyValues: (hints: string[]) => Promise<{
    architecture?: string;
    platform?: string;
  }>;
}

function readWindowsArmCache(): boolean | null {
  try {
    const value = window.sessionStorage.getItem(WINDOWS_ARM_CACHE_KEY);
    if (value === "1") return true;
    if (value === "0") return false;
  } catch {
    // ignore quota / private mode
  }
  return null;
}

function writeWindowsArmCache(value: boolean) {
  try {
    window.sessionStorage.setItem(WINDOWS_ARM_CACHE_KEY, value ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}

function uaLooksWindowsArm(): boolean {
  const ua = window.navigator.userAgent;
  return /Windows/i.test(ua) && /ARM64|aarch64/i.test(ua);
}

async function detectWindowsArm(): Promise<boolean> {
  if (uaLooksWindowsArm()) return true;

  const uad = (
    window.navigator as Navigator & { userAgentData?: INavigatorUAData }
  ).userAgentData;
  if (!uad?.getHighEntropyValues) return false;

  try {
    const hints = await uad.getHighEntropyValues(["architecture", "platform"]);
    const platform = (hints.platform || uad.platform || "").toLowerCase();
    const architecture = (hints.architecture || "").toLowerCase();
    return (
      platform.includes("win") &&
      (architecture === "arm" || architecture === "arm64")
    );
  } catch {
    return false;
  }
}

// 移动端或已缓存的 Windows ARM 设备同步判定为需要隐藏直接播放流
const shouldHideDirectStreams = () =>
  ScreenUtils.isMobile() ||
  uaLooksWindowsArm() ||
  readWindowsArmCache() === true;

export function useHideDirectStreams(): { hide: boolean; ready: boolean } {
  const [hide, setHide] = useState(shouldHideDirectStreams);
  const [ready, setReady] = useState(
    () =>
      ScreenUtils.isMobile() ||
      uaLooksWindowsArm() ||
      readWindowsArmCache() !== null
  );

  useEffect(() => {
    let cancelled = false;

    if (ScreenUtils.isMobile()) {
      setHide(true);
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    if (uaLooksWindowsArm()) {
      writeWindowsArmCache(true);
      setHide(true);
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    detectWindowsArm().then((isArm) => {
      if (cancelled) return;
      writeWindowsArmCache(isArm);
      setHide(ScreenUtils.isMobile() || isArm);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { hide, ready };
}
