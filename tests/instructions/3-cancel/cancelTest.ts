import { TestEnvironment } from "../../utils/environment/test-environment";
import { Cancel, cancel } from "./cancel";
import { initialize, Initialize } from "../1-initialize/initialize";
import { distribute, Distribute } from "../2-distribute/distribute";
import { getAccountByIndex } from "../../utils/merkle-tree";
import { web3 } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { assertInstructionWillFail } from "../helpers";


/**
 * CANCEL INSTRUCTION TESTS
 * 
 * @param testEnv 
 * 
 * This test suite tests creates a new Distribution Tree (because the previous one should be depleted).
 * The test suite then:
 * 1. Cancels the Distribution Tree (verifying that the status is Cancelled, the token vault is empty, and the authority has received the remaining tokens)
 * 2. Verifies the Distribution Tree cannot distribute after canceling
 * 
 */
export async function cancelTests(testEnv: TestEnvironment) {
    let index: number;
    let cancelParams: Cancel;
    let distributeParams: Distribute;
    let totalNumberRecipients: number;

    before('Set Cancel Params', async () => {
        // Create a New Tree for this test
        await testEnv.newTree({ numPayments: 5, startOffset: -100 });

        // Initialize the new Distribution Tree PDA
        const initParms: Initialize = {
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
        };
        await initialize(testEnv, initParms);

        const treeInfo = await testEnv.program.account.distributionTree.fetch(testEnv.distributionTreePda);
        index = treeInfo.numberDistributed.toNumber();
        totalNumberRecipients = treeInfo.totalNumberRecipients.toNumber();
        const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, index);
        if (!paymentInfo) {
            throw new Error('No recipient found');
        }
        const recipient = new web3.PublicKey(paymentInfo.account);

        // Set correct params for distribute
        distributeParams = {
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
            proof: testEnv.balanceTree.getProof(index, recipient, paymentInfo.amount),
            batchId: testEnv.distributionUniqueId,
            numberDistributedBefore: index
        };

        // Set correct params for cancel
        cancelParams = {
            authority: testEnv.authority,
            distributionTreePda: testEnv.distributionTreePda,
            mint: testEnv.pyUsdMint,
            tokenVault: testEnv.tokenVault,
            authorityTokenAccount: testEnv.tokenSource,
            batchId: testEnv.distributionUniqueId
        };

    });
    it('Cancels successfully', async () => {
        await cancel(testEnv, cancelParams);
    });
    it('Cannot Distribute after Cancel', async () => {
        await assertInstructionWillFail({
            testEnv,
            params: distributeParams,
            executeInstruction: distribute,
            expectedAnchorError: "DistributionNotActive"
        });
    });
}