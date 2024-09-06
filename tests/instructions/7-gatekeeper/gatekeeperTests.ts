import { TestEnvironment } from "../../utils/environment/test-environment";
import { BN, web3 } from "@coral-xyz/anchor";
import { assertInstructionWillFail, createNewDistributionTree, verifyTreeComplete } from "../helpers";
import { initialize, Initialize } from "../1-initialize/initialize";
import { distribute, Distribute } from "../2-distribute/distribute";
import { getAccountByIndex } from "../../utils/merkle-tree";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { gatewayAuthorizeAccount } from "../../utils/civic/authorize";
import { claim, Claim } from "../5-claim/claim";
import { airdropToMultiple } from "../../utils/solana-helpers";


/**
 * GATEKEEPER INSTRUCTION TESTS
 * 
 * @param testEnv 
 * 
 * This test suite initializes a new Distribution Tree with Claims enabled
 *  1. Fails to distribute to a recipient without a gateway token
 *  2. Authorizes the recipient with a gateway token and distributes to them
 *  3. Fails to claim a recipient without a gateway token
 *  4. Authorizes the recipient with a gateway token and claims them
 *  5. Authorizes and distributes remainder of participants
 * 
 */
export async function gatekeeperTests(testEnv: TestEnvironment) {
    let distributeParams: Distribute;
    let claimParams: Claim;
    let distributeIndex = 0;
    let claimIndex = 1;
    let distributionRecipient: web3.PublicKey;
    let claimantKeypair: web3.Keypair;

    before('Initializes a new Distribution Tree with Gatekeeper Network', async () => {
        await createNewDistributionTree({
            testEnv,
            gatekeeperNetwork: testEnv.civicConfig.gatekeeperNetwork.publicKey,
            allowClaims: true
        });
    });

    before('Setup claims and distribution ', async () => {
        // Create a New Tree for this test
        const distributePaymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, distributeIndex);
        if (!distributePaymentInfo) {
            throw new Error('No recipient found');
        }
        distributionRecipient = distributePaymentInfo.keypair.publicKey;

        distributeParams = {
            authority: testEnv.authority,
            recipient: distributionRecipient,
            distributionTreePda: testEnv.distributionTreePda,
            mint: testEnv.pyUsdMint,
            tokenVault: testEnv.tokenVault,
            recipientTokenAccount: getAssociatedTokenAddressSync(
                testEnv.pyUsdMint,
                distributionRecipient,
                false,
                TOKEN_2022_PROGRAM_ID
            ),
            amount: distributePaymentInfo.amount,
            proof: testEnv.balanceTree.getProof(distributeIndex, distributionRecipient, distributePaymentInfo.amount),
            batchId: testEnv.distributionUniqueId,
            numberDistributedBefore: distributeIndex,
            gatewayToken: undefined
        };

        const claimPaymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, claimIndex);
        if (!claimPaymentInfo) {
            throw new Error('No recipient found');
        }
        claimantKeypair = claimPaymentInfo.keypair;

        await airdropToMultiple([claimantKeypair.publicKey,], testEnv.provider.connection, web3.LAMPORTS_PER_SOL);

        claimParams = {
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
            amount: new BN(claimPaymentInfo.amount),
            proof: testEnv.balanceTree.getProof(claimIndex, claimantKeypair.publicKey, claimPaymentInfo.amount),
            batchId: testEnv.distributionUniqueId,
            index: claimIndex,
            gatewayToken: undefined
        }

    });
    it('Cannot distribute to recipient without a Gateway Token', async () => {
        await assertInstructionWillFail({
            testEnv,
            params: distributeParams,
            executeInstruction: distribute,
            expectedAnchorError: "InvalidGatewayToken"
        });
    });
    it('Distributes successfully with Gateway Token', async () => {
        const gatewayToken = await gatewayAuthorizeAccount({ testEnv, account: distributionRecipient });
        distributeParams.gatewayToken = gatewayToken.publicKey;
        await distribute(testEnv, distributeParams);
    });
    it('Cannot be claimed by unauthorized recipient', async () => {
        await assertInstructionWillFail({
            testEnv,
            params: claimParams,
            executeInstruction: claim,
            expectedAnchorError: "InvalidGatewayToken"
        });
    });
    it('Authorizes user and they claim their tokens', async () => {
        const gatewayToken = await gatewayAuthorizeAccount({ testEnv, account: claimantKeypair.publicKey });
        claimParams.gatewayToken = gatewayToken.publicKey;
        await claim(testEnv, claimParams);
    });
    it('Authorizes and distributes tokens to remaining accounts', async () => {
        let processedIndices = [distributeIndex, claimIndex];
        const remainingPayments = testEnv.merkleDistributorInfo.payments.filter((_, paymentIndex) => !processedIndices.includes(paymentIndex));
        const remainingPaymentsWithAuth = await Promise.all(remainingPayments.map(async (paymentInfo) => {
            const recipient = paymentInfo.keypair.publicKey;
            const gatewayToken = await gatewayAuthorizeAccount({ testEnv, account: recipient });
            return {
                ...paymentInfo,
                gatewayToken
            };
        }));

        const distributionPromises = remainingPaymentsWithAuth.map((paymentInfo, index) => {
            const recipient = paymentInfo.keypair.publicKey;
            const gatewayToken = paymentInfo.gatewayToken;
            const thisDistributeIndex = index + processedIndices.length;
            const thisDistribution: Distribute = {
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
                proof: testEnv.balanceTree.getProof(thisDistributeIndex, recipient, paymentInfo.amount),
                batchId: testEnv.distributionUniqueId,
                numberDistributedBefore: thisDistributeIndex,
                gatewayToken: gatewayToken.publicKey
            }

            return distribute(testEnv, thisDistribution);
        });
        await Promise.all(distributionPromises);
        await verifyTreeComplete(testEnv, Object.keys(testEnv.merkleDistributorInfo.payments).length);
    });
}