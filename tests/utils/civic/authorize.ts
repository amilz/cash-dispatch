import { web3 } from "@coral-xyz/anchor";
import { assert } from "chai";
import { findGatewayTokens, GatewayToken, getGatewayTokenAddressForOwnerAndGatekeeperNetwork } from "@identity.com/solana-gateway-ts";
import { CIVIC_PROGRAM_ID } from "../../utils/constants";
import { GatewayAuthorizeAccount } from "./types";


export async function gatewayAuthorizeAccount({ testEnv, account }: GatewayAuthorizeAccount): Promise<GatewayToken> {
    const { connection } = testEnv.provider;
    const { transaction } = await testEnv.civicConfig.gkService.issue(account);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = testEnv.authority.publicKey;
    await web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [testEnv.authority, testEnv.civicConfig.gatekeeper],
        { commitment: 'processed', skipPreflight: true }
    );
    const gatewayTokens = await findGatewayTokens(
        connection,
        account,
        testEnv.civicConfig.gatekeeperNetwork.publicKey,
    );

    const gatewayToken = gatewayTokens[0];

    const expectedTokenAddress = getGatewayTokenAddressForOwnerAndGatekeeperNetwork(
        account,
        testEnv.civicConfig.gatekeeperNetwork.publicKey,
    )

    assert.strictEqual(gatewayToken.gatekeeperNetwork.toBase58(), testEnv.civicConfig.gatekeeperNetwork.publicKey.toBase58());
    assert.strictEqual(gatewayToken.owner.toBase58(), account.toBase58());
    assert.strictEqual(gatewayToken.issuingGatekeeper.toBase58(), testEnv.civicConfig.gatekeeper.publicKey.toBase58());
    assert.strictEqual(gatewayToken.programId.toBase58(), CIVIC_PROGRAM_ID.toBase58());
    assert.strictEqual(gatewayToken.publicKey.toBase58(), expectedTokenAddress.toBase58());
    assert.isTrue(gatewayToken.isValid());

    return gatewayToken;
}

