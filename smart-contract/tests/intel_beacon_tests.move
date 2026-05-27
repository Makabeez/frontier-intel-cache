// SPDX-License-Identifier: MIT
//
// Tests for intel_beacon module. Run with: sui move test

#[test_only]
module frontier_intel::intel_beacon_tests {
    use sui::test_scenario as ts;
    use sui::clock;
    use frontier_intel::intel_beacon::{Self, Beacon};
    use std::string;

    const ALICE: address = @0xA;
    const BOB: address = @0xB;

    #[test]
    fun test_deploy_beacon() {
        let mut scenario = ts::begin(ALICE);
        let ctx = ts::ctx(&mut scenario);
        let clk = clock::create_for_testing(ctx);

        intel_beacon::deploy_beacon(
            b"Test Beacon",
            b"For unit testing",
            &clk,
            ts::ctx(&mut scenario),
        );

        ts::next_tx(&mut scenario, ALICE);
        {
            let beacon = ts::take_shared<Beacon>(&scenario);
            assert!(intel_beacon::beacon_owner(&beacon) == ALICE, 0);
            assert!(intel_beacon::beacon_intel_count(&beacon) == 0, 1);
            assert!(intel_beacon::beacon_active(&beacon), 2);
            ts::return_shared(beacon);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    fun test_submit_intel_increments_count() {
        let mut scenario = ts::begin(ALICE);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        intel_beacon::deploy_beacon(
            b"Test",
            b"desc",
            &clk,
            ts::ctx(&mut scenario),
        );

        ts::next_tx(&mut scenario, BOB);
        {
            let mut beacon = ts::take_shared<Beacon>(&scenario);
            intel_beacon::submit_intel(
                &mut beacon,
                b"30000142",
                b"scout_report",
                intel_beacon::threat_low(),
                b"NZ4r-jqb0Kr18N6kPWiCB5ozfRtlXGorY8GZcUrzOUg",
                b"Roaming gang at gate",
                &clk,
                ts::ctx(&mut scenario),
            );
            assert!(intel_beacon::beacon_intel_count(&beacon) == 1, 0);
            ts::return_shared(beacon);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 2)] // E_INVALID_THREAT_LEVEL
    fun test_invalid_threat_level_aborts() {
        let mut scenario = ts::begin(ALICE);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        intel_beacon::deploy_beacon(b"T", b"d", &clk, ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, BOB);
        {
            let mut beacon = ts::take_shared<Beacon>(&scenario);
            intel_beacon::submit_intel(
                &mut beacon,
                b"30000142",
                b"scout_report",
                99, // invalid
                b"blobid",
                b"summary",
                &clk,
                ts::ctx(&mut scenario),
            );
            ts::return_shared(beacon);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 3)] // E_EMPTY_BLOB_ID
    fun test_empty_blob_id_aborts() {
        let mut scenario = ts::begin(ALICE);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        intel_beacon::deploy_beacon(b"T", b"d", &clk, ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, BOB);
        {
            let mut beacon = ts::take_shared<Beacon>(&scenario);
            intel_beacon::submit_intel(
                &mut beacon,
                b"30000142",
                b"scout_report",
                intel_beacon::threat_low(),
                b"", // empty
                b"summary",
                &clk,
                ts::ctx(&mut scenario),
            );
            ts::return_shared(beacon);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    fun test_decommission_by_owner() {
        let mut scenario = ts::begin(ALICE);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        intel_beacon::deploy_beacon(b"T", b"d", &clk, ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut beacon = ts::take_shared<Beacon>(&scenario);
            intel_beacon::decommission_beacon(&mut beacon, &clk, ts::ctx(&mut scenario));
            assert!(!intel_beacon::beacon_active(&beacon), 0);
            ts::return_shared(beacon);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1)] // E_NOT_BEACON_OWNER
    fun test_decommission_by_stranger_aborts() {
        let mut scenario = ts::begin(ALICE);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        intel_beacon::deploy_beacon(b"T", b"d", &clk, ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, BOB);
        {
            let mut beacon = ts::take_shared<Beacon>(&scenario);
            intel_beacon::decommission_beacon(&mut beacon, &clk, ts::ctx(&mut scenario));
            ts::return_shared(beacon);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }
}
