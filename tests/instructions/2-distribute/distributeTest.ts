import { TestEnvironment } from "../../utils/environment/test-environment";
import { createDistributeParams, Distribute, distribute, distributeAllPayments } from "./distribute";
import { BN, web3 } from "@coral-xyz/anchor";
import { assertInstructionWillFail } from "../helpers";
import { createNewDistributionTree } from "../1-initialize/initialize";
import { getUserTokenAccountAddress } from "../../utils/pdas";

/**
 * DISTRIBUTE INSTRUCTION TESTS
 * 
 * @param testEnv 
 * 
 * This test suite tests leverages the Distribution Tree Initialized in the previous test suite.
 * The test suite then:
 * 1. Verifies that the distribution cannot occur under a variety of incorrect parameters/conditions
 * 2. Verifies that the distribution can occur under proper parameters/conditions
 * 3. Verifies the Distribution Tree can be emptied by distributing all remaining payments
 * 4. Verifies the Distribution Tree cannot distribute anything after it the distribution is complete
 */
export async function distributeTests(testEnv: TestEnvironment) {

    describe('Distributing payments under various conditions', async () => {
        let correctParams: Distribute;

        before('Initializes a new distribution tree', async () => {
            await createNewDistributionTree({
                testEnv,
                numPayments: 5,
                startOffset: -100
            });
        });

        before('Set Distribute Params', async () => {
            correctParams = await createDistributeParams({ testEnv, index: 0 });
        });
        it('Cannot distribute with the wrong amount', async () => {
            const incorrectParams: Distribute = {
                ...correctParams,
                amount: new BN(999),
            };
            await assertInstructionWillFail({
                testEnv,
                params: incorrectParams,
                executeInstruction: distribute,
                expectedAnchorError: "InvalidProof"
            });
        });
        it('Cannot distribute to the wrong recipient', async () => {
            const wrongRecipient = new web3.Keypair().publicKey;
            const wrongDestination = getUserTokenAccountAddress({
                recipient: wrongRecipient,
                mint: testEnv.pyUsdMint
            })
            const incorrectParams: Distribute = {
                ...correctParams,
                recipient: wrongRecipient,
                recipientTokenAccount: wrongDestination,
            };
            await assertInstructionWillFail({
                testEnv,
                params: incorrectParams,
                executeInstruction: distribute,
                expectedAnchorError: "InvalidProof"
            });
        });
        it('Cannot distribute with wrong index', async () => {
            const wrongIndex = 1;
            const distributeParams: Distribute = {
                ...correctParams,
                numberDistributedBefore: wrongIndex
            };
            await assertInstructionWillFail({
                testEnv,
                params: distributeParams,
                executeInstruction: distribute,
                expectedAnchorError: "InvalidProof",
            });
        });
        it('Cannot Distribute to the wrong proof', async () => {
            const incorrectProof = correctParams.proof.map(buffer => Buffer.from(Array.from(buffer).reverse()));
            const incorrectParams: Distribute = {
                ...correctParams,
                proof: incorrectProof
            };
            await assertInstructionWillFail({
                testEnv,
                params: incorrectParams,
                executeInstruction: distribute,
                expectedAnchorError: "InvalidProof"
            });
        });
        it('Cannot distribute by unauthorized account', async () => {
            const incorrectParams: Distribute = {
                ...correctParams,
                authority: testEnv.wrongAuthority,
            };
            await assertInstructionWillFail({
                testEnv,
                params: incorrectParams,
                executeInstruction: distribute,
                expectedAnchorError: "SignerNotAuthorized"
            });
        });
        it('Distributes tokens to the recipient', async () => {
            await distribute(testEnv, correctParams);
        });
        it('Cannot distribute the same payment twice', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: correctParams,
                executeInstruction: distribute,
                expectedAnchorError: "AlreadyClaimed"
            });
        });
    });
    describe('Distributes all payments', async () => {
        before('Initializes a new distribution tree', async () => {
            await createNewDistributionTree({ testEnv });
        });

        it('Distributes all payments', async () => {
            await distributeAllPayments({
                testEnv,
                totalNumberRecipients: testEnv.merkleDistributorInfo.payments.length,
            });
        });
        it('Cannot distribute after the distribution is complete', async () => {
            const params = await createDistributeParams({ testEnv, index: 0 });
            await assertInstructionWillFail({
                testEnv,
                params,
                executeInstruction: distribute,
                expectedAnchorError: "DistributionNotActive"
            });
        });
    });
}