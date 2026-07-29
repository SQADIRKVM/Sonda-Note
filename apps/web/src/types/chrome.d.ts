/**
 * Minimal ambient declaration for the Chrome extension messaging API.
 *
 * The dashboard only ever calls `chrome.runtime.sendMessage(extensionId, msg)`
 * to hand the Supabase JWT to the Sonda Note extension, so declaring that one method
 * is preferable to adding @types/chrome — which would also declare hundreds of
 * APIs a web page cannot legally call.
 *
 * Typed as possibly-undefined because `chrome` is absent in Firefox and Safari,
 * and `chrome.runtime` is absent when the extension is not installed. Both cases
 * are guarded in auth-bridge.tsx.
 */
declare const chrome:
  | {
      runtime?: {
        sendMessage(extensionId: string, message: unknown): Promise<unknown>;
      };
    }
  | undefined;
