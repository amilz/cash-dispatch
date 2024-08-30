import { TestEnvironment } from "../../utils/environment/test-environment";
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BN } from '@coral-xyz/anchor';
import { assert } from 'chai';

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
}

export async function distribute(
    testEnv: TestEnvironment,
    distribute: Distribute,
) {
    const distributeParams = {
        amount: distribute.amount,
        batchId: distribute.batchId,
        proof: distribute.proof.map(buffer => Array.from(buffer)),
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
    }

    const initialVaultBalancePromise = testEnv.program.provider.connection.getTokenAccountBalance(distribute.tokenVault).catch(() => ({ value: { amount: '0' } }));
    const initialRecipientBalancePromise = testEnv.program.provider.connection.getTokenAccountBalance(distribute.recipientTokenAccount).catch(() => ({ value: { amount: '0' } }));
    const [initialVaultBalance, initialRecipientBalance] = await Promise.all([initialVaultBalancePromise, initialRecipientBalancePromise]);

    try {
        const txid = await testEnv.program.methods.distribute(distributeParams)
            .accountsPartial(accounts)
            .signers([distribute.authority])
            .rpc({ commitment: "processed", skipPreflight: false });
        // Fetch and assert the DistributionTree account data
        let distributionTreeData = await testEnv.program.account.distributionTree.fetch(distribute.distributionTreePda);
        assert.strictEqual(distributionTreeData.numberDistributed.toNumber(), distribute.numberDistributedBefore + 1);
        assert.strictEqual(distributionTreeData.authority.toString(), distribute.authority.publicKey.toString());
        assert.strictEqual(distributionTreeData.mint.toString(), distribute.mint.toString());
        assert.strictEqual(distributionTreeData.tokenVault.toString(), distribute.tokenVault.toString());

        // Fetch and assert the recipient token account data
        let recipientTokenAccountData = await testEnv.program.provider.connection.getTokenAccountBalance(distribute.recipientTokenAccount);
        const recipientBalanceChange = BigInt(recipientTokenAccountData.value.amount) - BigInt(initialRecipientBalance.value.amount);
        assert.strictEqual(recipientBalanceChange.toString(), distribute.amount.toString());

        // Fetch and assert the token vault token account data
        let tokenVaultTokenAccountData = await testEnv.program.provider.connection.getTokenAccountBalance(distribute.tokenVault);
        const vaultBalanceChange = BigInt(initialVaultBalance.value.amount) - BigInt(tokenVaultTokenAccountData.value.amount);
        assert.strictEqual(vaultBalanceChange.toString(), distribute.amount.toString());
    } catch (error) {
        throw error;
    }

}


