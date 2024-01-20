import { faker } from "@faker-js/faker";

export class ZCCTestingDefinition {
  public APP_NAME = "zcc-unit-tests";

  /**
   * Some random that fits within the application config definitions
   */
  public generateRandomData() {
    return {
      application: {
        boolean: faker.datatype.boolean(),
        internal: {
          mqtt: {
            host: faker.internet.ip(),
            port: faker.number.int({ max: 65_535, min: 1024 }),
          },
        },
        number: faker.number.int(),
        record: {
          key1: faker.lorem.word(),
          key2: faker.lorem.word(),
        },
        string: faker.lorem.word(),
        stringArray: [
          faker.lorem.word(),
          faker.lorem.word(),
          faker.lorem.word(),
        ],
      },
    };
  }
}

export const ZCC_Testing = new ZCCTestingDefinition();
