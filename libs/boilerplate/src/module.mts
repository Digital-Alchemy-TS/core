import { ZCC } from "@zcc/utilities"

function CreateLibraryModule() {
return  {
  //
}
}

declare module "@zcc/utilities" {
  export interface ZCC_Definition {
    library() : void;
  }
}


ZCC.library =function CreateLibraryModule() {
  return  {
    //
  }
  }
//
console.log("hit");
[1,2,3].sort();
