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

    await testEnv.program.methods.distribute(distributeParams)
        .accountsPartial(accounts)
        .signers([distribute.authority])
        .rpc({ commitment: "processed", skipPreflight: true });

    // Fetch and assert the DistributionTree account data
    let distributionTreeData = await testEnv.program.account.distributionTree.fetch(distribute.distributionTreePda);
    assert.strictEqual(distributionTreeData.numberDistributed.toNumber(), distribute.numberDistributedBefore + 1);
}


