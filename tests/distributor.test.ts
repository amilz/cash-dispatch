import { TestEnvironment } from "./utils/environment/test-environment";
import { initEnviroment } from "./utils/environment/prepare-environment";
import { initializeTests } from "./instructions/1-initialize/inializeTests";
import { distributeTests } from "./instructions/2-distribute/distributeTest";
import { initIdlToChain } from "./utils/environment/init-idl";
import { cancelTests } from "./instructions/3-cancel/cancelTest";

describe("The Distributor Program", () => {
  const testEnv = new TestEnvironment();

  before('Prepare Test Enviroment', async () => {
    await initEnviroment({ testEnv });
    await initIdlToChain();
  });

  describe('Initialize Distributor Tests', async () => {
    await initializeTests(testEnv);
  });

  describe('Distribute Tests', async () => {
    await distributeTests(testEnv);
  });

  describe('Cancel Tests', async () => {
    await cancelTests(testEnv);
  });

});
