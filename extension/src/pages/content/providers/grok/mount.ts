/**
 * Grok page world: same phase model as Gemini (DOM poll wait_capture).
 * Bundled as `grok-page.js`.
 *
 * @see `../../shared/providerPhaseModel.ts`
 */
import { registerGrokReceiveListener } from "./receive";

export function mountGrokPageWorld(): void {
  registerGrokReceiveListener();
}
