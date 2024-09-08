import { TestEnvironment } from "../../utils/environment/test-environment";
import { Initialize, initialize } from "./initialize";
import { web3 } from "@coral-xyz/anchor";
import { getDistributionTreePDA, getTokenVaultAddress } from "../../utils/pdas";
import { assertInstructionWillFail } from "../helpers";


/**
 * INITIALIZE INSTRUCTION TESTS
 * 
 * @param testEnv 
 * 
 * This test suite:
 * 1. Verifies that the initialization cannot occur under a variety of incorrect parameters/conditions
 * 2. Verifies that the initialization can occur under proper parameters/conditions
 * 3. Verifies the tree cannot be reinitialized
 */
export async function initializeTests(testEnv: TestEnvironment) {
    let correctParams: Initialize;

    describe('Initializes a new distribution tree under various conditions', async () => {
        before('Set Initialize Params', async () => {
            correctParams = {
                authority: testEnv.authority,
                distributionTreePda: testEnv.distributionTreePda,
                mint: testEnv.pyUsdMint,
                tokenSource: testEnv.tokenSource,
                tokenVault: testEnv.tokenVault,
                merkleRoot: testEnv.balanceTree.getRoot(),
                batchId: testEnv.distributionUniqueId,
                totalNumberRecipients: Object.keys(testEnv.merkleDistributorInfo.payments).length,
                transferToVaultAmount: Object.values(testEnv.merkleDistributorInfo.payments).reduce((sum, payment) => sum + payment.amount.toNumber(), 0),
                mintDecimals: 6,
                startTs: testEnv.distributionStartTs,
                endTs: null,
            };
        });
        it('Cannot initialize with no recipients', async () => {
            const incorrectParams: Initialize = {
                ...correctParams,
                totalNumberRecipients: 0,
            };
            await assertInstructionWillFail({
                testEnv,
                params: incorrectParams,
                executeInstruction: initialize,
                expectedAnchorError: "NoRecipients"
            });
        });
        it('Cannot initialize with wrong distribution tree PDA ', async () => {
            const incorrectParams: Initialize = {
                ...correctParams,
                distributionTreePda: web3.Keypair.generate().publicKey,
            };
            await assertInstructionWillFail({
                testEnv,
                params: incorrectParams,
                executeInstruction: initialize,
            });
        });
        it('Cannot initialize with start timestamp after end timestamp', async () => {
            const incorrectParams: Initialize = {
                ...correctParams,
                startTs: Date.now() / 1000 + 7200,
                endTs: Date.now() / 1000 + 3600
            };
            await assertInstructionWillFail({
                testEnv,
                params: incorrectParams,
                executeInstruction: initialize,
                expectedAnchorError: "StartTimestampAfterEnd"
            });
        });
        it('Cannot initialize with end timestamp in the past', async () => {
            const incorrectParams: Initialize = {
                ...correctParams,
                endTs: Date.now() / 1000 - 3600
            };
            await assertInstructionWillFail({
                testEnv,
                params: incorrectParams,
                executeInstruction: initialize,
                expectedAnchorError: "TimestampsNotInFuture"
            });
        });
        it('Cannot initialize with zero transfer amount', async () => {
            const incorrectParams: Initialize = {
                ...correctParams,
                transferToVaultAmount: 0,
            };
            await assertInstructionWillFail({
                testEnv,
                params: incorrectParams,
                executeInstruction: initialize,
                expectedAnchorError: "ZeroTransferAmount"
            });
        });
        it('Cannot initialize with batch ID too short', async () => {
            const wrongBatchId = "short";
            const wrongTreePda = getDistributionTreePDA({
                distributorProgram: testEnv.program.programId,
                authority: testEnv.authority.publicKey,
                batchId: wrongBatchId
            });
            const wrongVault = getTokenVaultAddress({
                mint: testEnv.pyUsdMint,
                distributionTreePDA: wrongTreePda
            });
            const incorrectParams: Initialize = {
                ...correctParams,
                distributionTreePda: wrongTreePda,
                tokenVault: wrongVault,
                batchId: wrongBatchId,
            };
            await assertInstructionWillFail({
                testEnv,
                params: incorrectParams,
                executeInstruction: initialize,
                expectedAnchorError: "BatchIdTooShort"
            });
        });
        it('Cannot initialize with batch ID too long', async () => {
            const wrongBatchId = "THIS_BATCH_ID_IS_WAY_TOO_LONG";
            const wrongTreePda = getDistributionTreePDA({
                distributorProgram: testEnv.program.programId,
                authority: testEnv.authority.publicKey,
                batchId: wrongBatchId
            });
            const wrongVault = getTokenVaultAddress({
                mint: testEnv.pyUsdMint,
                distributionTreePDA: wrongTreePda
            });
            const incorrectParams: Initialize = {
                ...correctParams,
                distributionTreePda: wrongTreePda,
                tokenVault: wrongVault,
                batchId: wrongBatchId,
            };
            await assertInstructionWillFail({
                testEnv,
                params: incorrectParams,
                executeInstruction: initialize,
                expectedAnchorError: "BatchIdTooLong"
            });
        });
        it('Initializes successfully with correct parameters', async () => {
            await initialize(testEnv, correctParams);
        });
        it('Cannot re-initialize a tree that already exists', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: correctParams,
                executeInstruction: initialize,
                expectedTransactionError: "0x0"
            });
        });
    });
}