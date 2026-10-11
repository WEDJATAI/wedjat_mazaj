// Inngest client — connects Mazaj to the Inngest background job platform.
// Used for: revocation polling, price sync, order sync retries, daily reports.

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "mazaj-hookah",
  name: "Mazaj Hookah Platform",
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
