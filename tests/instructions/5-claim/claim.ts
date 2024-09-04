import { TestEnvironment } from "../../utils/environment/test-environment";
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BN, web3 } from '@coral-xyz/anchor';
import { assert } from 'chai';
import { getSimulationComputeUnits } from "../../utils/solana-helpers";
import { isBitSet } from "../../utils/merkle-tree";

export interface Claim {
    claimant: Keypair,
    distributionTreePda: PublicKey,
    mint: PublicKey,
    tokenVault: PublicKey,
    claimantTokenAccount: PublicKey,
    amount: BN,
    proof: Buffer[],
    batchId: string,
    index: number,
}

export async function claim(
    testEnv: TestEnvironment,
    claim: Claim,
    overRideComputeUnits = 200_000,
    skipPreflight = false,
    simulate = false,
    skipSequenceChecks = true
) {
    const claimParams = {
        amount: claim.amount,
        batchId: claim.batchId,
        proof: claim.proof.map(buffer => Array.from(buffer)),
        index: new BN(claim.index),
    };

    const accounts = {
        claimant: claim.claimant.publicKey,
        distributionTree: claim.distributionTreePda,
        mint: claim.mint,
        tokenVault: claim.tokenVault,
        claimantTokenAccount: claim.claimantTokenAccount,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
    }

    if (simulate) {
        const ix = await testEnv.program.methods.claim(claimParams)
            .accountsPartial(accounts)
            .signers([claim.claimant])
            .instruction();
        const computeUnits = await getSimulationComputeUnits(testEnv.program.provider.connection, [ix], claim.claimant.publicKey, []);
        return computeUnits ?? undefined;
    }

    const initialVaultBalancePromise = testEnv.program.provider.connection.getTokenAccountBalance(claim.tokenVault).catch(() => ({ value: { amount: '0' } }));
    const initialClaimantBalancePromise = testEnv.program.provider.connection.getTokenAccountBalance(claim.claimantTokenAccount).catch(() => ({ value: { amount: '0' } }));
    const [initialClaimantBalance, initialVaultBalance] = await Promise.all([initialClaimantBalancePromise, initialVaultBalancePromise]);

    const computeUnitIx = web3.ComputeBudgetProgram.setComputeUnitLimit({ units: overRideComputeUnits });
    try {
        const txid = await testEnv.program.methods.claim(claimParams)
            .accountsPartial(accounts)
            .preInstructions([computeUnitIx], !!overRideComputeUnits)
            .signers([claim.claimant])
            .rpc({ commitment: "processed", skipPreflight });

        // Fetch and assert the DistributionTree account data
        let distributionTreeData = await testEnv.program.account.distributionTree.fetch(claim.distributionTreePda);
        assert.strictEqual(distributionTreeData.mint.toString(), claim.mint.toString());
        assert.strictEqual(distributionTreeData.tokenVault.toString(), claim.tokenVault.toString());

        assert.isTrue(
            isBitSet(distributionTreeData.recipientsDistributedBitmap, claimParams.index.toNumber()),
            `Bitmap not set for claimant at index ${claimParams.index.toString()}`
        );

        // Fetch and assert the claimant token account data
        let claimantTokenAccountData = await testEnv.program.provider.connection.getTokenAccountBalance(claim.claimantTokenAccount);
        const claimantBalanceChange = BigInt(claimantTokenAccountData.value.amount) - BigInt(initialClaimantBalance.value.amount);
        assert.strictEqual(claimantBalanceChange.toString(), claim.amount.toString());

        // Fetch and assert the token vault token account data
        let tokenVaultTokenAccountData = await testEnv.program.provider.connection.getTokenAccountBalance(claim.tokenVault);
        const vaultBalanceChange = BigInt(initialVaultBalance.value.amount) - BigInt(tokenVaultTokenAccountData.value.amount);

        if (!skipSequenceChecks) {
            assert.strictEqual(vaultBalanceChange.toString(), claim.amount.toString());
            assert.strictEqual(distributionTreeData.numberDistributed.toNumber(), claim.index + 1);
        }
    } catch (error) {
        throw error;
    }
}