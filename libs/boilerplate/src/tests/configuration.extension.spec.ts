import { ZCC } from "@zcc/utilities";

import { LIB_BOILERPLATE } from "../boilerplate.module.mjs";

describe("Configuration Extension Tests", () => {
  beforeAll(() => {
    LIB_BOILERPLATE.lifecycle.attach();
    // Any other setup needed before all tests
  });

  // Placeholder for afterAll if any cleanup is required

  it("should exist", () => {
    expect(ZCC.config).toBeDefined();
  });

  // describe("Information Retrieval", () => {
  //   it("can load values by path", () => {
  //     // Test loading values by path
  //   });

  //   it("can load by symbol reference", () => {
  //     // Test loading by symbol reference
  //   });

  //   it("loads module defaults", () => {
  //     // Test loading module defaults
  //   });

  //   it("can cast a boolean", () => {
  //     // Test boolean casting
  //   });

  //   it("can cast a number", () => {
  //     // Test number casting
  //   });

  //   it("can cast a string array", () => {
  //     // Test casting string arrays
  //   });
  // });

  describe("Early Init", () => {
    beforeEach(() => {
      // Setup before each test in this suite
    });

    it("loads defaults", () => {
      // Test loading defaults
    });

    describe("environment variable coercion", () => {
      it("pull from super simplified variable", () => {
        // Test pulling from a simplified variable
      });

      it("is case insensitive", () => {
        // Test case insensitivity
      });

      it("accepts dash or underscore", () => {
        // Test acceptance of dash or underscore
      });

      it("can accept direct references", () => {
        // Test accepting direct references
      });

      it("can accept direct references wacky style", () => {
        // Test accepting direct references with wacky styling
      });
    });

    describe("command line switch coercion", () => {
      it("can make sense of switches", () => {
        // Test interpreting command line switches
      });

      it("is case insensitive", () => {
        // Test case insensitivity in command line switches
      });
    });
  });

  // describe("Value Priority Resolution", () => {
  //   beforeEach(() => {
  //     // Setup before each test in this suite
  //   });

  //   it("respects inline configuration defaults", () => {
  //     // Test respecting inline configuration defaults
  //   });

  //   it("respects module configuration defaults", () => {
  //     // Test respecting module configuration defaults
  //   });

  //   it("lets bootstrap values override module", () => {
  //     // Test bootstrap values overriding module
  //   });

  //   it("prioritizes file configurations over code definitions", () => {
  //     // Test file configuration priority over code definitions
  //   });

  //   it("prioritizes environment variables over file configurations", () => {
  //     // Test environment variable priority over file configurations
  //   });

  //   it("prioritizes environment variables over file configurations with inline definitions", () => {
  //     // Test environment variable priority over file configurations with inline definitions
  //   });

  //   it("merges dynamic configuration on top of bootstrap configuration", () => {
  //     // Test merging dynamic configuration on top of bootstrap configuration
  //   });

  //   it("merges system source variables on top of dynamic configuration", () => {
  //     // Test merging system source variables on top of dynamic configuration
  //   });

  //   it("prioritizes environment variables over file configurations with different formatting", () => {
  //     // Test prioritizing environment variables over file configurations with different formatting
  //   });

  //   it("prioritizes switches over environment variables", () => {
  //     // Test prioritizing switches over environment variables
  //   });
  // });

  // describe("Edge Cases", () => {
  //   describe("Do not include configurations from unloaded modules", () => {
  //     it("module a", () => {
  //       // Test not including configurations from unloaded Module A
  //     });

  //     it("module b", () => {
  //       // Test not including configurations from unloaded Module B
  //     });
  //   });
  // });
});
