import { TestEnvironment } from "../../utils/environment/test-environment";
import { createNewDistributionTree } from "../1-initialize/initialize";
import { distributeAllPayments } from "../2-distribute/distribute";
import { assertInstructionWillFail } from "../helpers";
import { close, reclaim } from "./reclaim";


/**
 * RECLAIM INSTRUCTION TESTS
 * 
 * @param testEnv 
 * 
 * This test suite initializes a new Distribution Tree 
 *  1. Verifies that the tree cannot be reclaimed or closed before the Distribution Tree is closed
 *  2. Verifies the tree cannot be reclaimed with the wrong authority
 *  3. Verifies that the tree can be reclaimed and closed after the Distribution Tree is closed
 * 
 * 
 * CLOSE INSTRUCTION TESTS
 * 
 * @param testEnv 
 * 
 *  This test suite initializes a new Distribution Tree 
 *  1. Verifies the tree cannot be reclaimed with the wrong authority
 *  2. Verifies the tree cannot be closed without acknowledging irreversible
 *  3. Verifies the tree can be closed after the Distribution Tree is closed
 * 
 */
export async function reclaimTests(testEnv: TestEnvironment) {
    let totalNumberRecipients = 10;

    describe('Reclaiming a tree and then closing it', () => {

        before('Initializes a new distribution tree', async () => {
            await createNewDistributionTree({ testEnv, numPayments: totalNumberRecipients });
        });

        it('Cannot reclaim before the distribution tree is closed', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: {},
                executeInstruction: reclaim,
                expectedAnchorError: "DistributionNotComplete"
            });
        });

        it('Cannot close before the distribution tree is closed', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: { acknowledgeIrreversible: true },
                executeInstruction: close,
                expectedAnchorError: "DistributionNotComplete"
            });
        });

        it('Can distribute tokens to all accounts', async () => {
            await distributeAllPayments({ testEnv, totalNumberRecipients });
        });

        it('Cannot reclaim with an incorrect authority', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: { overRideAuthority: testEnv.wrongAuthority },
                executeInstruction: reclaim,
                expectedAnchorError: "SignerNotAuthorized"
            });
        });

        it('Can reclaim rent after the distribution tree is closed', async () => {
            await reclaim(testEnv, {});
        });

        it('Can close the distribution tree after reclaiming', async () => {
            await close(testEnv, { acknowledgeIrreversible: true });
        });
    });

    describe('Closing a tree without reclaiming', () => {
        before('Initializes and pays out a new Distribution Tree', async () => {
            await createNewDistributionTree({ testEnv, numPayments: totalNumberRecipients });
            await distributeAllPayments({ testEnv, totalNumberRecipients });
        });
        it('Cannot close with an incorrect authority', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: { acknowledgeIrreversible: true, overRideAuthority: testEnv.wrongAuthority },
                executeInstruction: close,
                expectedAnchorError: "SignerNotAuthorized"
            });
        });
        it('Cannot close without acknowledging irreversible', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: { acknowledgeIrreversible: false },
                executeInstruction: close,
                expectedAnchorError: "MustAcknowledgeIrreversible"
            });
        });
        it('Can close the distribution tree without reclaiming', async () => {
            await close(testEnv, { acknowledgeIrreversible: true });
        });

    });


}
