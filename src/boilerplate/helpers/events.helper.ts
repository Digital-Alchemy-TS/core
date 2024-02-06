import { is } from "../../utilities";

export const ZCC_NODE_GLOBAL_ERROR = "ZCC_NODE_GLOBAL_ERROR";
export const ZCC_APPLICATION_ERROR = "ZCC_APPLICATION_ERROR";
export const ZCC_LIBRARY_ERROR = (library?: string) =>
  is.empty(library) ? "ZCC_LIBRARY_ERROR" : `ZCC_LIBRARY_ERROR:${library}`;
