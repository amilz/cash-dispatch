import { TestEnvironment } from "../../utils/environment/test-environment";
import { Expand, expand } from "./expand";
import { initialize, Initialize } from "../1-initialize/initialize";
import { getAccountByIndex } from "../../utils/merkle-tree";
import { BITMAP_ARRAY_STEP } from "../../utils/constants";
import { assert } from "chai";
import { assertInstructionWillFail } from "../helpers";
import { web3 } from "@coral-xyz/anchor";
import { distribute, Distribute } from "../2-distribute/distribute";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";


/**
 * EXPAND INSTRUCTION TESTS
 * 
 * @param testEnv 
 * 
 * This test suite tests creates a new Distribution Tree that is > 64k
 * The test suite then:
 * 1. Fails to distribute to the tree before expanding
 * 2. Expands the tree
 * 3. Fails to expand the tree after it has been fully expanded
 * 4. Distributes to the tree
 *   
 */
export async function expandTests(testEnv: TestEnvironment) {
    let index: number;
    let expandParams: Expand;
    let totalNumberRecipients: number;
    let distributeParams: Distribute;

    before('Set Cancel Params', async () => {
        // Create a New Tree for this test
        const numPayments = (64 * BITMAP_ARRAY_STEP) + 10;
        assert.isAbove(numPayments, BITMAP_ARRAY_STEP, "Number of payments should be greater than BITMAP_ARRAY_STEP for this test");

        await testEnv.newTree({ numPayments, startOffset: -100 });

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
        expandParams = {
            authority: testEnv.authority,
            distributionTreePda: testEnv.distributionTreePda,
            batchId: testEnv.distributionUniqueId,
        };


    });

    it('Cannot distribute before expanding', async () => {
        await assertInstructionWillFail({
            testEnv,
            params: distributeParams,
            executeInstruction: distribute,
            expectedAnchorError: "DistributionNotActive"
        });
    });

    it('Expands successfully', async () => {
        await expand(testEnv, expandParams);
    });

    it('Cannot expand after approved', async () => {
        await assertInstructionWillFail({
            testEnv,
            params: expandParams,
            executeInstruction: expand,
            expectedAnchorError: "InvalidDistributionStatus"
        });
    });

    it('Can distribute after expanding successfully', async () => {
        await distribute(testEnv, distributeParams);
    });
}

// TODO add expandManyTests
// e.g., expand to 1M recipients