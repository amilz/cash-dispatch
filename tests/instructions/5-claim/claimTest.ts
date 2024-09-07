import { TestEnvironment } from "../../utils/environment/test-environment";
import { Claim, claim, claimAllPayments, createClaimParams } from "./claim";
import { BN, web3 } from "@coral-xyz/anchor";
import { assertInstructionWillFail } from "../helpers";
import { OFFSET_24_HOURS } from "../../utils/constants";
import { createNewDistributionTree } from "../1-initialize/initialize";
import { airdropToMultiple } from "../../utils/solana-helpers";
import { getUserTokenAccountAddress } from "../../utils/pdas";

/**
 * CLAIM INSTRUCTION TESTS
 * 
 * @param testEnv 
 * 
 * This test suite tests initializes a new Distribution Tree with claims enabled, then:
 *     1. Verfies that the tree cannot be claimed under a variety of incorrect parameters/conditions
 *     2. Verifies that the tree can be claimed under proper parameters/conditions
 *     3. Verifies the tree cannot be claimed after it has already been claimed
 *     4. Verifies that all recipients can claim their tokens
 * 
 * The suite initializes a new Distribution Tree with claims disabled, then:
 *     1. Verfies that the tree cannot be claimed
 * 
 * The suite initializes a new Distribution Tree with claims enabled in the future, then:
 *     1. Verfies that the tree cannot be claimed until the claims have started
 * 
 */
export async function claimTests(testEnv: TestEnvironment) {
    describe('Distribution tree initialized with claims enabled', async () => {
        const numPayments = 20;
        const wrongRecipient = web3.Keypair.generate();

        let correctParams: Claim;

        before('Initialize a new Distribution Tree with claims enabled', async () => {
            await createNewDistributionTree({
                testEnv,
                startOffset: -100,
                allowClaims: true,
                numPayments
            });
        });

        before('Set Claim Params', async () => {
            ({ correctParams } = await createClaimParams({ testEnv, index: 0, incluceAidrop: true }));
        });

        before('Airdrop to all claimants and a wrong recipient', async () => {
            await airdropToMultiple(
                [
                    wrongRecipient.publicKey,
                    ...testEnv.merkleDistributorInfo.payments.map(payment => payment.keypair.publicKey)
                ],
                testEnv.provider.connection,
                web3.LAMPORTS_PER_SOL
            );
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
        it('Cannot distribute to the wrong proof', async () => {
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
            const wrongDestination = getUserTokenAccountAddress({
                recipient: wrongRecipient.publicKey,
                mint: testEnv.pyUsdMint
            });
            const unClaimedIndex = 1;
            const incorrectParams: Claim = {
                ...correctParams,
                claimant: wrongRecipient,
                claimantTokenAccount: wrongDestination,
                index: unClaimedIndex
            };
            await assertInstructionWillFail({
                testEnv,
                params: incorrectParams,
                executeInstruction: claim,
                expectedAnchorError: "InvalidProof"
            });
        });
        it('Allows all recipients to claim', async () => {
            await claimAllPayments({
                testEnv,
                includeAirdrop: false,
                skipInices: [0] // Skip the first claimant because they already claimed
            });
        });
        it('Cannot claim when distribution is not active', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: correctParams,
                executeInstruction: claim,
                expectedAnchorError: "DistributionNotActive"
            });
        });
    });
    describe('Distribution tree initialized with claims disabled', async () => {
        before('Initializes a new Distribution Tree with claims disabled', async () => {
            await createNewDistributionTree({
                testEnv,
                startOffset: -100,
                allowClaims: false
            });
        });
        it('Cannot claim when claims are not allowed', async () => {
            let { correctParams } = await createClaimParams({ testEnv, index: 0 })
            await assertInstructionWillFail({
                testEnv,
                params: correctParams,
                executeInstruction: claim,
                expectedAnchorError: "ClaimsNotAllowed"
            });
        });
    });
    describe('Distribution tree initialized with claims enabled in the future', async () => {
        before('Initializes a new Distribution Tree with claims enabled in the future', async () => {
            await createNewDistributionTree({
                testEnv,
                startOffset: OFFSET_24_HOURS,
                allowClaims: true
            });
        });
        it('Cannot claim when claims have not started', async () => {
            let { correctParams } = await createClaimParams({ testEnv, index: 0 })
            await assertInstructionWillFail({
                testEnv,
                params: correctParams,
                executeInstruction: claim,
                expectedAnchorError: "DistributionNotStarted"
            });
        });

    });
}