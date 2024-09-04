// File: Code/Fun/distributor/tests/instructions/6-pause/pauseResume.ts

import { web3 } from "@coral-xyz/anchor";
import { TestEnvironment } from "../../utils/environment/test-environment";
import { assert } from "chai";

export interface PauseResume {
    authority: web3.Keypair;
    distributionTreePda: web3.PublicKey;
    batchId: string;
}

export async function pause(
    testEnv: TestEnvironment,
    params: PauseResume
): Promise<void> {
    try {
        await testEnv.program.methods
            .pause({
                batchId: params.batchId,
            })
            .accounts({
                authority: params.authority.publicKey,
                distributionTree: params.distributionTreePda,
            })
            .signers([params.authority])
            .rpc();

        const treeInfo = await testEnv.program.account.distributionTree.fetch(testEnv.distributionTreePda);
        assert.deepStrictEqual(treeInfo.status, { paused: {} });
    } catch (error) {
        throw error;
    }
}

export async function resume(
    testEnv: TestEnvironment,
    params: PauseResume
): Promise<void> {
    try {
        await testEnv.program.methods
            .resume({
                batchId: params.batchId,
            })
            .accounts({
                authority: params.authority.publicKey,
                distributionTree: params.distributionTreePda,
            })
            .signers([params.authority])
            .rpc();
        const treeInfo = await testEnv.program.account.distributionTree.fetch(testEnv.distributionTreePda);
        assert.deepStrictEqual(treeInfo.status, { active: {} });
    } catch (error) {
        throw error;
    }
}