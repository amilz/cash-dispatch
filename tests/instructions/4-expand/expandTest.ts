import { TestEnvironment } from "../../utils/environment/test-environment";
import { createExpandParams, Expand, expand } from "./expand";
import { createNewDistributionTree, initialize, Initialize } from "../1-initialize/initialize";
import { getAccountByIndex } from "../../utils/merkle-tree";
import { BITMAP_ARRAY_STEP } from "../../utils/constants";
import { assert } from "chai";
import { assertInstructionWillFail } from "../helpers";
import { web3 } from "@coral-xyz/anchor";
import { createDistributeParams, distribute, Distribute } from "../2-distribute/distribute";
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
    let distributeParams: Distribute;

    describe('Expanding a tree that requires expansion', async () => {
        before('Initializes a new Distribution Tree with claims enabled', async () => {
            const numPayments = (64 * BITMAP_ARRAY_STEP) + 10;
            assert.isAbove(numPayments, BITMAP_ARRAY_STEP, "Number of payments should be greater than BITMAP_ARRAY_STEP for this test");
            await createNewDistributionTree({
                testEnv,
                numPayments,
                startOffset: -100
            })
        });

        before('Set Cancel Params', async () => {
            distributeParams = await createDistributeParams({ testEnv, index });
            expandParams = createExpandParams({ testEnv });
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

        it('Cannot expand after completely expanded', async () => {
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

    });
    describe('Expanding a tree that does not require expansion', async () => {
        before('Initializes a new Distribution Tree with claims disabled', async () => {
            const numPayments = (64 * BITMAP_ARRAY_STEP) - 10;
            assert.isBelow(numPayments, (64 * BITMAP_ARRAY_STEP), "Number of payments should be less than threshold requiring expansion for this test");
            await createNewDistributionTree({
                testEnv,
                numPayments,
                startOffset: -100,
                allowClaims: false
            })
        });
        it('Cannot expand a tree that does not require expansion', async () => {
            await assertInstructionWillFail({
                testEnv,
                params: expandParams,
                executeInstruction: expand,
                expectedAnchorError: "InvalidDistributionStatus",
            });
        });
    });
}