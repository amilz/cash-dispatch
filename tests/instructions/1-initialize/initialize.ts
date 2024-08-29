import { TestEnvironment } from "../../utils/environment/test-environment";
import * as spl_token from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import * as web3 from '@solana/web3.js';
import { assert } from 'chai';

interface Initialize {
    authority: anchor.web3.Keypair,
    distributionTree: PublicKey,
    mint: PublicKey,
    tokenSource: PublicKey,
    tokenVault: PublicKey,
    merkleRoot: number[],
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
        merkleRoot: initialize.merkleRoot,
        totalNumberRecipients: new anchor.BN(initialize.totalNumberRecipients),
        transferToVaultAmount: new anchor.BN(initialize.transferToVaultAmount),
        mintDecimals: initialize.mintDecimals,
        startTs: new anchor.BN(initialize.startTs),
        endTs: initialize.endTs ? new anchor.BN(initialize.endTs) : null,
    };

    await testEnv.program.methods.initialize(initializeParams)
        .accounts({
            authority: initialize.authority.publicKey,
            // @ts-ignore
            distributionTree: initialize.distributionTree,
            mint: initialize.mint,
            tokenSource: initialize.tokenSource,
            tokenVault: initialize.tokenVault,
            associatedTokenProgram: spl_token.ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: spl_token.TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
        })
        .signers([initialize.authority])
        .rpc({ commitment: "confirmed" });

    // Fetch and assert the DistributionTree account data
    let distributionTreeData = await testEnv.program.account.distributionTree.fetch(initialize.distributionTree);
    assert.strictEqual(distributionTreeData.authority.toString(), initialize.authority.publicKey.toString());
    assert.strictEqual(distributionTreeData.mint.toString(), initialize.mint.toString());
    assert.strictEqual(distributionTreeData.tokenVault.toString(), initialize.tokenVault.toString());
    assert.strictEqual(distributionTreeData.totalNumberRecipients.toNumber(), initialize.totalNumberRecipients);
    assert.strictEqual(distributionTreeData.startTs.toNumber(), initialize.startTs);
    if (initialize.endTs) {
        assert.strictEqual(distributionTreeData.endTs.toNumber(), initialize.endTs);
    } else {
        assert.isNull(distributionTreeData.endTs);
    }

}


