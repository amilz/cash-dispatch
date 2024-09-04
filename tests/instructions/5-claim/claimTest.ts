import { TestEnvironment } from "../../utils/environment/test-environment";
import { Claim, claim } from "./claim";
import { BN, web3 } from "@coral-xyz/anchor";
import { getAccountByIndex } from "../../utils/merkle-tree";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { assertInstructionWillFail } from "../helpers";
import { MAX_COMPUTE_UNITS } from "../../utils/constants";
import { initialize, Initialize } from "../1-initialize/initialize";
import { airdropToMultiple } from "../../utils/solana-helpers";

/**
 * CLAIM INSTRUCTION TESTS
 * 
 * @param testEnv 
 * 
 * This test suite tests initializes a new Distribution Tree
 * The test suite then:
 * 
 */
export async function claimTests(testEnv: TestEnvironment) {
    let index: number;
    let totalNumberRecipients: number;
    let computeUnits: number | undefined;
    let correctParams: Claim;

    before('Set Distribute Params', async () => {
        // Create a New Tree for this test
        const numPayments = 20;

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
            allowClaims: true,
        };
        await initialize(testEnv, initParms);

        const treeInfo = await testEnv.program.account.distributionTree.fetch(testEnv.distributionTreePda);
        index = treeInfo.numberDistributed.toNumber();
        totalNumberRecipients = treeInfo.totalNumberRecipients.toNumber();
        const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, index);
        if (!paymentInfo) {
            throw new Error('No recipient found');
        }

        // Claimaints will need SOL in order to pay for transaction fees
        await airdropToMultiple(
            [...testEnv.merkleDistributorInfo.payments.map(payment => payment.keypair.publicKey)],
            testEnv.provider.connection,
            web3.LAMPORTS_PER_SOL
        );

        let claimantKeypair = paymentInfo.keypair;
        correctParams = {
            claimant: claimantKeypair,
            distributionTreePda: testEnv.distributionTreePda,
            mint: testEnv.pyUsdMint,
            tokenVault: testEnv.tokenVault,
            claimantTokenAccount: getAssociatedTokenAddressSync(
                testEnv.pyUsdMint,
                claimantKeypair.publicKey,
                false,
                TOKEN_2022_PROGRAM_ID
            ),
            amount: new BN(paymentInfo.amount),
            proof: testEnv.balanceTree.getProof(index, claimantKeypair.publicKey, paymentInfo.amount),
            batchId: testEnv.distributionUniqueId,
            index // TBD  make sure this isn't index + 1
        }


        computeUnits = MAX_COMPUTE_UNITS;
    });
    it('Cannot claim with the wrong amount', async () => {
        const incorrectParams: Claim = {
            ...correctParams,
            amount: new BN(999),
        };
        await assertInstructionWillFail({
            testEnv,
            params: incorrectParams,
            executeInstruction: claim,
            expectedAnchorError: "InvalidProof"
        });
    });

    it('Can claim', async () => {
        await claim(testEnv, correctParams);
    });
    it('Cannot claim multiple times', async () => {
        await assertInstructionWillFail({
            testEnv,
            params: correctParams,
            executeInstruction: claim,
            expectedAnchorError: "AlreadyClaimed"
        });
    });

}