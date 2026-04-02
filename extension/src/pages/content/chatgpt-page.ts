/**
 * Page-world entry for chatgpt.com. Implementation is split under
 * `providers/chatgpt/*` by phase (see `shared/providerPhaseModel.ts`).
 *
 * @see `./shared/providerPhaseModel.ts`
 */
import { mountChatgptPageWorld } from "./providers/chatgpt/mount";

mountChatgptPageWorld();
