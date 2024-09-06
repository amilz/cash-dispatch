import { TestEnvironment } from "../../utils/environment/test-environment";
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
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
    allowClaims?: boolean,
    gatekeeperNetwork?: PublicKey,
}

export async function initialize(
    testEnv: TestEnvironment,
    initialize: Initialize,
) {
    const initializeParams = {
        merkleRoot: Array.from(initialize.merkleRoot),
        batchId: initialize.batchId,
        allowClaims: initialize.allowClaims ?? false,
        totalNumberRecipients: new BN(initialize.totalNumberRecipients),
        transferToVaultAmount: new BN(initialize.transferToVaultAmount),
        mintDecimals: initialize.mintDecimals,
        startTs: new BN(initialize.startTs),
        endTs: initialize.endTs ? new BN(initialize.endTs) : null,
        gatekeeperNetwork: initialize.gatekeeperNetwork ?? null,
    };

    const accounts = {
        authority: initialize.authority.publicKey,
        distributionTree: initialize.distributionTreePda,
        mint: initialize.mint,
        tokenSource: initialize.tokenSource,
        tokenVault: initialize.tokenVault,
        feesTokenAccount: getAssociatedTokenAddressSync(initialize.mint, testEnv.feesWallet.publicKey, false, TOKEN_2022_PROGRAM_ID),
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
        if (initialize.gatekeeperNetwork) {
            assert.strictEqual(distributionTreeData.gatekeeperNetwork?.toString(), initialize.gatekeeperNetwork.toString());
        }

    } catch (error) {
        throw error;
    }

}

interface CreateNewDistributionTreeParams {
    testEnv: TestEnvironment,
    numPayments?: number,
    startOffset?: number,
    allowClaims?: boolean,
    gatekeeperNetwork?: PublicKey,
}

export async function createNewDistributionTree({
    testEnv,
    numPayments,
    startOffset,
    allowClaims,
    gatekeeperNetwork
}: CreateNewDistributionTreeParams) {
    await testEnv.newTree({ numPayments, startOffset });
    let initializeParams: Initialize = {
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
        gatekeeperNetwork,
        allowClaims
    };
    await initialize(testEnv, initializeParams)
}
