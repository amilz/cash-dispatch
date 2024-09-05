import { assert } from "chai";
import { TestEnvironment } from "../utils/environment/test-environment";
import { AnchorError } from "@coral-xyz/anchor";
import { BITMAP_ARRAY_STEP } from "../utils/constants";

interface AssertInstructionWillFailParams<T> {
    testEnv: TestEnvironment;
    params: T;
    executeInstruction: (testEnv: TestEnvironment, params: T) => Promise<void | number>
    expectedAnchorError?: string;
    expectedTransactionError?: string;
    logError?: boolean;
}

export async function assertInstructionWillFail<T>({
    testEnv,
    params,
    executeInstruction,
    expectedAnchorError,
    expectedTransactionError,
    logError = false
}: AssertInstructionWillFailParams<T>) {
    try {
        await executeInstruction(testEnv, params);
        assert.fail("Instruction should have failed");
    } catch (error) {
        if (logError) {
            console.log(JSON.stringify(error));
        }
        assert.ok(error, "Expected to fail");
        if (expectedAnchorError) {
            const anchorError = error as AnchorError;
            assert.strictEqual(anchorError.error.errorCode.code, expectedAnchorError);
        }
        if (expectedTransactionError) {
            const transactionError = JSON.stringify(error);
            assert.ok(transactionError.includes(expectedTransactionError));
        }
    }
}

const processingIndicators = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function printDistributionProgress(totalDistributions: number, currentIndex: number) {
    const progress = Math.round(((currentIndex + 1) / totalDistributions) * 100);
    process.stdout.write(`\r      ${processingIndicators[
        currentIndex % processingIndicators.length
    ]} Distributing payments: ${progress}% complete`);
}

export function clearDistributionProgress() {
    process.stdout.write('\r');
}

export async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function calculateFutureBitmapSize(currentSize: number, numberRecipients: number) {
    return Math.min(currentSize + BITMAP_ARRAY_STEP, Math.ceil(numberRecipients / 64));
}

export function calculateAccountSize(bitmapSize: number, gatekeeperNetwork = false) {
    return 8 // discriminator
        + 1 // bump
        + 8 // version
        + 32 // authority
        + 4 + 20 // batch_id (4 bytes for length + max 20 bytes for string)
        + 1 // status (enum)
        + 1 // allow_claims
        + 32 // merkle_root
        + 32 // mint
        + 32 // token_vault
        + 8 // total_number_recipients
        + 8 // number_distributed
        + 8 // start_ts
        + 8 // end_ts
        + 4 // recipients_distributed_bitmap length
        + (bitmapSize * 8)
        + 1 // Option for gatekeeper network
        + (gatekeeperNetwork ? 32 : 0);
}

export async function verifyTreeComplete(testEnv: TestEnvironment, totalNumberRecipients: number) {
    // Fetch and assert the DistributionTree account data
    let distributionTreeData = await testEnv.program.account.distributionTree.fetch(testEnv.distributionTreePda);
    assert.strictEqual(distributionTreeData.numberDistributed.toNumber(), totalNumberRecipients);
    assert.deepStrictEqual(distributionTreeData.status, { complete: {} });
    distributionTreeData.recipientsDistributedBitmap.forEach((bitmap, index) => {
        const isLastElement = index === distributionTreeData.recipientsDistributedBitmap.length - 1;
        const expectedBits = isLastElement
            ? totalNumberRecipients % 64 || 64
            : 64;

        const binaryString = bitmap.toString(2).padStart(64, '0');
        const setbits = binaryString.split('1').length - 1;

        assert.strictEqual(
            setbits,
            expectedBits,
            `Bitmap element ${index} should have ${expectedBits} bits set, but has ${setbits}`
        );
    });

    // Fetch and assert the token vault token account data
    let tokenVaultTokenAccountData = await testEnv.program.provider.connection.getTokenAccountBalance(testEnv.tokenVault);
    assert.strictEqual(tokenVaultTokenAccountData.value.amount, '0');
}