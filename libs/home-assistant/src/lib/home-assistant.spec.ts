import { homeAssistant } from "./home-assistant";

describe("homeAssistant", () => {
  it("should work", () => {
    expect(homeAssistant()).toEqual("home-assistant");
  });
});
