import {
  bootTestingModule,
  LIB_BOILERPLATE,
  ZCCApplicationDefinition,
} from "@digital-alchemy/boilerplate";
import { ZCC } from "@digital-alchemy/utilities";

import { LIB_GOTIFY } from "../gotify.module.mjs";
import {
  Application,
  Client,
  Message,
  MessagePriority,
} from "../helpers/api.mjs";
import { BASE_URL, TOKEN } from "../helpers/config.constants.mjs";
import { GotifyFetch } from "./fetch.extension.mjs";

// Mock the necessary modules and functions
jest.mock("@digital-alchemy/utilities");

describe("GotifyFetch", () => {
  let gotifyFetch: ReturnType<typeof GotifyFetch>;
  let loadedModule: ZCCApplicationDefinition;
  const testBaseUrl = "http://gotify.test.local";
  const testToken = "abc123";

  async function createBaseModule() {
    if (loadedModule) {
      ZCC.lifecycle.teardown();
    }
    loadedModule = await bootTestingModule(
      {},
      {
        libs: {
          gotify: {
            [BASE_URL]: testBaseUrl,
            [TOKEN]: testToken,
          },
        },
      },
    );
    LIB_GOTIFY.lifecycle.register();
    LIB_BOILERPLATE.lifecycle.register();
    await ZCC.lifecycle.exec();
  }

  beforeEach(async () => {
    // Initialize the GotifyFetch before each test
    jest.spyOn(LIB_GOTIFY, "getConfig").mockImplementation((key: string) => {
      if (key === "BASE_URL") return testBaseUrl;
      if (key === "TOKEN") return testToken;
      return null;
    });
    gotifyFetch = GotifyFetch();
    await createBaseModule();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (loadedModule) {
      await ZCC.lifecycle.teardown();
      loadedModule = undefined;
    }
  });

  describe(".fetch", () => {
    it("should make a correct fetch call with provided arguments", async () => {
      // Mock implementation for ZCC.fetch.fetch
      const mockFetch = jest.fn().mockResolvedValue("mocked response");
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      const testData = {
        headers: {},
        url: "/test-url",
      };

      // Perform the fetch operation
      const response = await gotifyFetch.fetch(testData);

      // Assertions
      expect(mockFetch).toHaveBeenCalledWith({
        ...testData,
        baseUrl: testBaseUrl,
        headers: expect.objectContaining({
          "X-Gotify-Key": testToken,
        }),
      });
      expect(response).toEqual("mocked response");
    });
  });

  describe(".application", () => {
    const mockApplication: Application = {
      description: "Test Application Description",
      id: 1,
      image: "image/application_image.jpeg",
      internal: false,
      name: "Test Application",
      token: "AppToken123",
    };
    const mockMessage: Message = {
      appid: 1,
      date: "2024-01-07T12:00:00Z",
      extras: {
        "client::notification": {
          click: {
            url: "http://example.com",
          },
        },
      },
      id: 100,
      message: "Test message content",
      priority: MessagePriority.normal,
      title: "Test Message",
    };

    it("should call fetch with correct arguments to create an application", async () => {
      const mockFetch = jest.fn().mockResolvedValue(mockApplication);
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      const applicationParams = {
        description: "Test Description",
        name: "TestApp",
      };

      const response = await gotifyFetch.application.create(applicationParams);

      expect(mockFetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        body: JSON.stringify(applicationParams),
        headers: { "X-Gotify-Key": testToken },
        method: "post",
        url: `/application`,
      });
      expect(response).toEqual(mockApplication);
    });

    it("should call fetch with correct arguments to delete an application", async () => {
      const mockFetch = jest.fn().mockResolvedValue({});
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      const appId = 123;

      await gotifyFetch.application.delete(appId);

      expect(mockFetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        headers: { "X-Gotify-Key": testToken },
        method: "delete",
        url: `/application/${appId}`,
      });
    });

    it("should call fetch with correct arguments to delete messages of an application", async () => {
      const mockFetch = jest.fn().mockResolvedValue({});
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      const appId = 123;

      await gotifyFetch.application.deleteMessages(appId);

      expect(mockFetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        headers: { "X-Gotify-Key": testToken },
        method: "delete",
        url: `/application/${appId}/message`,
      });
    });

    it("should call fetch with correct arguments to get messages of an application", async () => {
      const mockFetch = jest.fn().mockResolvedValue([mockMessage]);
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      const appId = 123;
      const params = { limit: 10, since: 100 };

      const response = await gotifyFetch.application.getMessages(appId, params);

      expect(mockFetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        headers: { "X-Gotify-Key": testToken },
        params,
        url: `/application/${appId}/message`,
      });
      expect(response).toEqual([mockMessage]);
    });

    it("should call fetch with correct arguments to list applications", async () => {
      const mockFetch = jest.fn().mockResolvedValue([mockApplication]);
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      const response = await gotifyFetch.application.list();

      expect(mockFetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        headers: { "X-Gotify-Key": testToken },
        url: `/application`,
      });
      expect(response).toEqual([mockApplication]);
    });
  });

  describe(".client", () => {
    const mockClient: Client = {
      id: 123,
      name: "Test Client",
      token: "ClientToken123",
    };

    it("should call fetch with correct arguments to create a client", async () => {
      const mockFetch = jest.fn().mockResolvedValue(mockClient);
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      const response = await gotifyFetch.client.create(mockClient);

      expect(mockFetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        body: JSON.stringify(mockClient),
        headers: { "X-Gotify-Key": testToken },
        method: "post",
        url: "/client",
      });
      expect(response).toEqual(mockClient);
    });

    it("should call fetch with correct arguments to delete a client", async () => {
      const mockFetch = jest.fn().mockResolvedValue({});
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      await gotifyFetch.client.delete(mockClient.id);

      expect(mockFetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        headers: { "X-Gotify-Key": testToken },
        method: "delete",
        url: `/client/${mockClient.id}`,
      });
    });

    it("should call fetch with correct arguments to list clients", async () => {
      const mockFetch = jest.fn().mockResolvedValue([mockClient]);
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      const response = await gotifyFetch.client.list();

      expect(mockFetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        headers: { "X-Gotify-Key": testToken },
        url: "/client",
      });
      expect(response).toEqual([mockClient]);
    });

    it("should call fetch with correct arguments to update a client", async () => {
      const updatedClient = { ...mockClient, name: "Updated Test Client" };
      const mockFetch = jest.fn().mockResolvedValue(updatedClient);
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      const response = await gotifyFetch.client.update(
        mockClient.id,
        updatedClient,
      );

      expect(mockFetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        body: JSON.stringify(updatedClient),
        headers: { "X-Gotify-Key": testToken },
        method: "put",
        url: `/client/${mockClient.id}`,
      });
      expect(response).toEqual(updatedClient);
    });
  });

  describe(".message", () => {
    const mockMessage: Message = {
      appid: 1,
      date: "2024-01-07T12:00:00Z",
      extras: {
        "client::notification": {
          click: {
            url: "http://example.com",
          },
        },
      },
      id: 100,
      message: "Test message content",
      priority: MessagePriority.normal,
      title: "Test Message",
    };

    it("should call fetch with correct arguments to create a message", async () => {
      const mockFetch = jest.fn().mockResolvedValue(mockMessage);
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      const response = await gotifyFetch.message.create(mockMessage);

      expect(mockFetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        body: JSON.stringify(mockMessage),
        headers: { "X-Gotify-Key": testToken },
        method: "post",
        url: "/message",
      });
      expect(response).toEqual(mockMessage);
    });

    it("should call fetch with correct arguments to delete a message", async () => {
      const mockFetch = jest.fn().mockResolvedValue({});
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      await gotifyFetch.message.delete(mockMessage.id);

      expect(mockFetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        headers: { "X-Gotify-Key": testToken },
        method: "delete",
        url: `/message/${mockMessage.id}`,
      });
    });

    it("should call fetch with correct arguments to delete all messages", async () => {
      const mockFetch = jest.fn().mockResolvedValue({});
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      await gotifyFetch.message.deleteAll();

      expect(mockFetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        headers: { "X-Gotify-Key": testToken },
        method: "delete",
        url: `/message`,
      });
    });

    it("should call fetch with correct arguments to list messages", async () => {
      const mockFetch = jest.fn().mockResolvedValue([mockMessage]);
      (ZCC.fetch.fetch as jest.Mock) = mockFetch;

      const response = await gotifyFetch.message.list();

      expect(mockFetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        headers: { "X-Gotify-Key": testToken },
        url: "/message",
      });
      expect(response).toEqual([mockMessage]);
    });
  });
});
