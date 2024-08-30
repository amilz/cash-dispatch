import { assert } from "chai";
import { TestEnvironment } from "../utils/environment/test-environment";
import { AnchorError } from "@coral-xyz/anchor";

interface AssertInstructionWillFailParams<T> {
    testEnv: TestEnvironment;
    params: T;
    executeInstruction: (testEnv: TestEnvironment, params: T) => Promise<void>
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

