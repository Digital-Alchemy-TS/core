import { schedule } from "node-cron";

import { CreateApplication } from "..";
import { BASIC_BOOT, ServiceTest } from "./testing.helper";

jest.mock("node-cron", () => ({
  schedule: jest.fn(),
}));

describe("Fetch Extension", () => {
  beforeAll(async () => {
    // @ts-expect-error testing
    const preload = CreateApplication({ name: "testing" });
    await preload.bootstrap(BASIC_BOOT);
    await preload.teardown();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe("cron", () => {
    test("schedules a cron job and executes successfully", async () => {
      expect.assertions(1);
      await ServiceTest(async ({ scheduler }) => {
        const execMock = jest.fn();
        const cronMock = {
          start: jest.fn(),
          stop: jest.fn(),
        };

        (schedule as jest.Mock).mockReturnValue(cronMock);

        scheduler.cron({
          exec: execMock,
          label: "testLabel",
          schedule: "*/5 * * * *",
        });

        expect(schedule).toHaveBeenCalledWith(
          "*/5 * * * *",
          expect.any(Function),
        );
      });
    });
  });

  describe("sliding", () => {
    test("requires the correct args", async () => {
      expect.assertions(2);
      await ServiceTest(async ({ scheduler }) => {
        // @ts-expect-error testing
        expect(() => scheduler.sliding({})).toThrow();
        // @ts-expect-error testing
        expect(() => scheduler.sliding({ next: () => undefined })).toThrow();
      });
    });
  });
});
