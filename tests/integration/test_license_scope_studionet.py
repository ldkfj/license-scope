"""Studionet Integration Tests for LicenseScope Intelligent Contract.

Target Network: GenLayer Studionet only (https://studio.genlayer.com/api, Chain ID 61999).
Uses official gltest 0.29.2 contract factory, dynamic ContractFunction.transact() and ContractFunction.call() APIs.
"""

import json
import os

import pytest
from gltest.types import TransactionStatus

IS_STUDIONET_LIVE_CONFIGURED = os.getenv("GENLAYER_STUDIONET_LIVE", "false").lower() == "true"

HAPPY_PATH_OWNER = "snap-research"
HAPPY_PATH_REPO = "CoSearch"
HAPPY_PATH_SHA = "763bf8c4d7caa363ad845d39ddfd53b81ae377bd"
NONEXISTENT_REVISION = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"
POLICY_HASH = "sha256:1105b19ea7786bbd5ace24445845997e914e726cd2f80ddf83d8a6f8f8769532"

skip_offline_studionet = pytest.mark.skipif(
    not IS_STUDIONET_LIVE_CONFIGURED,
    reason="Live Studionet RPC deployment not configured during offline handoff environment",
)


def verify_studionet_target_config():
    from gltest_cli.config.general import get_general_config

    cfg = get_general_config()
    assert cfg.get_network_name() == "studionet"
    assert cfg.get_chain_type() == "studionet"
    assert cfg.get_rpc_url() == "https://studio.genlayer.com/api"


def assert_successful_finalized_transaction(client, receipt):
    """Fail closed unless the full installed-SDK transaction proves execution success."""
    assert client.chain.id == 61999
    tx_id = receipt.get("tx_id")
    assert tx_id, "Transaction receipt must expose tx_id for exact full-transaction lookup"
    full = client.get_transaction(tx_id)
    assert full["status_name"] == "FINALIZED"
    assert full["result_name"] in ("AGREE", "MAJORITY_AGREE")
    assert full["tx_execution_result_name"] == "FINISHED_WITH_RETURN"
    consensus = full.get("consensus_data")
    assert isinstance(consensus, dict)
    leaders = consensus.get("leader_receipt")
    assert isinstance(leaders, list) and leaders
    for leader in leaders:
        assert isinstance(leader, dict)
        assert leader.get("execution_result") == "SUCCESS"
        assert leader.get("error") in (None, "")
    return full


def assert_same_identity(before, after):
    for field in (
        "assessment_id", "canonical_key", "artifact_kind", "namespace", "name",
        "revision", "use_profile", "requester", "policy_version", "policy_hash",
    ):
        assert after[field] == before[field], f"immutable readback field changed: {field}"


@skip_offline_studionet
def test_studionet_request_resolve_readback():
    """Integration test exercising request -> resolve -> receipt/status -> state readback on Studionet."""
    verify_studionet_target_config()
    from gltest import get_accounts, get_contract_factory, get_gl_client

    client = get_gl_client()
    accounts = get_accounts()
    deployer_acc = accounts[0]

    factory = get_contract_factory("license_scope")
    contract = factory.deploy(args=[deployer_acc.address], account=deployer_acc)

    tx_receipt = contract.request_assessment(
        args=[
            "GITHUB_REPO",
            HAPPY_PATH_OWNER,
            HAPPY_PATH_REPO,
            HAPPY_PATH_SHA,
            "COMMERCIAL_INFERENCE",
        ]
    ).transact(wait_transaction_status=TransactionStatus.FINALIZED)
    assert_successful_finalized_transaction(client, tx_receipt)

    assessment_id = 1
    pending = contract.get_assessment(args=[assessment_id]).call()
    assert pending["canonical_key"] == (
        f"GITHUB_REPO:{HAPPY_PATH_OWNER}/{HAPPY_PATH_REPO}@{HAPPY_PATH_SHA}"
        "#COMMERCIAL_INFERENCE#LS-V1"
    )
    assert pending["requester"] == deployer_acc.address
    assert pending["status"] == 1
    assert pending["status_name"] == "PENDING"
    assert pending["verdict"] == "PENDING"
    assert pending["reason_code"] == ""
    assert pending["policy_version"] == "LS-V1"
    assert pending["policy_hash"] == POLICY_HASH

    res_receipt = contract.resolve_assessment(args=[assessment_id]).transact(
        wait_transaction_status=TransactionStatus.FINALIZED
    )
    assert_successful_finalized_transaction(client, res_receipt)

    rec = contract.get_assessment(args=[assessment_id]).call()
    assert_same_identity(pending, rec)
    assert rec["status"] == 4
    assert rec["status_name"] == "BLOCK"
    assert rec["verdict"] == "BLOCK"
    assert rec["reason_code"] == "EXPLICIT_USE_RESTRICTION"
    assert rec["subject_match"] == "EXACT"
    assert rec["revision_match"] == "EXACT"
    assert rec["evidence_sufficient"] is True
    assert json.loads(rec["license_ids"]) == ["CC-BY-NC-4.0"]
    assert "NO_COMMERCIAL_USE" in json.loads(rec["obligations"])


@skip_offline_studionet
def test_studionet_retry_from_unresolved():
    """Integration test covering request -> resolve to UNRESOLVED -> readback UNRESOLVED -> retry -> readback PENDING."""
    verify_studionet_target_config()
    from gltest import get_accounts, get_contract_factory, get_gl_client

    client = get_gl_client()
    accounts = get_accounts()
    deployer_acc = accounts[0]

    factory = get_contract_factory("license_scope")
    contract = factory.deploy(args=[deployer_acc.address], account=deployer_acc)

    tx_receipt = contract.request_assessment(
        args=[
            "GITHUB_REPO",
            "nonexistent-org-99",
            "nonexistent-repo-99",
            NONEXISTENT_REVISION,
            "COMMERCIAL_INFERENCE",
        ]
    ).transact(wait_transaction_status=TransactionStatus.FINALIZED)
    assert_successful_finalized_transaction(client, tx_receipt)

    rec1 = contract.get_assessment(args=[1]).call()
    assert rec1["status"] == 1

    res_receipt = contract.resolve_assessment(args=[1]).transact(
        wait_transaction_status=TransactionStatus.FINALIZED
    )
    assert_successful_finalized_transaction(client, res_receipt)

    rec_unresolved = contract.get_assessment(args=[1]).call()
    assert rec_unresolved["status"] == 5

    retry_receipt = contract.retry_assessment(args=[1]).transact(
        wait_transaction_status=TransactionStatus.FINALIZED
    )
    assert_successful_finalized_transaction(client, retry_receipt)

    rec2 = contract.get_assessment(args=[1]).call()
    assert_same_identity(rec_unresolved, rec2)
    assert rec2["status"] == 1
    assert rec2["status_name"] == "PENDING"
    assert rec2["verdict"] == "PENDING"
    assert rec2["reason_code"] == ""
    assert rec2["subject_match"] == "UNCLEAR"
    assert rec2["revision_match"] == "UNCLEAR"
    assert rec2["evidence_sufficient"] is False
    assert json.loads(rec2["license_ids"]) == []
    assert json.loads(rec2["obligations"]) == []
    assert json.loads(rec2["evidence_references"]) == []
    assert rec2["retry_count"] == 1


@skip_offline_studionet
def test_studionet_multi_account_permissions():
    """Integration test verifying separate requester and resolver accounts using contract.connect(account)."""
    verify_studionet_target_config()
    from gltest import get_accounts, get_contract_factory, get_gl_client

    client = get_gl_client()
    accounts = get_accounts()
    requester_acc = accounts[0]
    resolver_acc = accounts[1]

    factory = get_contract_factory("license_scope")
    contract = factory.deploy(args=[requester_acc.address], account=requester_acc)

    tx_receipt = contract.request_assessment(
        args=[
            "GITHUB_REPO",
            HAPPY_PATH_OWNER,
            HAPPY_PATH_REPO,
            HAPPY_PATH_SHA,
            "COMMERCIAL_MODEL_TRAINING",
        ]
    ).transact(wait_transaction_status=TransactionStatus.FINALIZED)
    assert_successful_finalized_transaction(client, tx_receipt)

    rec = contract.get_assessment(args=[1]).call()
    assert rec["requester"] == requester_acc.address

    resolver_contract = contract.connect(resolver_acc)
    receipt = resolver_contract.resolve_assessment(args=[1]).transact(
        wait_transaction_status=TransactionStatus.FINALIZED
    )
    assert_successful_finalized_transaction(client, receipt)

    resolved = contract.get_assessment(args=[1]).call()
    assert_same_identity(rec, resolved)
    assert resolved["status"] == 4
    assert resolved["status_name"] == "BLOCK"
    assert resolved["verdict"] == "BLOCK"
    assert resolved["reason_code"] == "EXPLICIT_USE_RESTRICTION"
