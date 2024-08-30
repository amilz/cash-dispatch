import { assert } from "chai";
import { TestEnvironment } from "../../utils/environment/test-environment";
import { Distribute, distribute } from "./distribute";
import { web3 } from "@coral-xyz/anchor";
import { getAccountByIndex } from "../../utils/merkle-tree";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";


export async function distributeTests(testEnv: TestEnvironment) {

    it.skip('Try to Initialize with the wrong Input', async () => {

    });

    it('Distributes tokens to the recipient', async () => {
        const INDEX = 0; // TODO Fetch this from the PDA
        const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, INDEX);
        if (!paymentInfo) {
            throw new Error('No recipient found');
        }
        const recipient = new web3.PublicKey(paymentInfo.account);

        const distributeParams: Distribute = {
            authority: testEnv.authority,
            recipient,
            distributionTreePda: testEnv.distributionTreePda,
            mint: testEnv.pyUsdMint,
            tokenVault: testEnv.tokenVault,
            recipientTokenAccount: getAssociatedTokenAddressSync(
                testEnv.pyUsdMint,
                recipient,
                false,
                TOKEN_2022_PROGRAM_ID
            ),
            amount: paymentInfo.amount,
            proof: testEnv.balanceTree.getProof(INDEX, recipient, paymentInfo.amount),
            batchId: testEnv.distributionUniqueId,
            numberDistributedBefore: INDEX
        };
        await distribute(testEnv, distributeParams);

    });

    it.skip('Cannot Re-Initialize', async () => {


    });
    it.skip('Cannot TBD', async () => {

    });
}