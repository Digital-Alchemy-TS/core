import { ZCC } from "@zcc/utilities";

import { GotifyFetch } from "./fetch.extension.mjs";

// Mock the necessary modules and functions
jest.mock("@zcc/utilities");

describe("GotifyFetch", () => {
  let gotifyFetch: ReturnType<typeof GotifyFetch>;

  beforeEach(() => {
    // Initialize the GotifyFetch before each test
    gotifyFetch = GotifyFetch();
  });

  describe(".fetch", () => {
    it("should make a correct fetch call with provided arguments", async () => {
      // Mock implementation for ZCC.fetch.fetch
      const mockFetch = jest.fn().mockResolvedValue("mocked response");
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      // Define test data
      const testData = {
        // body: undefined,
        headers: {},
        // method: "GET",
        url: "/test-url",
      };

      // Perform the fetch operation
      const response = await gotifyFetch.fetch(testData);

      // Assertions
      expect(mockFetch).toHaveBeenCalledWith({
        ...testData,
        baseUrl: expect.any(String), // Adjust as needed
        headers: expect.objectContaining({
          "X-Gotify-Key": expect.any(String),
        }),
      });
      expect(response).toEqual("mocked response");
    });

    // Additional tests for different scenarios like error handling, different HTTP methods, etc.
  });

  // Additional describe blocks for other methods
});
