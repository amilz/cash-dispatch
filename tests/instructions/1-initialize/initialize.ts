import { TestEnvironment } from "../../utils/environment/test-environment";
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BN } from '@coral-xyz/anchor';
import { assert } from 'chai';

export interface Initialize {
    authority: Keypair,
    distributionTreePda: PublicKey,
    mint: PublicKey,
    tokenSource: PublicKey,
    tokenVault: PublicKey,
    merkleRoot: Buffer,
    batchId: string,
    totalNumberRecipients: number,
    transferToVaultAmount: number,
    mintDecimals: number,
    startTs: number,
    endTs: number | null,
}

export async function initialize(
    testEnv: TestEnvironment,
    initialize: Initialize,
) {
    const initializeParams = {
        merkleRoot: Array.from(initialize.merkleRoot),
        batchId: initialize.batchId,
        totalNumberRecipients: new BN(initialize.totalNumberRecipients),
        transferToVaultAmount: new BN(initialize.transferToVaultAmount),
        mintDecimals: initialize.mintDecimals,
        startTs: new BN(initialize.startTs),
        endTs: initialize.endTs ? new BN(initialize.endTs) : null,
    };

    const accounts = {
        authority: initialize.authority.publicKey,
        distributionTree: initialize.distributionTreePda,
        mint: initialize.mint,
        tokenSource: initialize.tokenSource,
        tokenVault: initialize.tokenVault,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
    }
    try {
        await testEnv.program.methods.initialize(initializeParams)
            .accountsPartial(accounts)
            .signers([initialize.authority])
            .rpc({ commitment: "processed", skipPreflight: false });

        // Fetch and assert the DistributionTree account data
        let distributionTreeData = await testEnv.program.account.distributionTree.fetch(initialize.distributionTreePda);
        assert.strictEqual(distributionTreeData.authority.toString(), initialize.authority.publicKey.toString());
        assert.strictEqual(distributionTreeData.mint.toString(), initialize.mint.toString());
        assert.strictEqual(distributionTreeData.tokenVault.toString(), initialize.tokenVault.toString());
        assert.strictEqual(distributionTreeData.totalNumberRecipients.toNumber(), initialize.totalNumberRecipients);
        assert.strictEqual(distributionTreeData.startTs.toNumber(), initialize.startTs);

    } catch (error) {
        throw error;
    }

}
