// This interface is intended to be replaced at install with generated contents
// The contents of the file as it stands now are a lie, and only apply within te local repo

import { GenericEntityDTO } from "./helpers";

export const ENTITY_SETUP: Record<
  string,
  Record<string, GenericEntityDTO>
> = {};
/**
 * A very primitive approximation of the dynamic content
 */
export type iCallService = Record<
  string,
  Record<string, (service_data?: Record<string, unknown>) => Promise<void>>
>;
