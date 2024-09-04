import { TestEnvironment } from "../../utils/environment/test-environment";
import { Claim, claim } from "./claim";
import { BN, web3 } from "@coral-xyz/anchor";
import { getAccountByIndex } from "../../utils/merkle-tree";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { assertInstructionWillFail, verifyTreeComplete } from "../helpers";
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
 *     1. Verfies that the tree cannot be claimed under a variety of incorrect parameters/conditions
 *     2. Verifies that the tree can be claimed under proper parameters/conditions
 *     3. Verifies the tree cannot be claimed after it has been completed
 *     4. Verifies that all recipients can claim their tokens * 
 */
export async function claimTests(testEnv: TestEnvironment) {
    let index: number;
    let indices: { index: number, claimed: boolean }[];
    let totalNumberRecipients: number;
    let computeUnits: number | undefined;
    let correctParams: Claim;
    let wrongRecipient: web3.Keypair;

    before('Set Claim Params', async () => {
        // Create a New Tree for this test
        const numPayments = 20;
        wrongRecipient = web3.Keypair.generate();

        await testEnv.newTree({ numPayments, startOffset: -100 });
        totalNumberRecipients = testEnv.merkleDistributorInfo.payments.length;
        // Initialize the new Distribution Tree PDA
        const initParms: Initialize = {
            authority: testEnv.authority,
            distributionTreePda: testEnv.distributionTreePda,
            mint: testEnv.pyUsdMint,
            tokenSource: testEnv.tokenSource,
            tokenVault: testEnv.tokenVault,
            merkleRoot: testEnv.balanceTree.getRoot(),
            batchId: testEnv.distributionUniqueId,
            totalNumberRecipients,
            transferToVaultAmount: Object.values(testEnv.merkleDistributorInfo.payments).reduce((sum, payment) => sum + payment.amount.toNumber(), 0),
            mintDecimals: 6,
            startTs: testEnv.distributionStartTs,
            endTs: null,
            allowClaims: true,
        };
        await initialize(testEnv, initParms);

        index = 0;
        indices = Array.from({ length: numPayments }, (_, i) => ({ index: i, claimed: false }));
        const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, index);
        if (!paymentInfo) {
            throw new Error('No recipient found');
        }

        // Claimaints will need SOL in order to pay for transaction fees
        await airdropToMultiple(
            [...testEnv.merkleDistributorInfo.payments.map(payment => payment.keypair.publicKey), wrongRecipient.publicKey],
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
            index
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
    it('Cannot Distribute to the wrong proof', async () => {
        const incorrectProof = correctParams.proof.map(buffer => Buffer.from(Array.from(buffer).reverse()));
        const incorrectParams: Claim = {
            ...correctParams,
            proof: incorrectProof
        };
        await assertInstructionWillFail({
            testEnv,
            params: incorrectParams,
            executeInstruction: claim,
            expectedAnchorError: "InvalidProof"
        });

    });
    it('Can claim', async () => {
        await claim(testEnv, correctParams, undefined, undefined, undefined, false);
        indices[index].claimed = true;
    });
    it('Cannot claim multiple times', async () => {
        await assertInstructionWillFail({
            testEnv,
            params: correctParams,
            executeInstruction: claim,
            expectedAnchorError: "AlreadyClaimed"
        });
    });
    it('Cannot distribute to the wrong recipient', async () => {

        const wrongDestination = getAssociatedTokenAddressSync(
            testEnv.pyUsdMint,
            wrongRecipient.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );

        index = indices.find(index => !index.claimed)?.index ?? 0;

        const incorrectParams: Claim = {
            ...correctParams,
            claimant: wrongRecipient,
            claimantTokenAccount: wrongDestination,
            index
        };
        await assertInstructionWillFail({
            testEnv,
            params: incorrectParams,
            executeInstruction: claim,
            expectedAnchorError: "InvalidProof"
        });
    });
    it('Allows all recipients to claim', async () => {
        let claims = indices
            .filter(element => !element.claimed)
            .map(async (userClaim) => {
                const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, userClaim.index);
                if (!paymentInfo) {
                    throw new Error('No recipient found');
                }

                let claimantKeypair = paymentInfo.keypair;
                let userClaimParams: Claim = {
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
                    proof: testEnv.balanceTree.getProof(userClaim.index, claimantKeypair.publicKey, paymentInfo.amount),
                    batchId: testEnv.distributionUniqueId,
                    index: userClaim.index
                }
                await claim(testEnv, userClaimParams);
                userClaim.claimed = true;
            });
        await Promise.all(claims);
        await verifyTreeComplete(testEnv, totalNumberRecipients);
    });
    it('Cannot claim when distribution is not active', async () => {
        await assertInstructionWillFail({
            testEnv,
            params: correctParams,
            executeInstruction: claim,
            expectedAnchorError: "DistributionNotActive"
        });
    });

}


export async function claimsNotAllowedTests(testEnv: TestEnvironment) {
    let index: number;
    let indices: { index: number, claimed: boolean }[] = [];
    let totalNumberRecipients: number;
    let computeUnits: number | undefined;
    let correctParams: Claim;
    let wrongRecipient: web3.Keypair;

    before('Set Claim Params', async () => {
        // Create a New Tree for this test
        const numPayments = 20;
        wrongRecipient = web3.Keypair.generate();

        await testEnv.newTree({ numPayments, startOffset: -100 });
        totalNumberRecipients = testEnv.merkleDistributorInfo.payments.length;
        // Initialize the new Distribution Tree PDA
        const initParms: Initialize = {
            authority: testEnv.authority,
            distributionTreePda: testEnv.distributionTreePda,
            mint: testEnv.pyUsdMint,
            tokenSource: testEnv.tokenSource,
            tokenVault: testEnv.tokenVault,
            merkleRoot: testEnv.balanceTree.getRoot(),
            batchId: testEnv.distributionUniqueId,
            totalNumberRecipients,
            transferToVaultAmount: Object.values(testEnv.merkleDistributorInfo.payments).reduce((sum, payment) => sum + payment.amount.toNumber(), 0),
            mintDecimals: 6,
            startTs: testEnv.distributionStartTs,
            endTs: null,
            allowClaims: false,
        };
        await initialize(testEnv, initParms);

        index = 0;
        indices = Array.from({ length: numPayments }, (_, i) => ({ index: i, claimed: false }));
        const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, index);
        if (!paymentInfo) {
            throw new Error('No recipient found');
        }

        // Claimaints will need SOL in order to pay for transaction fees
        await airdropToMultiple(
            [...testEnv.merkleDistributorInfo.payments.map(payment => payment.keypair.publicKey), wrongRecipient.publicKey],
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
            index
        }

        computeUnits = MAX_COMPUTE_UNITS;
    });

    it('Cannot claim when claims are not allowed', async () => {
        await assertInstructionWillFail({
            testEnv,
            params: correctParams,
            executeInstruction: claim,
            expectedAnchorError: "ClaimsNotAllowed"
        });
    });
}

export async function claimsNotStartedTests(testEnv: TestEnvironment) {
    let index: number;
    let indices: { index: number, claimed: boolean }[] = [];
    let totalNumberRecipients: number;
    let computeUnits: number | undefined;
    let correctParams: Claim;
    let wrongRecipient: web3.Keypair;

    before('Set Claim Params', async () => {
        // Create a New Tree for this test
        const numPayments = 20;
        wrongRecipient = web3.Keypair.generate();

        const OFFSET_24_HOURS = 24 * 60 * 60;

        await testEnv.newTree({ numPayments, startOffset: OFFSET_24_HOURS });
        totalNumberRecipients = testEnv.merkleDistributorInfo.payments.length;
        // Initialize the new Distribution Tree PDA
        const initParms: Initialize = {
            authority: testEnv.authority,
            distributionTreePda: testEnv.distributionTreePda,
            mint: testEnv.pyUsdMint,
            tokenSource: testEnv.tokenSource,
            tokenVault: testEnv.tokenVault,
            merkleRoot: testEnv.balanceTree.getRoot(),
            batchId: testEnv.distributionUniqueId,
            totalNumberRecipients,
            transferToVaultAmount: Object.values(testEnv.merkleDistributorInfo.payments).reduce((sum, payment) => sum + payment.amount.toNumber(), 0),
            mintDecimals: 6,
            startTs: testEnv.distributionStartTs,
            endTs: null,
            allowClaims: true,
        };
        await initialize(testEnv, initParms);

        index = 0;
        indices = Array.from({ length: numPayments }, (_, i) => ({ index: i, claimed: false }));
        const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, index);
        if (!paymentInfo) {
            throw new Error('No recipient found');
        }

        // Claimaints will need SOL in order to pay for transaction fees
        await airdropToMultiple(
            [...testEnv.merkleDistributorInfo.payments.map(payment => payment.keypair.publicKey), wrongRecipient.publicKey],
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
            index
        }

        computeUnits = MAX_COMPUTE_UNITS;
    });

    it('Cannot claim when claims have not started', async () => {
        await assertInstructionWillFail({
            testEnv,
            params: correctParams,
            executeInstruction: claim,
            expectedAnchorError: "DistributionNotStarted"
        });
    });
}