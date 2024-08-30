import { assert } from "chai";
import { TestEnvironment } from "../../utils/environment/test-environment";
import { Initialize, initialize } from "./initialize";
import { web3, BN, AnchorError } from "@coral-xyz/anchor";
import { getDistributionTreePDA, getTokenVaultAddress } from "../../utils/pdas";

export async function initializeTests(testEnv: TestEnvironment) {
    let correctParams: Initialize;

    before ('Set Initialize Params', async () => {
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
        await assertInitializeFails(testEnv, incorrectParams, "NoRecipients");
    });
    it('Cannot initialize with wrong distribution tree PDA ', async () => {
        const incorrectParams: Initialize = {
            ...correctParams,
            distributionTreePda: web3.Keypair.generate().publicKey,
        };
        try {
            await initialize(testEnv, incorrectParams);
            assert.fail("Initialization should have failed");
        } catch (error) {
            assert.ok(error, "Expected to fail");
        }
    });
    it('Cannot initialize with start timestamp after end timestamp', async () => {
        const incorrectParams: Initialize = {
            ...correctParams,
            startTs: Date.now() / 1000 + 7200,
            endTs: Date.now() / 1000 + 3600
        };
        await assertInitializeFails(testEnv, incorrectParams, "StartTimestampAfterEnd");
    });
    it('Cannot initialize with end timestamp in the past', async () => {
        const incorrectParams: Initialize = {
            ...correctParams,
            endTs: Date.now() / 1000 - 3600
        };
        await assertInitializeFails(testEnv, incorrectParams, "TimestampsNotInFuture");
    });

    it('Cannot initialize with zero transfer amount', async () => {
        const incorrectParams: Initialize = {
            ...correctParams,
            transferToVaultAmount: 0,
        };
        await assertInitializeFails(testEnv, incorrectParams, "ZeroTransferAmount");
    });

    it('Cannot initialize with batch ID too short', async () => {
        const wrongBatchId = "short";
        const wrongTreePda = getDistributionTreePDA({ 
            distributorProgram: testEnv.program.programId,
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
        await assertInitializeFails(testEnv, incorrectParams, "BatchIdTooShort");
    });

    it('Cannot initialize with batch ID too long', async () => {
        const wrongBatchId = "THIS_BATCH_ID_IS_WAY_TOO_LONG";
        const wrongTreePda = getDistributionTreePDA({ 
            distributorProgram: testEnv.program.programId,
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
        await assertInitializeFails(testEnv, incorrectParams, "BatchIdTooLong");
    });

    it('Initializes successfully', async () => {
        await initialize(testEnv, correctParams);
    });

    it('Cannot Re-Initialize', async () => {
        await assertInitializeFails(testEnv, correctParams, undefined, "0x0");
    });
}

async function assertInitializeFails(testEnv: TestEnvironment, params: Initialize, expectedAnchorError?: string, expectedTransactionError?: string) {
    try {
        await initialize(testEnv, params);
        assert.fail("Initialization should have failed");
    } catch (error) {
        assert.ok(error, "Expected to fail");
        if (expectedAnchorError) {
            const anchorError: AnchorError = error as AnchorError;
            assert.strictEqual(anchorError.error.errorCode.code, expectedAnchorError);
        }
        if (expectedTransactionError) {
            const transactionError = JSON.stringify(error);
            assert.ok(transactionError.includes(expectedTransactionError));
        }
    }
}
