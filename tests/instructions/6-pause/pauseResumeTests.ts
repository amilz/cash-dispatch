// File: Code/Fun/distributor/tests/instructions/6-pause/pauseResumeTest.ts

import { TestEnvironment } from "../../utils/environment/test-environment";
import { PauseResume, pause, resume } from "./pauseResume";
import { createNewDistributionTree, initialize, Initialize } from "../1-initialize/initialize";
import { distribute, Distribute } from "../2-distribute/distribute";
import { getAccountByIndex } from "../../utils/merkle-tree";
import { web3 } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { assertInstructionWillFail } from "../helpers";

/**
 * PAUSE AND RESUME INSTRUCTION TESTS
 * 
 * @param testEnv 
 * 
 * This test suite creates a new Distribution Tree and then:
 * 1. Pauses the Distribution Tree
 * 2. Verifies the Distribution Tree cannot distribute while paused
 * 3. Resumes the Distribution Tree
 * 4. Verifies the Distribution Tree can distribute after resuming
 * 5. Attempts to pause and resume with a non-authority account
 */
export async function pauseResumeTests(testEnv: TestEnvironment) {
    let index: number;
    let pauseResumeParams: PauseResume;
    let distributeParams: Distribute;
    let totalNumberRecipients: number;

    describe('Pause/Resume Distribution Tree', async () => {

        before('Initializes a new Distribution Tree with Gatekeeper Network', async () => {
            await createNewDistributionTree({
                testEnv,
                allowClaims: true,
                numPayments: 5, 
                startOffset: -100
            });
        });
        before('Set Pause/Resume Params', async () => {
            const treeInfo = await testEnv.program.account.distributionTree.fetch(testEnv.distributionTreePda);
            index = treeInfo.numberDistributed.toNumber();
            totalNumberRecipients = treeInfo.totalNumberRecipients.toNumber();
            const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, index);
            if (!paymentInfo) {
                throw new Error('No recipient found');
            }
            const recipient = paymentInfo.keypair.publicKey;

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

            // Set correct params for pause/resume
            pauseResumeParams = {
                authority: testEnv.authority,
                distributionTreePda: testEnv.distributionTreePda,
                batchId: testEnv.distributionUniqueId
            };
        });
        it('Cannot Pause with non-authority account', async () => {
            const wrongAuthority = web3.Keypair.generate();
            const wrongParams = {
                ...pauseResumeParams,
                authority: wrongAuthority
            };
            await assertInstructionWillFail({
                testEnv,
                params: wrongParams,
                executeInstruction: pause,
                expectedAnchorError: "SignerNotAuthorized"
            });
        });

        it('Pauses successfully', async () => {
            await pause(testEnv, pauseResumeParams);
        });

        it('Cannot Resume with non-authority account', async () => {
            const wrongAuthority = web3.Keypair.generate();
            const wrongParams = {
                ...pauseResumeParams,
                authority: wrongAuthority
            };
            await assertInstructionWillFail({
                testEnv,
                params: wrongParams,
                executeInstruction: resume,
                expectedAnchorError: "SignerNotAuthorized"
            });
        });

        it('Cannot Distribute while Paused', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: distributeParams,
                executeInstruction: distribute,
                expectedAnchorError: "DistributionNotActive"
            });
        });

        it('Resumes successfully', async () => {
            await resume(testEnv, pauseResumeParams);
        });

        it('Can Distribute after Resuming', async () => {
            await distribute(testEnv, distributeParams);
        });


    });

}