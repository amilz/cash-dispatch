import { TestEnvironment } from "../../utils/environment/test-environment";
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { assert } from 'chai';
import { calculateAccountSize, calculateFutureBitmapSize } from "../helpers";

export interface Expand {
    authority: Keypair,
    distributionTreePda: PublicKey,
    batchId: string,
}

export async function expand(
    testEnv: TestEnvironment,
    expand: Expand,
) {
    const expandParams = {
        batchId: expand.batchId,
    };

    const accounts = {
        authority: expand.authority.publicKey,
        distributionTree: expand.distributionTreePda,
        systemProgram: SystemProgram.programId,
    }

    try {

        let initialDistributionTreeData = await testEnv.program.account.distributionTree.fetch(expand.distributionTreePda);
        let initialAccountInfo = await testEnv.program.provider.connection.getAccountInfo(expand.distributionTreePda);
        const initialBitmapSize = initialDistributionTreeData.recipientsDistributedBitmap.length;
        if (!initialAccountInfo) {
            throw new Error("Initial account info not found");
        }

        await testEnv.program.methods.expandDistributionTree(expandParams)
            .accountsPartial(accounts)
            .signers([expand.authority])
            .rpc({ commitment: "confirmed" });

        // Fetch updated DistributionTree data and account info
        let updatedDistributionTreeData = await testEnv.program.account.distributionTree.fetch(expand.distributionTreePda);
        let updatedAccountInfo = await testEnv.program.provider.connection.getAccountInfo(expand.distributionTreePda);
        const updatedBitmapSize = updatedDistributionTreeData.recipientsDistributedBitmap.length;
        const updatedStatus = updatedDistributionTreeData.status;
        if (!updatedAccountInfo) {
            throw new Error("Updated account info not found");
        }
        const updatedRent = await testEnv.program.provider.connection.getMinimumBalanceForRentExemption(updatedAccountInfo.data.length);

        // Assert bitmap size
        const expectedBitmapSize = calculateFutureBitmapSize(initialBitmapSize, updatedDistributionTreeData.totalNumberRecipients.toNumber());
        assert.strictEqual(updatedBitmapSize, expectedBitmapSize, "Bitmap size should match the expected size");

        // Assert account data size
        const expectedAccountSize = calculateAccountSize(expectedBitmapSize);
        assert.strictEqual(updatedAccountInfo.data.length, expectedAccountSize, "Account data size should match the expected size");

        // Assert rent
        assert.strictEqual(updatedRent, updatedAccountInfo.lamports, "Account balance should match the minimum rent");

        // Assert status
        const isComplete = updatedBitmapSize >= Math.ceil(updatedDistributionTreeData.totalNumberRecipients.toNumber() / 64);
        if (isComplete) {
            assert.deepStrictEqual(updatedStatus, { active: {} }, "Status should be Active if bitmap is now sufficient");
        } else {
            assert.deepStrictEqual(updatedStatus, { insufficientBitmapSpace: {} }, "Status should still be InsufficientBitmapSpace if more expansion is needed");
        }
    } catch (error) {
        throw error;
    }
}

interface CreateExpandParams {
    testEnv: TestEnvironment
}

export function createExpandParams({ testEnv }: CreateExpandParams): Expand {
    return {
        authority: testEnv.authority,
        distributionTreePda: testEnv.distributionTreePda,
        batchId: testEnv.distributionUniqueId,
    }
}