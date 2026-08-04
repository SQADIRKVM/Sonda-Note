"use client";

import { useEffect } from "react";

import type { Session } from "@/lib/auth";

/**
 * Pushes the session into the Chrome extension.
 *
 * Step 2 of the spec's auth flow: the dashboard owns sign-in, and the extension
 * needs the resulting JWT to authenticate its chunk uploads.
 *
 * chrome.runtime.sendMessage from a web page only reaches an extension whose
 * `externally_connectable` list includes this origin; anything else is silently
 * ignored by Chrome.
 */
export function AuthBridge({ session }: { session: Session }) {
  useEffect(() => {
    const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;
    const runtime = typeof chrome !== "undefined" ? chrome?.runtime : undefined;
    if (!extensionId || !runtime?.sendMessage) return;

    const push = () => {
      try {
        runtime.sendMessage(extensionId, {
          type: "SONDANOTE_SET_AUTH",
          accessToken: session.access_token,
          expiresAt: session.expires_at,
          email: session.user.email,
          workspaceId: session.workspace.id,
          workspaceName: session.workspace.name,
        });
      } catch {
        // Extension not installed — expected for most visitors.
      }
    };

    push();

    // The extension may be installed, reloaded, or updated while this tab is
    // already open, and a service worker that restarts loses nothing but still
    // needs to be told. Re-push when the tab regains focus so the user never has
    // to reload the dashboard to link the extension.
    const onFocus = () => push();
    window.addEventListener("focus", onFocus);

    // Also answer an explicit request from the extension (see PULL_AUTH in
    // background.ts), which covers the case where the user signed in before
    // installing the extension.
    const onMessage = (event: MessageEvent) => {
      if (event.source === window && event.data?.type === "SONDANOTE_REQUEST_AUTH") push();
    };
    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("message", onMessage);
    };
  }, [session]);

  return null;
}
