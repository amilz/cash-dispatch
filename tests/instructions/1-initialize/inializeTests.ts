import { assert } from "chai";
import { TestEnvironment } from "../../utils/environment/test-environment";
import { Initialize, initialize } from "./initialize";
import { BN } from "@coral-xyz/anchor";




export async function initializeTests(testEnv: TestEnvironment) {

    it.skip('Try to Initialize with the wrong Input', async () => {

    });

    it('Initialize', async () => {

        const initializeParams: Initialize = {
            authority: testEnv.authority,
            distributionTreePda: testEnv.distributionTreePda,
            mint: testEnv.pyUsdMint,
            tokenSource: testEnv.tokenSource,
            tokenVault: testEnv.tokenVault,
            merkleRoot: testEnv.balanceTree.getRoot(),
            batchId: testEnv.distributionUniqueId,
            totalNumberRecipients: Object.keys(testEnv.merkleDistributorInfo.payments).length,
            transferToVaultAmount: Object.values(testEnv.merkleDistributorInfo.payments).reduce((sum, payment) => sum + payment.amount.toNumber(), 0),
            mintDecimals: 6,
            startTs: testEnv.distributionStartTs,
            endTs: null,
        };
        await initialize(testEnv, initializeParams);

    });

    it.skip('Cannot Re-Initialize', async () => {


    });
    it.skip('Cannot TBD', async () => {

    });
}