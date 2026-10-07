#!/usr/bin/env python3
"""Unified test runner for all Lazy Loading & Redis Caching tests across microservices.

Executes test suites for both:
1. User Management (user_management/backend)
2. FRECO Face Recognition (freco/backend)

Ensures process-level module isolation between microservices having identical top-level `app` packages.
"""
import subprocess
import sys

TEST_SUITES = [
    ("User Management", "tests/test_lazy_redis_user_management.py"),
    ("FRECO Face Recognition", "tests/test_lazy_redis_freco.py"),
]

def run_suite(name: str, test_file: str) -> bool:
    print(f"\n{'='*70}")
    print(f" Running Test Suite: {name}")
    print(f" File: {test_file}")
    print(f"{'='*70}")
    
    cmd = [sys.executable, "-m", "unittest", test_file, "-v"]
    result = subprocess.run(cmd)
    return result.returncode == 0

def main():
    print("=" * 70)
    print(" OCOC Microservices: Lazy Loading & Redis Caching Test Runner")
    print("=" * 70)
    
    failed = []
    passed = []
    
    for name, test_file in TEST_SUITES:
        success = run_suite(name, test_file)
        if success:
            passed.append(name)
        else:
            failed.append(name)
            
    print("\n" + "=" * 70)
    print(" TEST SUITE SUMMARY")
    print("=" * 70)
    print(f"Passed: {len(passed)} / {len(TEST_SUITES)}")
    for p in passed:
        print(f"  [PASS] {p}")
    if failed:
        print(f"Failed: {len(failed)} / {len(TEST_SUITES)}")
        for f in failed:
            print(f"  [FAIL] {f}")
        sys.exit(1)
    else:
        print("\nAll 20/20 unit tests passed successfully!")
        sys.exit(0)

if __name__ == "__main__":
    main()
