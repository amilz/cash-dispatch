import { TestEnvironment } from "../../utils/environment/test-environment";
import { web3 } from "@coral-xyz/anchor";
import { calculateAccountSize } from "../helpers";
import { assert } from "chai";

export interface Reclaim {
    overRideAuthority?: web3.Keypair
}

export interface Close {
    acknowledgeIrreversible: boolean,
    overRideAuthority?: web3.Keypair
}

export async function reclaim(testEnv: TestEnvironment, { overRideAuthority }: Reclaim) {
    try {
        let initialAccountInfo = await testEnv.program.provider.connection.getAccountInfo(testEnv.distributionTreePda);
        let initialAuthorityInfo = await testEnv.program.provider.connection.getAccountInfo(testEnv.authority.publicKey);
        if (!initialAccountInfo || !initialAuthorityInfo) {
            throw new Error("Initial account info not found");
        }
        const initialRent = await testEnv.program.provider.connection.getMinimumBalanceForRentExemption(initialAccountInfo.data.length);
        const authorityKey = overRideAuthority ? overRideAuthority : testEnv.authority;
        await testEnv.program.methods
            .reclaim({ batchId: testEnv.distributionUniqueId })
            .accounts({
                authority: authorityKey.publicKey,
                distributionTree: testEnv.distributionTreePda,
                systemProgram: web3.SystemProgram.programId,
            })
            .signers([authorityKey])
            .rpc();

        // Fetch updated DistributionTree data and account info
        let updatedDistributionTreeData = await testEnv.program.account.distributionTree.fetch(testEnv.distributionTreePda);
        let updatedAccountInfo = await testEnv.program.provider.connection.getAccountInfo(testEnv.distributionTreePda);
        let updatedAuthorityInfo = await testEnv.program.provider.connection.getAccountInfo(testEnv.authority.publicKey);
        const updatedBitmapSize = updatedDistributionTreeData.recipientsDistributedBitmap.length;
        if (!updatedAccountInfo || !updatedAuthorityInfo) {
            throw new Error("Updated account info not found");
        }
        const updatedRent = await testEnv.program.provider.connection.getMinimumBalanceForRentExemption(updatedAccountInfo.data.length);

        // Assert bitmap size
        const expectedBitmapSize = 0;
        assert.strictEqual(updatedBitmapSize, expectedBitmapSize, "Bitmap vector should be empty");

        // Assert account data size
        const expectedAccountSize = calculateAccountSize(expectedBitmapSize);
        assert.strictEqual(updatedAccountInfo.data.length, expectedAccountSize, "Account data size should match the expected size");

        // Assert rent
        assert.strictEqual(updatedRent, updatedAccountInfo.lamports, "Account balance should match the minimum rent");

        // Assert Balance
        const rentRecovered = initialRent - updatedRent;
        const expectedLamports = initialAuthorityInfo.lamports + rentRecovered;
        assert.strictEqual(expectedLamports, updatedAuthorityInfo.lamports, "Auth should gain rent less transaction fee");

    } catch (error) {
        throw error;
    }

}


export async function close(testEnv: TestEnvironment, { acknowledgeIrreversible, overRideAuthority }: Close) {
    try {
        let initialAccountInfo = await testEnv.program.provider.connection.getAccountInfo(testEnv.distributionTreePda);
        let initialAuthorityInfo = await testEnv.program.provider.connection.getAccountInfo(testEnv.authority.publicKey);
        if (!initialAccountInfo || !initialAuthorityInfo) {
            throw new Error("Initial account info not found");
        }
        const initialRent = await testEnv.program.provider.connection.getMinimumBalanceForRentExemption(initialAccountInfo.data.length);
        const authorityKey = overRideAuthority ? overRideAuthority : testEnv.authority;

        await testEnv.program.methods
            .close({ batchId: testEnv.distributionUniqueId, acknowledgeIrreversible })
            .accounts({
                authority: authorityKey.publicKey,
                distributionTree: testEnv.distributionTreePda,
                systemProgram: web3.SystemProgram.programId,
            })
            .signers([authorityKey])
            .rpc();

        // Assert that tree is no longer active
        let updatedDistributionTreeData = await testEnv.program.account.distributionTree.fetchNullable(testEnv.distributionTreePda);
        assert.isNull(updatedDistributionTreeData, "Distribution Tree should be closed");

        // Assert Balance
        let updatedAuthorityInfo = await testEnv.program.provider.connection.getAccountInfo(testEnv.authority.publicKey);

        if (!updatedAuthorityInfo) {
            throw new Error("Updated account info not found");
        }

        const rentRecovered = initialRent - 0;
        const expectedLamports = initialAuthorityInfo.lamports + rentRecovered;
        assert.strictEqual(expectedLamports, updatedAuthorityInfo.lamports, "Auth should gain rent less transaction fee");


    } catch (error) {
        throw error;
    }

}
