import { TestEnvironment } from "../../utils/environment/test-environment";
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BN, web3 } from '@coral-xyz/anchor';
import { assert } from 'chai';
import { getSimulationComputeUnits } from "../../utils/solana-helpers";
import { isBitSet } from "../../utils/merkle-tree";
import { getUserTokenAccountAddress } from "../../utils/pdas";
import { verifyTreeComplete } from "../helpers";

export interface Distribute {
    authority: Keypair,
    recipient: PublicKey,
    distributionTreePda: PublicKey,
    mint: PublicKey,
    tokenVault: PublicKey,
    recipientTokenAccount: PublicKey,
    amount: BN,
    proof: Buffer[],
    batchId: string,
    numberDistributedBefore: number,
    gatewayToken?: PublicKey,
}

export async function distribute(
    testEnv: TestEnvironment,
    distribute: Distribute,
    overRideComputeUnits = 200_000,
    skipPreflight = false,
    simulate = false,
    skipSequenceChecks = true
) {
    const distributeParams = {
        amount: distribute.amount,
        batchId: distribute.batchId,
        proof: distribute.proof.map(buffer => Array.from(buffer)),
        index: new BN(distribute.numberDistributedBefore),
    };

    const accounts = {
        authority: distribute.authority.publicKey,
        recipient: distribute.recipient,
        distributionTree: distribute.distributionTreePda,
        mint: distribute.mint,
        tokenVault: distribute.tokenVault,
        recipientTokenAccount: distribute.recipientTokenAccount,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        gatewayToken: distribute.gatewayToken ?? null,
    }

    if (simulate) {
        const ix = await testEnv.program.methods.distribute(distributeParams)
            .accountsPartial(accounts)
            .signers([distribute.authority])
            .instruction();
        const computeUnits = await getSimulationComputeUnits(testEnv.program.provider.connection, [ix], distribute.authority.publicKey, []);
        return computeUnits ?? undefined;
    }


    const initialVaultBalancePromise = testEnv.program.provider.connection.getTokenAccountBalance(distribute.tokenVault).catch(() => ({ value: { amount: '0' } }));

    const initialRecipientBalancePromise = testEnv.program.provider.connection.getTokenAccountBalance(distribute.recipientTokenAccount).catch(() => ({ value: { amount: '0' } }));
    const [initialRecipientBalance, initialVaultBalance] = await Promise.all([initialRecipientBalancePromise, initialVaultBalancePromise]);

    const computeUnitIx = web3.ComputeBudgetProgram.setComputeUnitLimit({ units: overRideComputeUnits });
    try {
        const txid = await testEnv.program.methods.distribute(distributeParams)
            .accountsPartial(accounts)
            .preInstructions([computeUnitIx], !!overRideComputeUnits)
            .signers([distribute.authority])
            .rpc({ commitment: "processed", skipPreflight });
        // Fetch and assert the DistributionTree account data
        let distributionTreeData = await testEnv.program.account.distributionTree.fetch(distribute.distributionTreePda);
        assert.strictEqual(distributionTreeData.authority.toString(), distribute.authority.publicKey.toString());
        assert.strictEqual(distributionTreeData.mint.toString(), distribute.mint.toString());
        assert.strictEqual(distributionTreeData.tokenVault.toString(), distribute.tokenVault.toString());

        assert.isTrue(
            isBitSet(distributionTreeData.recipientsDistributedBitmap, distributeParams.index.toNumber()),
            `Bitmap not set for recipient at index ${distributeParams.index.toString()}`
        );

        // Fetch and assert the recipient token account data
        let recipientTokenAccountData = await testEnv.program.provider.connection.getTokenAccountBalance(distribute.recipientTokenAccount);
        const recipientBalanceChange = BigInt(recipientTokenAccountData.value.amount) - BigInt(initialRecipientBalance.value.amount);
        assert.strictEqual(recipientBalanceChange.toString(), distribute.amount.toString());

        // When running in parallel, the tests are run in parallel and the vault balance and number of recipients distributed checks are not deterministic
        // Instead we run verification after all the distributions have been completed
        if (!skipSequenceChecks) {
            // Fetch and assert the token vault token account data
            let tokenVaultTokenAccountData = await testEnv.program.provider.connection.getTokenAccountBalance(distribute.tokenVault);
            const vaultBalanceChange = BigInt(initialVaultBalance.value.amount) - BigInt(tokenVaultTokenAccountData.value.amount);
            assert.strictEqual(vaultBalanceChange.toString(), distribute.amount.toString());

            // Verify the number of recipients distributed is incremented by 1
            assert.strictEqual(distributionTreeData.numberDistributed.toNumber(), distribute.numberDistributedBefore + 1);
        }

    } catch (error) {
        throw error;
    }
}


interface DistributeAllPaymentsParams {
    testEnv: TestEnvironment,
    totalNumberRecipients: number,
}

export async function distributeAllPayments({
    testEnv,
    totalNumberRecipients
}: DistributeAllPaymentsParams) {
    const allPayments = testEnv.merkleDistributorInfo.payments;

    const distributionPromises = allPayments.map((paymentInfo, index) => {
        const recipient = paymentInfo.keypair.publicKey;
        const distribution: Distribute = {
            authority: testEnv.authority,
            recipient,
            distributionTreePda: testEnv.distributionTreePda,
            mint: testEnv.pyUsdMint,
            tokenVault: testEnv.tokenVault,
            recipientTokenAccount: getUserTokenAccountAddress({
                recipient,
                mint: testEnv.pyUsdMint
            }),
            amount: paymentInfo.amount,
            proof: testEnv.balanceTree.getProof(index, recipient, paymentInfo.amount),
            batchId: testEnv.distributionUniqueId,
            numberDistributedBefore: index,
        }

        return distribute(testEnv, distribution);
    });
    await Promise.all(distributionPromises);
    await verifyTreeComplete(testEnv, totalNumberRecipients);
}
