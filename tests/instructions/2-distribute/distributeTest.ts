import { assert } from "chai";
import { TestEnvironment } from "../../utils/environment/test-environment";
import { Distribute, distribute } from "./distribute";
import { BN, web3 } from "@coral-xyz/anchor";
import { getAccountByIndex } from "../../utils/merkle-tree";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { assertInstructionWillFail, clearDistributionProgress, printDistributionProgress } from "../helpers";
import { MAX_COMPUTE_UNITS } from "../../utils/constants";

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
    let index: number;
    let correctParams: Distribute;
    let totalNumberRecipients: number;
    let computeUnits: number | undefined;

    before('Set Distribute Params', async () => {
        const treeInfo = await testEnv.program.account.distributionTree.fetch(testEnv.distributionTreePda);
        index = treeInfo.numberDistributed.toNumber();
        totalNumberRecipients = treeInfo.totalNumberRecipients.toNumber();

        const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, index);
        if (!paymentInfo) {
            throw new Error('No recipient found');
        }
        const recipient = paymentInfo.keypair.publicKey;

        correctParams = {
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
        computeUnits = await distribute(testEnv, correctParams, undefined, false, true);
        if (computeUnits) {
            computeUnits = Math.floor(computeUnits * 1.5);
        }
        // preliminar tests suggest that ~100_000 are sufficient
        // but this likely varies on size of the tree (additional testing/simulation required)
        computeUnits = MAX_COMPUTE_UNITS;
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
        const wrongDestination = getAssociatedTokenAddressSync(
            testEnv.pyUsdMint,
            wrongRecipient,
            false,
            TOKEN_2022_PROGRAM_ID
        );
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
    it('Cannot distribute to another recipient in the same batch', async () => {
        const wrongIndex = index + 1;
        const wrongPaymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, wrongIndex);
        if (!wrongPaymentInfo) {
            throw new Error('No recipient found');
        }
        const wrongRecipient = wrongPaymentInfo.keypair.publicKey;
        const wrongDestination = getAssociatedTokenAddressSync(
            testEnv.pyUsdMint,
            wrongRecipient,
            false,
            TOKEN_2022_PROGRAM_ID
        );

        const distributeParams: Distribute = {
            ...correctParams,
            recipient: wrongRecipient,
            amount: wrongPaymentInfo.amount,
            recipientTokenAccount: wrongDestination,
            proof: testEnv.balanceTree.getProof(wrongIndex, wrongRecipient, wrongPaymentInfo.amount),
        };
        await assertInstructionWillFail({
            testEnv,
            params: distributeParams,
            executeInstruction: distribute,
            expectedAnchorError: "InvalidProof"
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
        const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, index);
        if (!paymentInfo) {
            throw new Error('No recipient found');
        }
        const recipient = paymentInfo.keypair.publicKey;

        const distributeParams: Distribute = {
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
        await distribute(testEnv, distributeParams, computeUnits);
        index++;
    });
    it('Cannot distribute the same payment twice', async () => {
        await assertInstructionWillFail({
            testEnv,
            params: correctParams,
            executeInstruction: distribute,
            // We expect that the verify proof will fail because 
            // the payment has already been distributed and the index
            // will not match the on-chain index
            expectedAnchorError: "AlreadyClaimed"
        });
    });
    it('Distributes remaining payments in batches', async () => {
        const totalDistributions = totalNumberRecipients - index;
        const batchSize = 256;
        const distributions: Distribute[] = [];

        // Prepare all distribution parameters
        for (let i = 0; i < totalDistributions; i++) {
            const currentIndex = index + i;
            const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, currentIndex);
            if (!paymentInfo) {
                throw new Error(`No payment found for index ${currentIndex}`);
            }
            const recipient = paymentInfo.keypair.publicKey;

            distributions.push({
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
                proof: testEnv.balanceTree.getProof(currentIndex, recipient, paymentInfo.amount),
                batchId: testEnv.distributionUniqueId,
                numberDistributedBefore: currentIndex
            });
        }

        let successfulDistributions = 0;

        // Process distributions in batches
        for (let i = 0; i < distributions.length; i += batchSize) {
            const batch = distributions.slice(i, i + batchSize);
            await Promise.all(batch.map(async (params, batchIndex) => {
                try {
                    await distribute(testEnv, params, computeUnits);
                    successfulDistributions++;
                    printDistributionProgress(totalDistributions, successfulDistributions);
                } catch (error) {
                    console.error(`Failed to distribute to ${params.recipient.toBase58()}:`, error);
                }
                const DELAY = 1;
                await new Promise(resolve => setTimeout(resolve, DELAY));
            }));
        }

        clearDistributionProgress();

        // Fetch and assert the DistributionTree account data
        let distributionTreeData = await testEnv.program.account.distributionTree.fetch(testEnv.distributionTreePda);
        assert.strictEqual(distributionTreeData.numberDistributed.toNumber(), totalNumberRecipients);
        assert.deepStrictEqual(distributionTreeData.status, { complete: {} });
        distributionTreeData.recipientsDistributedBitmap.forEach((bitmap, index) => {
            const isLastElement = index === distributionTreeData.recipientsDistributedBitmap.length - 1;
            const expectedBits = isLastElement
                ? totalNumberRecipients % 64 || 64
                : 64;

            const binaryString = bitmap.toString(2).padStart(64, '0');
            const setbits = binaryString.split('1').length - 1;

            assert.strictEqual(
                setbits,
                expectedBits,
                `Bitmap element ${index} should have ${expectedBits} bits set, but has ${setbits}`
            );
        });

        // Fetch and assert the token vault token account data
        let tokenVaultTokenAccountData = await testEnv.program.provider.connection.getTokenAccountBalance(testEnv.tokenVault);
        assert.strictEqual(tokenVaultTokenAccountData.value.amount, '0');
    });
    it('Cannot pause a distribution that is not active', async () => {
        await assertInstructionWillFail({
            testEnv,
            params: correctParams,
            executeInstruction: distribute,
            expectedAnchorError: "DistributionNotActive"
        });
    });
}