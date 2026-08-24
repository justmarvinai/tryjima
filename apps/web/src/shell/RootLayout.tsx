import { Outlet } from "react-router-dom";
import { CommandPalette } from "./CommandPalette";
import { useBrandKitTheme } from "@/brand/useBrandKitTheme";

/**
 * The layout every route renders inside. Two jobs, both app-wide:
 *
 *  - the ⌘K command palette, which needs router context to navigate;
 *  - applying the saved brand kit, so a user's own colours and fonts are in
 *    place before either tool mounts.
 */
export function RootLayout() {
  useBrandKitTheme();
  return (
    <>
      <Outlet />
      <CommandPalette />
    </>
  );
}
