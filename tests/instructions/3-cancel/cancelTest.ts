import { TestEnvironment } from "../../utils/environment/test-environment";
import { Cancel, cancel, createCancelParams } from "./cancel";
import { createNewDistributionTree, initialize, Initialize } from "../1-initialize/initialize";
import { createDistributeParams, distribute, Distribute } from "../2-distribute/distribute";
import { getAccountByIndex } from "../../utils/merkle-tree";
import { web3 } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { assertInstructionWillFail } from "../helpers";


/**
 * CANCEL INSTRUCTION TESTS
 * 
 * @param testEnv 
 * 
 * This test suite tests creates a new Distribution Tree (because the previous one should be depleted).
 * The test suite then:
 * 1. Cancels the Distribution Tree (verifying that the status is Cancelled, the token vault is empty, and the authority has received the remaining tokens)
 * 2. Verifies the Distribution Tree cannot distribute after canceling
 * 
 */
export async function cancelTests(testEnv: TestEnvironment) {
    let cancelParams: Cancel;
    let distributeParams: Distribute;

    describe('Canceling a tree before it is complete', async () => {

        before("Initializes a new distribution tree", async () => {
            await createNewDistributionTree({
                testEnv,
                numPayments: 5,
                startOffset: -100
            });
        });

        before('Set params', async () => {
            distributeParams = await createDistributeParams({ testEnv, index: 0 });
            cancelParams = await createCancelParams({ testEnv });
        });

        it('Cancels successfully', async () => {
            await cancel(testEnv, cancelParams);
        });
        it('Cannot cancel twice', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: cancelParams,
                executeInstruction: cancel,
                expectedAnchorError: "DistributionNotActive"
            });
        });
        it('Cannot distribute after canceling', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: distributeParams,
                executeInstruction: distribute,
                expectedAnchorError: "DistributionNotActive"
            });
        });
    });
}