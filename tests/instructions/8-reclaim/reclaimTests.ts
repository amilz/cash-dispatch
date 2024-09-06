import { TestEnvironment } from "../../utils/environment/test-environment";
import { assertInstructionWillFail, createNewDistributionTree, distributeAllPayments } from "../helpers";
import { close, reclaim } from "./reclaim";


/**
 * RECLAIM INSTRUCTION TESTS
 * 
 * @param testEnv 
 * 
 * This test suite initializes a new Distribution Tree 
 * 
 */
export async function reclaimTests(testEnv: TestEnvironment) {
    let totalNumberRecipients = 10;

    describe('Reclaiming a tree and then closing it', () => {

        before('Initializes a new Distribution Tree', async () => {
            await createNewDistributionTree({ testEnv, numPayments: totalNumberRecipients });
        });

        it('Cannot reclaim before the Distribution Tree is closed', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: {},
                executeInstruction: reclaim,
                expectedAnchorError: "DistributionNotComplete"
            });
        });

        it('Cannot close before the Distribution Tree is closed', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: { acknowledgeIrreversible: true },
                executeInstruction: close,
                expectedAnchorError: "DistributionNotComplete"
            });
        });

        it('Distributes tokens to all accounts', async () => {
            await distributeAllPayments({ testEnv, totalNumberRecipients });
        });

        it('Reclaims tokens', async () => {
            await reclaim(testEnv);
        });

        it('Closes the Distribution Tree after reclaiming', async () => {
            await close(testEnv, { acknowledgeIrreversible: true });
        });
    });

    describe('Closing a tree without reclaiming', () => {
        before('Initializes and pays out a new Distribution Tree', async () => {
            await createNewDistributionTree({ testEnv, numPayments: totalNumberRecipients });
            await distributeAllPayments({ testEnv, totalNumberRecipients });
        });

        it('Closes the Distribution Tree without reclaiming', async () => {
            await close(testEnv, { acknowledgeIrreversible: true });
        });

    });


}
