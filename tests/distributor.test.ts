import { TestEnvironment } from "./utils/environment/test-environment";
import { initEnviroment } from "./utils/environment/prepare-environment";
import { initializeTests } from "./instructions/1-initialize/initializeTests";
import { distributeTests } from "./instructions/2-distribute/distributeTests";
import { initIdlToChain } from "./utils/environment/init-idl";
import { cancelTests } from "./instructions/3-cancel/cancelTests";
import { expandTests } from "./instructions/4-expand/expandTests";
import { claimTests } from "./instructions/5-claim/claimTests";
import { pauseResumeTests } from "./instructions/6-pause/pauseResumeTests";
import { gatekeeperTests } from "./instructions/7-gatekeeper/gatekeeperTests";
import { reclaimTests } from "./instructions/8-reclaim/reclaimTests";

describe("The Distributor Program", () => {
  const testEnv = new TestEnvironment();

  before('Prepare Test Enviroment', async () => {
    await initEnviroment({ testEnv });
    await initIdlToChain();
  });

  describe('Initialize Instruction Tests', () => initializeTests(testEnv));
  describe('Distribute Instruction Tests', () => distributeTests(testEnv));
  describe('Cancel Instruction Tests', () => cancelTests(testEnv));
  describe('Expand Instruction Tests', () => expandTests(testEnv));
  describe('Claim Instruction Tests', () => claimTests(testEnv));
  describe('Pause/Resume Instruction Tests', () => pauseResumeTests(testEnv));
  describe('Gatekeeper Authorization Tests', () => gatekeeperTests(testEnv));
  describe('Reclaim & Close Instruction Tests', () => reclaimTests(testEnv));

});
