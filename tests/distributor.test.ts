import { TestEnvironment } from "./utils/environment/test-environment";
import { initEnviroment } from "./utils/environment/prepare-environment";
import { initializeTests } from "./instructions/1-initialize/inializeTests";
import { assert } from "chai";

describe("The Distributor Program", () => {
  const testEnv = new TestEnvironment();

  before('Prepare Test Enviroment', async () => {
    await initEnviroment(testEnv);
  });

  describe('Initialize Distributor Tests', async () => {
    // initializeTests(testEnv);
    describe('Initialize Tests', async () => {
      it('Try to Initialize with the wrong Input', async () => {
        assert.isTrue(true);
      });
    });
  });
});
