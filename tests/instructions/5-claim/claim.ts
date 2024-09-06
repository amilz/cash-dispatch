import { TestEnvironment } from "../../utils/environment/test-environment";
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BN, web3 } from '@coral-xyz/anchor';
import { assert } from 'chai';
import { airdropToMultiple, getSimulationComputeUnits } from "../../utils/solana-helpers";
import { getAccountByIndex, isBitSet } from "../../utils/merkle-tree";
import { getUserTokenAccountAddress } from "../../utils/pdas";
import { verifyTreeComplete } from "../helpers";

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
    gatewayToken?: PublicKey,
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
        gatewayToken: claim.gatewayToken ?? null,
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

interface CreateClaimParams {
    testEnv: TestEnvironment,
    index: number,
    incluceAidrop?: boolean
}
interface CreateClaimResponse {
    index: number,
    correctParams: Claim,
    claimantKeypair: web3.Keypair
}

export async function createClaimParams({
    testEnv,
    index,
    incluceAidrop = true
}: CreateClaimParams): Promise<CreateClaimResponse> {
    index = 0;
    const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, index);
    if (!paymentInfo) {
        throw new Error('No recipient found');
    }

    if (incluceAidrop) {
        await airdropToMultiple(
            [...testEnv.merkleDistributorInfo.payments.map(payment => payment.keypair.publicKey)],
            testEnv.provider.connection,
            web3.LAMPORTS_PER_SOL
        );
    }
    let claimantKeypair = paymentInfo.keypair;
    let claimParams: Claim = {
        claimant: claimantKeypair,
        distributionTreePda: testEnv.distributionTreePda,
        mint: testEnv.pyUsdMint,
        tokenVault: testEnv.tokenVault,
        claimantTokenAccount: getUserTokenAccountAddress({
            recipient: claimantKeypair.publicKey,
            mint: testEnv.pyUsdMint
        }),
        amount: new BN(paymentInfo.amount),
        proof: testEnv.balanceTree.getProof(index, claimantKeypair.publicKey, paymentInfo.amount),
        batchId: testEnv.distributionUniqueId,
        index
    }
    return {
        index,
        correctParams: claimParams,
        claimantKeypair
    }
};


interface ClaimAllPaymentsParams {
    testEnv: TestEnvironment,
    includeAirdrop?: boolean
    skipInices?: number[]
}

export async function claimAllPayments({
    testEnv,
    includeAirdrop = false,
    skipInices = []
}: ClaimAllPaymentsParams) {
    if (includeAirdrop) {
        await airdropToMultiple(
            [...testEnv.merkleDistributorInfo.payments.map(payment => payment.keypair.publicKey)],
            testEnv.provider.connection,
            web3.LAMPORTS_PER_SOL
        );
    }
    let allPayments = testEnv.merkleDistributorInfo.payments;

    const claimPromises = allPayments.map(async (paymentInfo, index) => {
        if (skipInices.includes(index)) {
            return null;
        }
        const claimantKey = paymentInfo.keypair;
        const claimDetails: Claim = {
            claimant: claimantKey,
            distributionTreePda: testEnv.distributionTreePda,
            mint: testEnv.pyUsdMint,
            tokenVault: testEnv.tokenVault,
            claimantTokenAccount: getUserTokenAccountAddress({
                recipient: claimantKey.publicKey,
                mint: testEnv.pyUsdMint
            }),
            amount: paymentInfo.amount,
            proof: testEnv.balanceTree.getProof(index, claimantKey.publicKey, paymentInfo.amount),
            batchId: testEnv.distributionUniqueId,
            index,
        }
        return claim(testEnv, claimDetails);
    });
    await Promise.all(claimPromises);
    await verifyTreeComplete(testEnv, allPayments.length);
}
