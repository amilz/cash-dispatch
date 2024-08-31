
import { TestEnvironment } from "../../utils/environment/test-environment";
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { assert } from 'chai';

export interface Cancel {
    authority: Keypair,
    distributionTreePda: PublicKey,
    mint: PublicKey,
    tokenVault: PublicKey,
    authorityTokenAccount: PublicKey,
    batchId: string,
}

export async function cancel(
    testEnv: TestEnvironment,
    cancel: Cancel,
) {
    const cancelParams = {
        batchId: cancel.batchId,
    };

    const accounts = {
        authority: cancel.authority.publicKey,
        distributionTree: cancel.distributionTreePda,
        mint: cancel.mint,
        tokenVault: cancel.tokenVault,
        authorityTokenAccount: cancel.authorityTokenAccount,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
    }

    const initialVaultBalancePromise = testEnv.program.provider.connection.getTokenAccountBalance(cancel.tokenVault).catch(() => ({ value: { amount: '0' } }));
    const initialAuthorityBalancePromise = testEnv.program.provider.connection.getTokenAccountBalance(cancel.authorityTokenAccount).catch(() => ({ value: { amount: '0' } }));
    const [initialVaultBalance, initialAuthorityBalance] = await Promise.all([initialVaultBalancePromise, initialAuthorityBalancePromise]);


    try {
        await testEnv.program.methods.cancel(cancelParams)
            .accountsPartial(accounts)
            .signers([cancel.authority])
            .rpc({ commitment: "processed", skipPreflight: false });

        // Fetch and assert the DistributionTree account data
        let distributionTreeData = await testEnv.program.account.distributionTree.fetch(cancel.distributionTreePda);
        assert.deepStrictEqual(distributionTreeData.status, { cancelled: {} });

        // Fetch and assert the token vault token account data
        let tokenVaultTokenAccountData = await testEnv.program.provider.connection.getTokenAccountBalance(cancel.tokenVault);
        assert.strictEqual(tokenVaultTokenAccountData.value.amount, '0');

        // Fetch and assert the authority's token account data
        let authorityTokenAccountData = await testEnv.program.provider.connection.getTokenAccountBalance(cancel.authorityTokenAccount);
        const authorityBalanceChange = BigInt(authorityTokenAccountData.value.amount) - BigInt(initialAuthorityBalance.value.amount);
        assert.strictEqual(authorityBalanceChange.toString(), initialVaultBalance.value.amount);

    } catch (error) {
        throw error;
    }
}