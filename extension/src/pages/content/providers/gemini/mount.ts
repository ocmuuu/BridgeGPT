/**
 * Gemini page world: phases resolve_composer → fill → submit → wait_capture → emit.
 * Bundled as `gemini-page.js`. Keep message constants in sync with `GeminiWebProvider.tsx`.
 *
 * @see `../../shared/providerPhaseModel.ts`
 */
import { registerGeminiReceiveListener } from "./receive";

export function mountGeminiPageWorld(): void {
  registerGeminiReceiveListener();
}
