import { ZCC } from "@zcc/utilities"

declare module "@zcc/utilities" {
  export interface ZCC_Definition {
    module() : void;
  }
}


ZCC.module = () => {
//
}
