import { assert } from "chai";
import { TestEnvironment } from "../../utils/environment/test-environment";
import { Distribute, distribute } from "./distribute";
import { BN, web3 } from "@coral-xyz/anchor";
import { getAccountByIndex } from "../../utils/merkle-tree";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { assertInstructionWillFail } from "../helpers";


export async function distributeTests(testEnv: TestEnvironment) {
    let index: number;
    let correctParams: Distribute;

    before('Set Distribute Params', async () => {
        const treeInfo = await testEnv.program.account.distributionTree.fetch(testEnv.distributionTreePda);
        index = treeInfo.numberDistributed.toNumber();


        const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, index);
        if (!paymentInfo) {
            throw new Error('No recipient found');
        }
        const recipient = new web3.PublicKey(paymentInfo.account);

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

    it('Distributes tokens to the recipient', async () => {
        const paymentInfo = getAccountByIndex(testEnv.merkleDistributorInfo, index);
        if (!paymentInfo) {
            throw new Error('No recipient found');
        }
        const recipient = new web3.PublicKey(paymentInfo.account);

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
        await distribute(testEnv, distributeParams);

    });

    it('Cannot Distribute the same payment twice', async () => {
        await assertInstructionWillFail({
            testEnv,
            params: correctParams,
            executeInstruction: distribute,
            // We expect that the verify proof will fail because 
            // the payment has already been distributed and the index
            // will not match the on-chain index
            expectedAnchorError: "InvalidProof"
        });

    });
}